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

const HUMIDITY_THRESHOLD = Number(process.env.HUMIDITY_ALERT_THRESHOLD || 75);
const FLOW_STOP_THRESHOLD = Number(process.env.FLOW_STOP_THRESHOLD || 0.05);
const LOW_WATER_LEVEL_THRESHOLD = Number(process.env.LOW_WATER_LEVEL_THRESHOLD || 20);

const deriveStatus = ({ flow_rate, pressure, timestamp, vibration = 0, humidity = 0, flow1, flow2, water_level, leak = 0, theft = 0 }) => {
  const sensorFlow1 = Number(flow1 ?? flow_rate ?? 0);
  const sensorFlow2 = Number(flow2 ?? 0);
  const humidityValue = Number(humidity ?? 0);
  const vibrationValue = Number(vibration ?? 0);
  const leakValue = Number(leak ?? 0);
  const theftValue = Number(theft ?? 0);
  const waterLevelValue = Number(water_level);
  const pressureValue = Number(pressure);
  const hasPressure = Number.isFinite(pressureValue) && pressureValue > 0;

  if (theftValue === 1) {
    return 'Water Theft';
  }

  if (leakValue === 1) {
    return 'Water Leakage';
  }

  if (vibrationValue === 1) {
    return 'High Vibration';
  }

  if (humidityValue > HUMIDITY_THRESHOLD) {
    return 'High Humidity';
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

  if (Number(reading.leak || 0) === 1) {
    reasons.push('Ultrasonic sensor detected a sudden water-level drop.');
  }

  if (Number(reading.theft || 0) === 1) {
    reasons.push('Possible water theft detected from level drop or flow mismatch.');
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
  const tdsValue = clamp(toSensorNumber(input.tds), 0, 5000);
  const vibration = toSensorNumber(input.vibration ?? input.VIBRATION) === 1 ? 1 : 0;
  const humidity = clamp(toSensorNumber(input.humidity ?? input.HUMIDITY), 0, 100);
  const distanceCm = clamp(toSensorNumber(input.distance_cm ?? input.distanceCm ?? input.distance ?? input.DISTANCE, 0), 0, 500);
  const waterLevel = clamp(toSensorNumber(input.water_level ?? input.waterLevel ?? input.level ?? input.LEVEL, 0), 0, 100);
  const leak = toSensorNumber(input.leak ?? input.LEAK) === 1 ? 1 : 0;
  const theft = toSensorNumber(input.theft ?? input.THEFT) === 1 ? 1 : 0;
  const buzzer = toSensorNumber(input.buzzer ?? input.BUZZER) === 1 ? 1 : 0;
  const ts = input.timestamp || new Date().toISOString();
  const status = input.status || deriveStatus({ flow_rate: flowRate, pressure, timestamp: ts, vibration, humidity, flow1, flow2, water_level: waterLevel, leak, theft });
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
    vibration,
    humidity: Number(humidity.toFixed(2)),
    distance_cm: Number(distanceCm.toFixed(2)),
    water_level: Number(waterLevel.toFixed(2)),
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
  if (sensorPairs && (sensorPairs.FLOW !== undefined || sensorPairs.FLOW1 !== undefined || sensorPairs.FLOW2 !== undefined || sensorPairs.VIBRATION !== undefined || sensorPairs.HUMIDITY !== undefined || sensorPairs.DISTANCE !== undefined || sensorPairs.LEVEL !== undefined || sensorPairs.LEAK !== undefined || sensorPairs.THEFT !== undefined || sensorPairs.BUZZER !== undefined)) {
    return normalizeReading({
      house_id: 'house_1',
      flow1: sensorPairs.FLOW1 ?? sensorPairs.FLOW,
      flow2: sensorPairs.FLOW2 ?? 0,
      vibration: sensorPairs.VIBRATION,
      humidity: sensorPairs.HUMIDITY,
      distance: sensorPairs.DISTANCE,
      level: sensorPairs.LEVEL,
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
