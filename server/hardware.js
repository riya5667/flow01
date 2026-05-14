const { SerialPort, ReadlineParser } = require('serialport');
const { houses } = require('./network');
const { normalizeReading, parseArduinoLine } = require('./telemetry');

const hardwareState = {
  portName: process.env.SERIAL_PORT || null,
  isOpen: false,
  lastRawLine: null,
  lastRawAt: null,
  lastReading: null,
  lastReadingAt: null,
  lastError: null,
};

const getHardwareStatus = () => ({ ...hardwareState });

const buildMockReading = (house) => {
  const minuteOfDay = new Date().getHours() * 60 + new Date().getMinutes();
  const demandWave = Math.sin((minuteOfDay / 1440) * Math.PI * 2);
  const bias = house.demandBand === 'Critical' ? 4 : house.demandBand === 'High' ? 2.5 : 0;
  const drift = (Math.random() - 0.5) * 2.8;

  let flow_rate = 10 + demandWave * 4 + bias + drift;
  let pressure = 46 + bias * 2 - demandWave * 5 + drift * 3;

  const anomalyChance = Math.random();
  if (anomalyChance > 0.9) {
    flow_rate = 0;
    pressure = 6 + Math.random() * 4;
  } else if (anomalyChance > 0.78) {
    flow_rate = 1.3 + Math.random() * 1.1;
    pressure = 13 + Math.random() * 4;
  } else if (anomalyChance > 0.64) {
    flow_rate = 21 + Math.random() * 4;
    pressure = 68 + Math.random() * 6;
  }

  return normalizeReading({
    house_id: house.id,
    flow1: flow_rate,
    flow2: Math.max(0, flow_rate * (0.75 + Math.random() * 0.2)),
    flow_rate,
    pressure,
    tds: 280 + (Math.random() - 0.5) * 50,
    vibration: anomalyChance > 0.92 ? 1 : 0,
    humidity: 48 + Math.random() * 18,
    is_mock: true,
  });
};

const setupHardware = async (onDataReceived) => {
  let portName = process.env.SERIAL_PORT;
  hardwareState.portName = portName || null;

  try {
    const availablePorts = await SerialPort.list();
    console.log('=== Active Serial Ports ===');
    if (availablePorts.length === 0) {
      console.log('  No serial ports detected on this system.');
    } else {
      availablePorts.forEach((p) =>
        console.log(
          ` - ${p.path} | Manufacturer: ${p.manufacturer || 'Unknown'} | VendorID: ${p.vendorId || 'N/A'}`,
        ),
      );
    }
    console.log('===========================');

    if (portName) {
      const configuredPortExists = availablePorts.some(
        (port) => String(port.path).toLowerCase() === String(portName).toLowerCase(),
      );

      if (!configuredPortExists) {
        console.warn(`[Hardware] Configured serial port ${portName} was not found. Trying auto-detection instead.`);
        hardwareState.lastError = `Configured serial port ${portName} was not found`;
        portName = null;
        hardwareState.portName = null;
      }
    }

    if (!portName) {
      const detectedPort = availablePorts.find(
        (p) =>
          (p.manufacturer && p.manufacturer.toLowerCase().includes('arduino')) ||
          (p.vendorId && p.vendorId.toLowerCase() === '2341') ||
          (p.vendorId && p.vendorId.toLowerCase() === '1a86') || // CH340 serial chip
          (p.manufacturer && p.manufacturer.toLowerCase().includes('wch.cn')),
      );

      if (detectedPort) {
        portName = detectedPort.path;
        hardwareState.portName = portName;
        console.log(`Auto-detected Arduino on port: ${portName}`);
      } else {
        // Find the highest COM port as a common heuristic for newly plugged Arduinos
        if (availablePorts.length > 0) {
          const sortedPorts = [...availablePorts].sort((a, b) => b.path.localeCompare(a.path));
          portName = sortedPorts[0].path;
          hardwareState.portName = portName;
          console.log(`Could not auto-detect Arduino by ID, trying highest available port: ${portName}`);
        } else {
          portName = 'COM7';
          hardwareState.portName = portName;
          console.log(`No ports found, using fallback: ${portName}`);
        }
      }
    }

    const port = new SerialPort({
      path: portName,
      baudRate: 9600,
      autoOpen: false,
    });

    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    port.open((err) => {
      if (err) {
        hardwareState.isOpen = false;
        hardwareState.lastError = err.message;
        console.warn(`[Hardware] FAILED to open serial port ${portName}:`, err.message);
        console.warn('[Hardware] Ensure the Arduino is connected and no other app (like Arduino IDE) is using the port.');
      } else {
        hardwareState.isOpen = true;
        hardwareState.lastError = null;
        console.log(`[Hardware] SUCCESS: Connected to Arduino on ${portName}`);
      }
      // Disabled dummy data generator per user request
      // startMockMode(onDataReceived);
    });

    parser.on('data', (data) => {
      const line = String(data).trim();
      hardwareState.lastRawLine = line;
      hardwareState.lastRawAt = new Date().toISOString();
      if (line) {
        console.log(`[Hardware] RAW DATA RECEIVE: "${line}"`);
      }
      try {
        const reading = parseArduinoLine(line);
        if (reading) {
          hardwareState.lastReading = reading;
          hardwareState.lastReadingAt = new Date().toISOString();
          hardwareState.lastError = null;
          onDataReceived(reading);
        } else if (line) {
          hardwareState.lastError = `Unparsed serial line: ${line}`;
        }
      } catch (error) {
        hardwareState.lastError = error.message;
        console.warn('[Hardware] Failed to parse incoming data:', line);
      }
    });

    port.on('error', (err) => {
      hardwareState.isOpen = false;
      hardwareState.lastError = err.message;
      console.error('[Hardware] SerialPort Error:', err.message);
    });

  } catch (err) {
    hardwareState.isOpen = false;
    hardwareState.lastError = err.message;
    console.warn('[Hardware] Critical initialization error:', err.message);
    startMockMode(onDataReceived);
  }
};

const startMockMode = (onDataReceived) => {
  console.log('--- STARTING BACKGROUND SIMULATION FOR DUMMY NODES ---');
  setInterval(() => {
    houses.forEach((house) => {
      // STRICTLY SKIP house_1 so it ONLY uses real Arduino data
      if (house.id === 'house_1') return;

      const reading = buildMockReading(house);
      onDataReceived(reading);
    });
  }, 4000);
};

module.exports = { getHardwareStatus, setupHardware };
