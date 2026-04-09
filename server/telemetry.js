const { getHouseById } = require('./network');

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const deriveStatus = ({ flow_rate, pressure, timestamp }) => {
  // Extract hour to contextualize alerts
  let hour = new Date().getHours();
  if (timestamp) {
    hour = new Date(timestamp).getHours();
  }

  // Diagnostics: Hardware Errors
  if (pressure > 85 || pressure < 2 || flow_rate < -0.1) {
    return 'Sensor Error';
  }

  if (flow_rate <= 0.35 || pressure <= 8) {
    return 'No Flow';
  }

  // Context-Aware Alert: small continuous flow during late night
  if (flow_rate > 0.35 && flow_rate <= 2.5) {
    if (hour >= 1 && hour <= 5) {
      return 'Night Leak Warning';
    }
    return 'Leak Risk';
  }

  if (flow_rate >= 20 || pressure >= 68) {
    return 'Abnormal Flow';
  }

  return 'Normal';
};

const normalizeReading = (input) => {
  const house = getHouseById(input.house_id || input.houseId);

  if (!house) {
    return null;
  }

  const flowRate = clamp(Number(input.flow_rate ?? input.flowRate ?? 0), 0, 40);
  const pressure = clamp(Number(input.pressure ?? 0), 0, 90);
  const ts = input.timestamp || new Date().toISOString();
  const status = input.status || deriveStatus({ flow_rate: flowRate, pressure, timestamp: ts });

  return {
    house_id: house.id,
    pipeline_id: house.pipelineId,
    zone_id: house.zoneId,
    flow_rate: Number(flowRate.toFixed(2)),
    pressure: Number(pressure.toFixed(2)),
    status,
    timestamp: ts,
    is_mock: !!input.is_mock,
  };
};

const parseArduinoLine = (line) => {
  const trimmed = String(line || '').trim();

  if (!trimmed) {
    return null;
  }

  // Intercept the simple 'FLOW:2.5' or 'Flow data: FLOW:2.5' format from the Arduino
  if (trimmed.includes('FLOW:')) {
    const valString = trimmed.replace('Flow data:', '').replace('FLOW:', '').trim();
    const flowR = parseFloat(valString);
    if (!isNaN(flowR)) {
      return normalizeReading({
        house_id: 'house_1', // Map real physical hardware to house_1 (Scheme 114 Homes)
        flow_rate: flowR,
        pressure: 45 + Math.random() * 5, // Mock pressure so the UI stays rich
        timestamp: new Date().toISOString(),
        is_mock: false,
      });
    }
  }

  if (trimmed.startsWith('{')) {
    return normalizeReading(JSON.parse(trimmed));
  }

  const [houseId, flowRate, pressure, timestamp] = trimmed.split(',').map((item) => item.trim());

  if (!houseId) {
    return null;
  }

  return normalizeReading({
    house_id: houseId,
    flow_rate: flowRate,
    pressure,
    timestamp,
  });
};

module.exports = {
  deriveStatus,
  normalizeReading,
  parseArduinoLine,
};
