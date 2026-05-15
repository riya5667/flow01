const { getHouseById } = require('./network');

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toSensorNumber = (value, fallback = 0) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  const match = String(value ?? '').match(/[-+]?\d*\.?\d+/);
  if (!match) {
    return fallback;
  }

  const numeric = Number(match[0]);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const deriveWaterHealth = (tds) => {
  const numericTds = Number(tds);

  if (!Number.isFinite(numericTds) || numericTds < 0) {
    return 'Unknown';
  }

  // Pure water (0) is technically Good, though rare in practice.
  return numericTds <= 500 ? 'Good' : 'Bad';
};

const normalizeTdsReading = (value) => {
  const numericTds = toSensorNumber(value);
  const highReadingThreshold = Number(process.env.TDS_HIGH_READING_THRESHOLD || 1000);
  const highReadingDivisor = Number(process.env.TDS_HIGH_READING_DIVISOR || 25);

  if (numericTds > highReadingThreshold && highReadingDivisor > 0) {
    return numericTds / highReadingDivisor;
  }

  return numericTds;
};

const HUMIDITY_THRESHOLD = Number(process.env.HUMIDITY_ALERT_THRESHOLD || 75);
const FLOW_STOP_THRESHOLD = Number(process.env.FLOW_STOP_THRESHOLD || 0.05);
const LOW_WATER_LEVEL_THRESHOLD = Number(process.env.LOW_WATER_LEVEL_THRESHOLD || 20);
const SOIL_LEAK_THRESHOLD = Number(process.env.SOIL_LEAK_THRESHOLD || 55);
const SOIL_DRY_THRESHOLD = Number(process.env.SOIL_DRY_THRESHOLD || 20);
const FLOW_MISMATCH_LEAK_THRESHOLD = Number(process.env.FLOW_MISMATCH_LEAK_THRESHOLD || 0.3);
const FLOW_MISMATCH_THEFT_THRESHOLD = Number(process.env.FLOW_MISMATCH_THEFT_THRESHOLD || 2);
const FLOW_HALF_THEFT_RATIO = Number(process.env.FLOW_HALF_THEFT_RATIO || 0.5);
const TDS_MAX_PPM = Number(process.env.TDS_MAX_PPM || 10000);

const deriveMoistureFlowFlags = ({ flow_rate, flow1, flow2, soil = 0, hasSoilReading = soil !== undefined && soil !== null && soil !== '', leak = 0, theft = 0 }) => {
  const sensorFlow1 = Number(flow1 ?? flow_rate ?? 0);
  const sensorFlow2 = Number(flow2 ?? 0);
  const soilValue = Number(soil ?? 0);
  const flowMismatch = Math.abs(sensorFlow1 - sensorFlow2);
  const hasFlow = sensorFlow1 > FLOW_STOP_THRESHOLD || sensorFlow2 > FLOW_STOP_THRESHOLD || Number(flow_rate || 0) > FLOW_STOP_THRESHOLD;
  const soilShowsLeakage = hasSoilReading && soilValue >= SOIL_LEAK_THRESHOLD;
  const noMoistureDetected = hasSoilReading && soilValue <= SOIL_DRY_THRESHOLD;
  const halfMeterDrop =
    (sensorFlow1 > FLOW_STOP_THRESHOLD && sensorFlow2 <= Math.max(FLOW_STOP_THRESHOLD, sensorFlow1 * FLOW_HALF_THEFT_RATIO)) ||
    (sensorFlow2 > FLOW_STOP_THRESHOLD && sensorFlow1 <= Math.max(FLOW_STOP_THRESHOLD, sensorFlow2 * FLOW_HALF_THEFT_RATIO));
  const flowDropping = sensorFlow1 > FLOW_STOP_THRESHOLD && sensorFlow2 <= Math.max(FLOW_STOP_THRESHOLD, sensorFlow1 * 0.65);
  const unnecessaryFlowBehavior = flowMismatch >= FLOW_MISMATCH_THEFT_THRESHOLD || (hasFlow && flowMismatch >= FLOW_MISMATCH_LEAK_THRESHOLD);
  const theftDetected = Number(theft) === 1 || halfMeterDrop || (noMoistureDetected && (flowDropping || unnecessaryFlowBehavior));
  const leakDetected = !theftDetected && (Number(leak) === 1 || soilShowsLeakage || (!noMoistureDetected && flowMismatch >= FLOW_MISMATCH_LEAK_THRESHOLD));

  return {
    leak: leakDetected ? 1 : 0,
    theft: theftDetected ? 1 : 0,
    flowMismatch,
    halfMeterDrop,
    flowDropping,
    soilShowsLeakage,
    noMoistureDetected,
  };
};

const deriveStatus = ({ flow_rate, pressure, timestamp, vibration = 0, humidity = 0, soil = 0, hasSoilReading, flow1, flow2, water_level, leak = 0, theft = 0 }) => {
  const sensorFlow1 = Number(flow1 ?? flow_rate ?? 0);
  const sensorFlow2 = Number(flow2 ?? 0);
  const humidityValue = Number(humidity ?? 0);
  const soilValue = Number(soil ?? 0);
  const vibrationValue = Number(vibration ?? 0);
  const inferred = deriveMoistureFlowFlags({ flow_rate, flow1, flow2, soil, hasSoilReading, leak, theft });
  const waterLevelValue = Number(water_level);
  const pressureValue = Number(pressure);
  const hasPressure = Number.isFinite(pressureValue) && pressureValue > 0;

  if (inferred.theft === 1) {
    return 'Water Theft';
  }

  if (inferred.leak === 1) {
    return 'Water Leakage';
  }

  if (vibrationValue === 1) {
    return 'High Vibration';
  }

  if (humidityValue > HUMIDITY_THRESHOLD) {
    return 'High Humidity';
  }

  if (hasSoilReading && soilValue > 0 && soilValue < SOIL_DRY_THRESHOLD) {
    return 'Dry Soil';
  }

  if (Number.isFinite(waterLevelValue) && waterLevelValue > 0 && waterLevelValue <= LOW_WATER_LEVEL_THRESHOLD) {
    return 'Low Water Level';
  }

  if (sensorFlow1 <= FLOW_STOP_THRESHOLD && sensorFlow2 <= FLOW_STOP_THRESHOLD) {
    return 'Flow Stopped';
  }

  if (flow1 !== undefined || flow2 !== undefined) {
    return flow_rate >= 55 ? 'Abnormal Flow' : 'Normal';
  }

  // Extract hour to contextualize alerts
  let hour = new Date().getHours();
  if (timestamp) {
    hour = new Date(timestamp).getHours();
  }

  // Diagnostics: Hardware Errors
  if ((hasPressure && (pressureValue > 85 || pressureValue < 2)) || flow_rate < -0.1) {
    return 'Sensor Error';
  }

  if (flow_rate <= 0.35 || (hasPressure && pressureValue <= 8)) {
    return 'No Flow';
  }

  // Context-Aware Alert: small continuous flow during late night
  if (flow_rate > 0.35 && flow_rate <= 2.5) {
    if (hour >= 1 && hour <= 5) {
      return 'Night Leak Warning';
    }
    return 'Leak Risk';
  }

  if (flow_rate >= 55 || (hasPressure && pressureValue >= 80)) {
    return 'Abnormal Flow';
  }

  return 'Normal';
};

const deriveAlertReasons = (reading) => {
  const reasons = [];

  if (Number(reading.vibration || 0) === 1) {
    reasons.push('Vibration detected by the breadboard sensor node.');
  }

  if (Number(reading.humidity || 0) > HUMIDITY_THRESHOLD) {
    reasons.push(`Humidity exceeded ${HUMIDITY_THRESHOLD}%.`);
  }

  if (Number(reading.soil || 0) >= SOIL_LEAK_THRESHOLD && Number(reading.theft || 0) !== 1) {
    reasons.push(`Soil moisture is high (${Number(reading.soil).toFixed(0)}%), so leakage is suspected around the pipe.`);
  }

  if (Number(reading.soil || 0) < SOIL_DRY_THRESHOLD && Number(reading.soil || 0) > 0) {
    reasons.push('Soil moisture is low, so flow loss is more likely theft than leakage.');
  }

  if (Number(reading.leak || 0) === 1) {
    reasons.push('Leakage detected from soil moisture, ultrasonic, or flow-meter comparison.');
  }

  if (Number(reading.theft || 0) === 1) {
    reasons.push('Possible water theft detected: one flow meter is reading half or less than the other meter.');
  }

  if (Number(reading.water_level || 0) > 0 && Number(reading.water_level || 0) <= LOW_WATER_LEVEL_THRESHOLD) {
    reasons.push(`Tank level is at or below ${LOW_WATER_LEVEL_THRESHOLD}%.`);
  }

  if (Number(reading.flow1 || 0) <= FLOW_STOP_THRESHOLD && Number(reading.flow2 || 0) <= FLOW_STOP_THRESHOLD) {
    reasons.push('Both water flow sensors reported stopped flow.');
  }

  if (String(reading.status || '').toLowerCase().includes('leak')) {
    reasons.push('Leak-risk status detected from flow pattern.');
  }

  return reasons;
};

const normalizeReading = (input) => {
  const house = getHouseById(input.house_id || input.houseId);

  if (!house) {
    return null;
  }

  const flow1 = clamp(toSensorNumber(input.flow1 ?? input.FLOW1 ?? input.flow_rate ?? input.flowRate), 0, 100);
  const flow2 = clamp(toSensorNumber(input.flow2 ?? input.FLOW2), 0, 100);
  const flowRate = clamp(toSensorNumber(input.flow_rate ?? input.flowRate, flow1 + flow2), 0, 200);
  const pressure = clamp(toSensorNumber(input.pressure), 0, 100);
  const tdsRaw = toSensorNumber(input.tds_raw ?? input.tdsRaw ?? input.TDSRAW, 0);
  const tdsValue = clamp(normalizeTdsReading(input.tds), 0, TDS_MAX_PPM);
  const vibration = toSensorNumber(input.vibration ?? input.VIBRATION) === 1 ? 1 : 0;
  const humidity = clamp(toSensorNumber(input.humidity ?? input.HUMIDITY), 0, 100);
  const rawSoil = input.soil ?? input.SOIL;
  const hasSoilReading = rawSoil !== undefined && rawSoil !== null && rawSoil !== '';
  const soil = clamp(toSensorNumber(rawSoil), 0, 100);
  const distanceCm = clamp(toSensorNumber(input.distance_cm ?? input.distanceCm ?? input.distance ?? input.DISTANCE, 0), 0, 500);
  const waterLevel = clamp(toSensorNumber(input.water_level ?? input.waterLevel ?? input.level ?? input.LEVEL, 0), 0, 100);
  const ultrasonic = toSensorNumber(input.ultrasonic ?? input.ULTRASONIC, distanceCm > 0 ? 1 : 0) === 1 ? 1 : 0;
  const rawLeak = toSensorNumber(input.leak ?? input.LEAK) === 1 ? 1 : 0;
  const rawTheft = toSensorNumber(input.theft ?? input.THEFT) === 1 ? 1 : 0;
  const inferredFlags = deriveMoistureFlowFlags({ flow_rate: flowRate, flow1, flow2, soil, hasSoilReading, leak: rawLeak, theft: rawTheft });
  const leak = inferredFlags.leak;
  const theft = inferredFlags.theft;
  const buzzer = toSensorNumber(input.buzzer ?? input.BUZZER) === 1 ? 1 : 0;
  const ts = input.timestamp || new Date().toISOString();
  const status = input.status || deriveStatus({ flow_rate: flowRate, pressure, timestamp: ts, vibration, humidity, soil, hasSoilReading, flow1, flow2, water_level: waterLevel, leak, theft });
  const water_health = input.water_health || input.waterHealth || deriveWaterHealth(tdsValue);

  const reading = {
    house_id: house.id,
    pipeline_id: house.pipelineId,
    zone_id: house.zoneId,
    flow1: Number(flow1.toFixed(2)),
    flow2: Number(flow2.toFixed(2)),
    flow_rate: Number(flowRate.toFixed(2)),
    pressure: Number(pressure.toFixed(2)),
    tds: Number(tdsValue.toFixed(2)),
    tds_raw: Number(tdsRaw.toFixed(2)),
    vibration,
    humidity: Number(humidity.toFixed(2)),
    soil: Number(soil.toFixed(2)),
    distance_cm: Number(distanceCm.toFixed(2)),
    water_level: Number(waterLevel.toFixed(2)),
    ultrasonic,
    leak,
    theft,
    buzzer,
    water_health,
    status,
    timestamp: ts,
    is_mock: !!input.is_mock,
  };

  return {
    ...reading,
    alert_reasons: deriveAlertReasons(reading),
  };
};

const parseKeyValueLine = (trimmed) => {
  const pairs = {};

  trimmed.split(',').forEach((chunk) => {
    const [rawKey, rawValue] = chunk.split(':');
    if (!rawKey || rawValue === undefined) {
      return;
    }

    pairs[rawKey.trim().toUpperCase()] = rawValue.trim();
  });

  if (!Object.keys(pairs).length) {
    return null;
  }

  return pairs;
};

const parseArduinoLine = (line) => {
  const trimmed = String(line || '').trim();

  if (!trimmed) {
    return null;
  }

  const sensorPairs = parseKeyValueLine(trimmed);
  if (sensorPairs && (sensorPairs.FLOW !== undefined || sensorPairs.FLOW1 !== undefined || sensorPairs.FLOW2 !== undefined || sensorPairs.VIBRATION !== undefined || sensorPairs.HUMIDITY !== undefined || sensorPairs.SOIL !== undefined || sensorPairs.TDS !== undefined || sensorPairs.TDSRAW !== undefined || sensorPairs.Y !== undefined || sensorPairs.DISTANCE !== undefined || sensorPairs.LEVEL !== undefined || sensorPairs.ULTRASONIC !== undefined || sensorPairs.LEAK !== undefined || sensorPairs.THEFT !== undefined || sensorPairs.BUZZER !== undefined)) {
    return normalizeReading({
      house_id: 'house_1',
      flow1: sensorPairs.FLOW1 ?? sensorPairs.FLOW,
      flow2: sensorPairs.FLOW2 ?? 0,
      vibration: sensorPairs.VIBRATION,
      humidity: sensorPairs.HUMIDITY ?? sensorPairs.Y,
      soil: sensorPairs.SOIL,
      tds: sensorPairs.TDS,
      tds_raw: sensorPairs.TDSRAW,
      distance: sensorPairs.DISTANCE,
      level: sensorPairs.LEVEL,
      ultrasonic: sensorPairs.ULTRASONIC,
      leak: sensorPairs.LEAK,
      theft: sensorPairs.THEFT,
      buzzer: sensorPairs.BUZZER,
      timestamp: new Date().toISOString(),
      is_mock: false,
    });
  }

  if (trimmed.includes('FLOW:') || trimmed.includes('TDS:') || trimmed.includes('F:') || trimmed.includes('T:')) {
    // Aggressive regex to find labels like FLOW:1.2, F:1.2, TDS:250, or T:250
    const flowMatch = trimmed.match(/(?:FLOW|F)[:\s]+([-+]?\d*\.?\d+)/i);
    const tdsMatch = trimmed.match(/(?:TDS|T)[:\s]+([-+]?\d*\.?\d+)/i);

    const flowR = flowMatch ? parseFloat(flowMatch[1]) : NaN;
    const tds = tdsMatch ? parseFloat(tdsMatch[1]) : NaN;

    if (!isNaN(flowR)) {
      return normalizeReading({
        house_id: 'house_1',
        flow_rate: flowR,
        pressure: 45 + Math.random() * 5, 
        tds: !isNaN(tds) ? tds : 0,
        timestamp: new Date().toISOString(),
        is_mock: false,
      });
    }
  }

  if (trimmed.startsWith('{')) {
    return normalizeReading(JSON.parse(trimmed));
  }

  const [houseId, flowRate, pressure, tds, timestamp] = trimmed.split(',').map((item) => item.trim());

  if (!houseId) {
    return null;
  }

  return normalizeReading({
    house_id: houseId,
    flow_rate: flowRate,
    pressure,
    tds,
    timestamp,
  });
};

module.exports = {
  deriveAlertReasons,
  deriveStatus,
  deriveWaterHealth,
  normalizeReading,
  parseArduinoLine,
};
