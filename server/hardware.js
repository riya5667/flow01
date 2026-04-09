const { SerialPort, ReadlineParser } = require('serialport');
const { houses } = require('./network');
const { normalizeReading, parseArduinoLine } = require('./telemetry');

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
    flow_rate,
    pressure,
    is_mock: true,
  });
};

const setupHardware = async (onDataReceived) => {
  let portName = process.env.SERIAL_PORT;

  try {
    if (!portName) {
      const ports = await SerialPort.list();
      
      console.log('=== Active Serial Ports ===');
      if (ports.length === 0) console.log('  No serial ports detected on this system.');
      ports.forEach(p => console.log(` - ${p.path} | Manufacturer: ${p.manufacturer || 'Unknown'} | VendorID: ${p.vendorId || 'N/A'}`));
      console.log('===========================');

      const detectedPort = ports.find((p) => 
        (p.manufacturer && p.manufacturer.toLowerCase().includes('arduino')) ||
        (p.vendorId && p.vendorId.toLowerCase() === '2341') ||
        (p.vendorId && p.vendorId.toLowerCase() === '1a86') || // CH340 serial chip commonly used in Arduino clones
        (p.manufacturer && p.manufacturer.toLowerCase().includes('wch.cn'))
      );
      if (detectedPort) {
        portName = detectedPort.path;
        console.log(`Auto-detected Arduino on port: ${portName}`);
      } else {
        portName = 'COM7'; // fallback
        console.log(`Could not auto-detect Arduino, falling back to: ${portName}`);
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
        console.warn(`Could not open real serial port ${portName}:`, err.message);
        startMockMode(onDataReceived);
      } else {
        console.log(`Successfully connected to Arduino on ${portName}`);
        startMockMode(onDataReceived);
      }
    });

    parser.on('data', (data) => {
      try {
        const reading = parseArduinoLine(data);

        if (reading) {
          onDataReceived(reading);
        }
      } catch (error) {
        console.warn('Failed to parse incoming serial data:', data);
      }
    });
  } catch (err) {
    console.warn('Problem initializing SerialPort:', err.message);
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

module.exports = { setupHardware };

