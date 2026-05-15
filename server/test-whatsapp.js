require('dotenv').config();
const { sendWhatsAppText } = require('./whatsapp');

async function sendManualAlert() {
    console.log('--- FlowIntel WhatsApp Alert System ---');
    
    // Get message from command line arguments or use default
    const customMessage = process.argv.slice(2).join(' ');
    const message = customMessage || '🚀 FlowIntel Alert: This is a test notification from your WhatsApp Alert System!';

    console.log(`Sending message: "${message}"...`);

    try {
        const result = await sendWhatsAppText(message);
        
        if (result.ok) {
            console.log('✅ Success! Message sent to ' + result.sent + ' recipient(s).');
        } else {
            console.error('❌ Failed to send alert.');
            if (result.reason === 'missing_meta_config') {
                console.error('Hint: Please fill in your credentials in the server/.env file.');
            }
        }
    } catch (error) {
        console.error('❌ Error occurred while sending WhatsApp alert:');
        console.error(error.message);
    }
}

sendManualAlert();
