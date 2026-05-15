require('dotenv').config();

const {
  sendLeakAlert,
  sendSoilFlowDropAlert,
  sendTheftAlert,
  sendWhatsAppText,
} = require('./whatsapp');

async function runTests() {
  const mode = process.argv[2] || 'test';

  console.log('--- FlowIntel WhatsApp Alert System Test Suite ---');
  console.log(`Mode: ${mode.toUpperCase()}`);

  try {
    if (mode === 'leak') {
      console.log('Simulating a Leak Alert...');
      const dummyReading = {
        house_id: 'House_01',
        flow1: 12.5,
        flow2: 10.8,
        flow_rate: 12.5,
        pressure: 180,
        soil: 72,
        status: 'Water Leakage',
        timestamp: new Date().toISOString(),
      };
      const result = await sendLeakAlert(dummyReading);
      console.log(result.ok ? 'Leak alert sent.' : 'Failed to send leak alert.');
    } else if (mode === 'theft') {
      console.log('Simulating a Theft Alert...');
      const dummyReading = {
        house_id: 'House_01',
        flow1: 12,
        flow2: 5.8,
        flow_rate: 12,
        pressure: 120,
        soil: 18,
        status: 'Water Theft',
        timestamp: new Date().toISOString(),
      };
      const result = await sendTheftAlert(
        dummyReading,
        'One flow meter is reading half or less than the other meter.',
      );
      console.log(result.ok ? 'Theft alert sent.' : 'Failed to send theft alert.');
    } else if (mode === 'soil') {
      console.log('Simulating a Soil Moisture + Flow Drop Alert...');
      const dummyReading = {
        house_id: 'House_01',
        flow1: 14,
        flow2: 8,
        flow_rate: 14,
        pressure: 135,
        soil: 68,
        water_level: 42,
        status: 'Leak Risk',
        timestamp: new Date().toISOString(),
      };
      const result = await sendSoilFlowDropAlert(
        dummyReading,
        'High soil moisture is present while output flow is dropping.',
      );
      console.log(result.ok ? 'Soil/flow alert sent.' : 'Failed to send soil/flow alert.');
    } else {
      console.log('Sending a standard test message...');
      const message =
        'FlowIntel Alert System is ONLINE. You will receive WhatsApp notifications for leaks, theft, soil moisture, and flow-drop alerts.';
      const result = await sendWhatsAppText(message);
      console.log(result.ok ? 'Test message sent.' : 'Failed to send message.');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

runTests();
