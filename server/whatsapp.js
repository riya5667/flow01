const DEFAULT_GRAPH_API_VERSION = 'v23.0';

const normalizePhoneNumber = (value) => String(value || '').replace(/[^\d]/g, '');

const getWhatsAppConfig = () => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WA_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.CLOUD_API_ACCESS_TOKEN;
  const recipients = String(process.env.WHATSAPP_TO_PHONE_NUMBER || process.env.WHATSAPP_ALERT_RECIPIENTS || '')
    .split(',')
    .map(normalizePhoneNumber)
    .filter(Boolean);
  const graphApiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || process.env.CLOUD_API_VERSION || DEFAULT_GRAPH_API_VERSION;

  return {
    accessToken,
    graphApiVersion,
    phoneNumberId,
    recipients,
  };
};

const buildMessagesUrl = ({ graphApiVersion, phoneNumberId }) =>
  `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`;

const hasCloudApiConfig = (config) => !!config.phoneNumberId && !!config.accessToken && config.recipients.length > 0;

const sendTextToRecipient = async ({ recipient, body }) => {
  const config = getWhatsAppConfig();

  if (!hasCloudApiConfig(config)) {
    console.warn(
      '[WhatsApp] Cloud API is not configured. Set WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, and WHATSAPP_TO_PHONE_NUMBER in server/.env.',
    );
    return { ok: false, skipped: true, reason: 'missing_config' };
  }

  const response = await fetch(buildMessagesUrl(config), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'text',
      text: {
        body,
        preview_url: false,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.error?.message || `WhatsApp request failed with ${response.status}`;
    throw new Error(message);
  }

  return { ok: true, recipient, payload };
};

const sendWhatsAppText = async (body) => {
  const config = getWhatsAppConfig();

  if (typeof fetch !== 'function') {
    console.warn('[WhatsApp] Global fetch is unavailable. Use Node 18+ to enable Cloud API messaging.');
    return { ok: false, skipped: true, reason: 'fetch_unavailable' };
  }

  if (!hasCloudApiConfig(config)) {
    console.warn(
      '[WhatsApp] Meta Cloud API is not configured. Set WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, and WHATSAPP_TO_PHONE_NUMBER in server/.env.',
    );
    return { ok: false, skipped: true, reason: 'missing_meta_config', provider: 'meta' };
  }

  const results = await Promise.allSettled(
    config.recipients.map((recipient) => sendTextToRecipient({ recipient, body })),
  );

  const sent = results.filter((result) => result.status === 'fulfilled' && result.value.ok);
  const failed = results.filter((result) => result.status === 'rejected');

  failed.forEach((result) => {
    console.error('[WhatsApp] Message failed:', result.reason?.message || result.reason);
  });

  return {
    ok: sent.length > 0,
    provider: 'meta',
    sent: sent.length,
    failed: failed.length,
  };
};

const formatMetric = (value, suffix = '') => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric.toFixed(2)}${suffix}` : `--${suffix}`;
};

const sendLeakAlert = async (reading = {}) => {
  const body = [
    'FlowIntel Alert',
    '',
    `Status: ${reading.status || 'Leak suspected'}`,
    `Node: ${reading.house_id || reading.zone || 'Unknown'}`,
    `Flow: ${formatMetric(reading.flow_rate, ' L/min')}`,
    `Pressure: ${formatMetric(reading.pressure, ' kPa')}`,
    reading.tds !== undefined ? `TDS: ${formatMetric(reading.tds, ' ppm')}` : null,
    reading.humidity !== undefined ? `Humidity: ${formatMetric(reading.humidity, '%')}` : null,
    `Time: ${new Date(reading.timestamp || Date.now()).toLocaleString('en-IN')}`,
    '',
    'Action: Inspect the line, valve, and flow sensor immediately.',
  ]
    .filter(Boolean)
    .join('\n');

  return sendWhatsAppText(body);
};

const sendWaterReport = async ({ stats = [], alerts = [], generatedAt = new Date() } = {}) => {
  const totalFlow = stats.reduce((sum, item) => sum + Number(item.cumulative_flow_liters || 0), 0);
  const totalFaults = stats.reduce((sum, item) => sum + Number(item.fault_count || 0), 0);
  const topStations = stats
    .slice()
    .sort((a, b) => Number(b.cumulative_flow_liters || 0) - Number(a.cumulative_flow_liters || 0))
    .slice(0, 3)
    .map((item, index) => `${index + 1}. ${item.house_id}: ${formatMetric(item.cumulative_flow_liters, ' L')}`)
    .join('\n');

  const body = [
    'FlowIntel Water Report',
    '',
    `Generated: ${new Date(generatedAt).toLocaleString('en-IN')}`,
    `Total flow: ${formatMetric(totalFlow, ' L')}`,
    `Fault count: ${totalFaults}`,
    `Recent alerts: ${alerts.length}`,
    '',
    topStations ? `Top stations:\n${topStations}` : 'Top stations: No station history yet.',
    '',
    alerts[0] ? `Latest alert: ${alerts[0].type} - ${alerts[0].message}` : 'Latest alert: None',
  ].join('\n');

  return sendWhatsAppText(body);
};

module.exports = {
  sendLeakAlert,
  sendWaterReport,
  sendWhatsAppText,
};
