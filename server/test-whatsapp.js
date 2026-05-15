require('dotenv').config();
const { sendWhatsAppText, sendLeakAlert } = require('./whatsapp');

async function runTests() {
    const mode = process.argv[2] || 'test';
    
    console.log('--- FlowIntel WhatsApp Alert System Test Suite ---');
    console.log(`Mode: ${mode.toUpperCase()}`);

    try {
        if (mode === 'leak') {
            console.log('Simulating a Leak Alert...');
            const dummyReading = {
                house_id: 'House_01',
                flow_rate: 12.5,
                pressure: 180,
                status: 'Leak Suspected',
                timestamp: new Date().toISOString()
            };
            const result = await sendLeakAlert(dummyReading);
            console.log(result.ok ? '✅ Leak alert sent!' : '❌ Failed to send leak alert.');
        } 
        else if (mode === 'theft') {
            console.log('Simulating a Theft Alert...');
            const message = `🚨 *THEFT DETECTED*\nLocation: Sector 4 - Main Line\nTime: ${new Date().toLocaleTimeString()}\n\nWarning: Unusual drop in pressure combined with high flow detected outside scheduled hours. Inspect for illegal tapping!`;
            const result = await sendWhatsAppText(message);
            console.log(result.ok ? '✅ Theft alert sent!' : '❌ Failed to send theft alert.');
        }
        else {
            console.log('Sending a standard test message...');
            const message = '🚀 FlowIntel Alert System is ONLINE. You will receive notifications here for any Leaks or Theft detected in the network.';
            const result = await sendWhatsAppText(message);
            console.log(result.ok ? '✅ Test message sent!' : '❌ Failed to send message.');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

runTests();
