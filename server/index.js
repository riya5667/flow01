const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { initDb, storeReading, getLatestReadings, getReadingHistory, getHouseStats, getRecentAlerts, storeSensorAlert } = require('./db');
const { setupHardware } = require('./hardware');
const { getNetworkSnapshot, houses, zones } = require('./network');
const multer = require('multer');
const cron = require('node-cron');
const { isHFReady, ingestDocument, searchSimilar } = require('./rag');
const { sendWhatsAppText, sendLeakAlert, sendSoilFlowDropAlert, sendTheftAlert } = require('./whatsapp');

const upload = multer({ dest: 'uploads/' });

const safeParseJson = (raw) => {
  if (!raw) return null;
  let text = String(raw).trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  }
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  const candidate = text.slice(first, last + 1);
  try {
    return JSON.parse(candidate);
  } catch (e) {
    return null;
  }
};
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const getGroqModel = () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GROQ_SENSOR_ANALYSIS_INTERVAL_MS = Number(process.env.GROQ_SENSOR_ANALYSIS_INTERVAL_MS || 12000);
const WHATSAPP_ALERT_COOLDOWN_MS = Number(process.env.WHATSAPP_ALERT_COOLDOWN_MS || 60000);
const lastGroqSensorAnalysisAt = new Map();
const latestGroqReadingByHouse = new Map();
const lastWhatsAppAlertAt = new Map();
let groqReady = false;
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
  if (process.env.GROQ_API_KEY) {
    groqReady = true;
    console.log('Groq API configured successfully.');
  } else {
    console.warn('GROQ_API_KEY is missing. Add it to server/.env to enable AI routes.');
  }
} catch (e) {
  console.warn('dotenv not available. Please run: npm install dotenv');
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const normalizeAiBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return ['true', 'yes', 'detected', 'found', '1'].includes(String(value || '').trim().toLowerCase());
};

const getFlowDropSignals = (reading = {}) => {
  const flow1 = Number(reading.flow1 ?? reading.flow_rate ?? 0);
  const flow2 = Number(reading.flow2 ?? 0);
  const soil = Number(reading.soil ?? 0);
  const halfMeterDrop =
    (flow1 > 0.05 && flow2 <= Math.max(0.05, flow1 * 0.5)) ||
    (flow2 > 0.05 && flow1 <= Math.max(0.05, flow2 * 0.5));
  const flowDrop = flow1 > 0.05 && flow2 <= Math.max(0.05, flow1 * 0.65);
  const soilMoistureAlert = soil >= 55 && flowDrop;

  return { flow1, flow2, soil, halfMeterDrop, flowDrop, soilMoistureAlert };
};

const sendWhatsAppAlertOnce = async ({ key, sender, reading, reason }) => {
  const now = Date.now();
  const lastSentAt = lastWhatsAppAlertAt.get(key) || 0;
  if (now - lastSentAt < WHATSAPP_ALERT_COOLDOWN_MS) {
    return;
  }

  lastWhatsAppAlertAt.set(key, now);

  try {
    const result = await sender(reading, reason);
    if (!result?.ok) {
      console.warn(`[WhatsApp] Alert skipped or failed for ${key}:`, result?.reason || 'not sent');
    }
  } catch (error) {
    console.error(`[WhatsApp] Alert failed for ${key}:`, error.message);
  }
};

const maybeSendWhatsAppSensorAlerts = (reading = {}) => {
  const { flow1, flow2, soil, halfMeterDrop, flowDrop, soilMoistureAlert } = getFlowDropSignals(reading);
  const houseId = reading.house_id || 'unknown';

  if (reading.theft === 1 || halfMeterDrop || reading.status === 'Water Theft') {
    sendWhatsAppAlertOnce({
      key: `${houseId}:theft`,
      sender: sendTheftAlert,
      reading,
      reason: `Flow meter mismatch detected. Meter readings are ${flow1.toFixed(2)} L/min and ${flow2.toFixed(2)} L/min; one meter is half or less than the other.`,
    });
  }

  if (reading.leak === 1 || reading.status === 'Water Leakage') {
    sendWhatsAppAlertOnce({
      key: `${houseId}:leak`,
      sender: sendLeakAlert,
      reading,
      reason: 'Leakage detected from flow, soil moisture, or AI analysis.',
    });
  }

  if (soilMoistureAlert) {
    sendWhatsAppAlertOnce({
      key: `${houseId}:soil-flow-drop`,
      sender: sendSoilFlowDropAlert,
      reading,
      reason: `Soil moisture is ${soil.toFixed(0)}% while output flow dropped below expected flow.`,
    });
  } else if (flowDrop && soil > 0) {
    sendWhatsAppAlertOnce({
      key: `${houseId}:flow-drop`,
      sender: sendSoilFlowDropAlert,
      reading,
      reason: `Output flow dropped compared with input flow. Soil moisture is ${soil.toFixed(0)}%.`,
    });
  }
};

const analyzeSensorReadingWithGroq = async (reading) => {
  if (!groqReady || typeof fetch !== 'function') {
    return null;
  }

  const prompt = `You are FlowIntel's live water-pipeline anomaly classifier.
Analyze ALL sensor values together and decide whether this reading indicates water leakage or water theft.

Rules:
- High soil moisture near the pipe strongly supports leakage.
- If soil moisture is low/no leakage moisture, but flow meters are mismatched, output flow drops, or flow behaves unnecessarily, strongly support theft.
- Flow 1 is input flow. Flow 2 is output flow.
- Vibration, humidity, tank level, ultrasonic distance, buzzer, TDS, and status can support the verdict but must not replace flow and soil evidence.
- Return only JSON. Keep the message short for a dashboard alert.

Sensor reading:
${JSON.stringify({
  house_id: reading.house_id,
  flow1: reading.flow1,
  flow2: reading.flow2,
  flow_rate: reading.flow_rate,
  pressure: reading.pressure,
  humidity: reading.humidity,
  soil: reading.soil,
  vibration: reading.vibration,
  distance_cm: reading.distance_cm,
  water_level: reading.water_level,
  ultrasonic: reading.ultrasonic,
  leak: reading.leak,
  theft: reading.theft,
  buzzer: reading.buzzer,
  tds: reading.tds,
  water_health: reading.water_health,
  status: reading.status,
  timestamp: reading.timestamp,
})}

Return shape:
{
  "leakDetected": boolean,
  "theftDetected": boolean,
  "status": "Normal" | "Water Leakage" | "Water Theft" | "Leak Risk" | "Abnormal Flow",
  "severity": "critical" | "warning" | "info",
  "confidence": number,
  "reason": "short reason with the strongest sensor evidence",
  "recommendedAction": "short operator action"
}`;

  const completion = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: getGroqModel(),
      messages: [{ role: 'system', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });

  const rawText = await completion.text();
  if (!completion.ok) {
    const parsedError = safeParseJson(rawText);
    throw new Error(parsedError?.error?.message || rawText || 'Groq request failed.');
  }

  const envelope = safeParseJson(rawText);
  const content = envelope?.choices?.[0]?.message?.content || rawText;
  const parsed = safeParseJson(content);
  if (!parsed) {
    throw new Error('Groq returned an unreadable sensor analysis.');
  }

  return {
    leakDetected: normalizeAiBoolean(parsed.leakDetected),
    theftDetected: normalizeAiBoolean(parsed.theftDetected),
    status: parsed.status || '',
    severity: ['critical', 'warning', 'info'].includes(parsed.severity) ? parsed.severity : 'warning',
    confidence: Number(parsed.confidence || 0),
    reason: parsed.reason || 'Groq detected an abnormal sensor pattern.',
    recommendedAction: parsed.recommendedAction || 'Inspect the affected line and compare flow meters.',
  };
};

const emitDashboardAlert = (alert) => {
  storeSensorAlert(alert, (err, savedAlert) => {
    if (!err && savedAlert) {
      io.emit('alertUpdate', savedAlert);
    }
  });
};

const maybeRunGroqSensorAnalysis = async (reading) => {
  if (!groqReady) {
    return;
  }

  const now = Date.now();
  const lastRun = lastGroqSensorAnalysisAt.get(reading.house_id) || 0;
  const isSuspicious = reading.leak === 1 || reading.theft === 1 || reading.status !== 'Normal';

  if (!isSuspicious && now - lastRun < GROQ_SENSOR_ANALYSIS_INTERVAL_MS) {
    return;
  }

  lastGroqSensorAnalysisAt.set(reading.house_id, now);

  try {
    const analysis = await analyzeSensorReadingWithGroq(reading);
    if (!analysis) return;

    const leakDetected = analysis.leakDetected || reading.leak === 1;
    const theftDetected = analysis.theftDetected || reading.theft === 1;
    if (!leakDetected && !theftDetected) {
      return;
    }

    const type = theftDetected ? 'Water Theft' : 'Water Leakage';
    const analyzedReading = {
      ...reading,
      leak: leakDetected ? 1 : 0,
      theft: theftDetected ? 1 : 0,
      status: type,
      groq_analysis: analysis,
    };

    latestGroqReadingByHouse.set(reading.house_id, analyzedReading);
    io.emit('sensorUpdate', analyzedReading);
    maybeSendWhatsAppSensorAlerts(analyzedReading);
    emitDashboardAlert({
      house_id: reading.house_id,
      type,
      severity: analysis.severity,
      message: `Groq ${type}: ${analysis.reason} Action: ${analysis.recommendedAction}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Groq Sensor Analysis] Failed:', error.message);
  }
};

const mergeGroqReadingOverrides = (readings = []) =>
  readings.map((reading) => {
    const override = latestGroqReadingByHouse.get(reading.house_id);
    return override ? { ...reading, ...override } : reading;
  });

let dbReady = false;
initDb((err) => {
  if (err) {
    console.error('[Database] Hardware startup skipped because schema initialization failed.');
    return;
  }

  dbReady = true;
  console.log('[Database] Schema ready.');
  setupHardware(handleSensorData);
});

// In-memory store for Alerts and Report Scheduling (Should be DB in production)
let recentAlerts = [];
let reportConfig = {
  enabled: true,
  dayOfWeek: 0, // Sunday
  hour: 9,
  minute: 0,
  whatsappNumber: 'YOUR_NUMBER'
};
let scheduledTask = null;

const sendWhatsAppMessage = async (to, message) => {
  console.log(`[WhatsApp] Sending alert: ${message}`);
  try {
    // If 'to' is provided and valid, it overrides the default from .env for this specific message
    // Otherwise sendWhatsAppText uses recipients from .env
    const result = await sendWhatsAppText(message);
    return result.ok;
  } catch (e) {
    console.error('[WhatsApp] Send Error:', e.message);
    return false;
  }
};

const scheduleWeeklyReport = () => {
  if (scheduledTask) scheduledTask.stop();
  
  const { dayOfWeek, hour, minute } = reportConfig;
  const cronExpression = `${minute} ${hour} * * ${dayOfWeek}`;
  
  scheduledTask = cron.schedule(cronExpression, () => {
    console.log('Running scheduled weekly report...');
    const msg = `📊 *Weekly FlowIntel Report*\nYour water usage for the last week was optimized. No major leaks detected in the main network.`;
    sendWhatsAppMessage(reportConfig.whatsappNumber, msg);
  });
  console.log(`Weekly report scheduled: ${cronExpression}`);
};

scheduleWeeklyReport();
  console.log('A client connected:', socket.id);

  getLatestReadings((readings) => {
    socket.emit('initialReadings', mergeGroqReadingOverrides(readings));
  });

  getRecentAlerts({ limit: 30 }, (alerts) => {
    socket.emit('initialAlerts', alerts);
  });

  socket.on('disconnect', () => {
    console.log('A client disconnected:', socket.id);
  });
});

const handleSensorData = (reading) => {
  console.log('Received sensor data:', reading);
  if (!dbReady) {
    console.warn('[Database] Skipping sensor data until schema is ready.');
    return;
  }
  storeReading(reading);
  if (reading.status === 'Normal' && reading.leak !== 1 && reading.theft !== 1) {
    latestGroqReadingByHouse.delete(reading.house_id);
  }
  io.emit('sensorUpdate', reading);
  maybeSendWhatsAppSensorAlerts(reading);
  maybeRunGroqSensorAnalysis(reading);

  // Auto-Alert Logic (Maintain in-memory history for /api/alerts)
  if (reading.leak === 1 || reading.theft === 1) {
    const type = reading.leak === 1 ? 'LEAK' : 'THEFT';
    const alert = {
      id: Date.now(),
      type,
      location: reading.house_id || 'Main Station',
      timestamp: new Date().toISOString(),
      status: 'Critical'
    };
    recentAlerts.unshift(alert);
    if (recentAlerts.length > 50) recentAlerts.pop();
  }
};

app.get('/api/status', (req, res) => {
  res.json({
    status: 'Online',
    message: 'Flow monitoring backend is streaming telemetry.',
    houses: houses.length,
    zones: zones.length,
    generatedAt: new Date().toISOString(),
  });
});

app.get('/api/network', (req, res) => {
  res.json(getNetworkSnapshot());
});

app.get('/api/zones', (req, res) => {
  res.json(
    zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      areaLabel: zone.areaLabel,
      description: zone.description,
      tank: zone.tank,
      houseCount: zone.houses.length,
    })),
  );
});

app.get('/api/readings/latest', (req, res) => {
  getLatestReadings((readings) => {
    res.json(mergeGroqReadingOverrides(readings));
  });
});

app.get('/api/readings/history', (req, res) => {
  const houseId = String(req.query.houseId || '').trim();
  const limit = Number(req.query.limit || 24);

  if (!houseId) {
    res.status(400).json({ error: 'houseId query parameter is required.' });
    return;
  }

  getReadingHistory({ houseId, limit }, (rows) => {
    res.json(rows);
  });
});

app.get('/api/stats', (req, res) => {
  getHouseStats((stats) => {
    res.json(stats);
  });
});

app.post('/api/ai-suggestions', async (req, res) => {
  if (!groqReady) {
    return res.status(500).json({ error: 'Groq is not configured. Set GROQ_API_KEY in server/.env.' });
  }

  const { physicalNode, totalDemand, anomalyCount, networkZones } = req.body;

  try {
    const prompt = `You are an AI Smart City Water Infrastructure Analyst.
The current live telemetry from the main physical hardware sensor (House 1) is:
- Flow Rate: ${physicalNode?.flow_rate || 0} L/min
- Pressure: ${physicalNode?.pressure || 0} kPa
- Status: ${physicalNode?.status || 'Offline'}

Global Network Stats:
- Total Demand: ${totalDemand || 0} L/min
- Active Anomalies: ${anomalyCount || 0}

Generate exactly 2 highly actionable, technical infrastructure insights based ONLY on this current real-time data.
Return ONLY a valid JSON object with a single key "suggestions" containing an array of 2 objects.
Each object must have:
"title" (string, short 3-5 word summary)
"description" (string, 2-3 sentence technical business/engineering recommendation)
"icon" (string, must be precisely one of: "BrainCircuit", "AlertTriangle", "Droplet")

If the physical flow matches 0.00 L/min, immediately suggest dispatching a field technician to inspect the primary valve or pump. If flow is high/normal, suggest pressure optimization or routing.`;

    if (typeof fetch !== 'function') {
      throw new Error('Global fetch is not available. Please use Node 18+.');
    }
    const completion = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: getGroqModel(),
        messages: [{ role: 'system', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!completion.ok) {
      const err = await completion.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Groq request failed.');
    }

    const data = await completion.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    res.json(parsed.suggestions);
  } catch (error) {
    console.error('Groq Error:', error.message);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

app.post('/api/ai-analysis', async (req, res) => {
  if (!groqReady) {
    return res.status(500).json({ error: 'Groq is not configured. Set GROQ_API_KEY in server/.env.' });
  }

  const {
    currentFlow,
    currentFlow1,
    currentFlow2,
    lastReadings,
    baseline,
    zone,
    time,
    alerts,
  } = req.body || {};

  if (
    currentFlow === undefined &&
    (!Array.isArray(lastReadings) || lastReadings.length === 0) &&
    baseline === undefined
  ) {
    return res.status(400).json({ error: 'Sensor data payload is empty or invalid.' });
  }

  try {
    const prompt = `Analyze water flow sensor data. 
Crucially: There are two flow meters. "Current Flow 1" is the input, and "Current Flow 2" is the output. 
If Flow 1 is significantly higher than Flow 2, it indicates a leak or water theft between the meters. A small discrepancy indicates a leak, while a large discrepancy indicates theft. Mention this in your analysis if true.

Input:

* Current Flow 1 (Input): ${currentFlow1} L/m
* Current Flow 2 (Output): ${currentFlow2} L/m
* Total Current Flow: ${currentFlow} L/m
* Last readings: ${JSON.stringify(lastReadings)}
* Baseline: ${baseline}
* Zone: ${zone}
* Time: ${time}
* Alerts: ${JSON.stringify(alerts)}

Return ONLY JSON:

{
"status": "",
"anomaly": "",
"leakProbability": "",
"cause": "",
"prediction": "",
"action": "",
"confidence": ""
}

Keep answers short and clear.`;

    if (typeof fetch !== 'function') {
      throw new Error('Global fetch is not available. Please use Node 18+.');
    }
    const completion = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: getGroqModel(),
        messages: [{ role: 'system', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!completion.ok) {
      const err = await completion.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Groq request failed.');
    }

    const data = await completion.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    const responsePayload = {
      status: parsed.status || '',
      anomaly: parsed.anomaly || '',
      leakProbability: parsed.leakProbability || '',
      cause: parsed.cause || '',
      prediction: parsed.prediction || '',
      action: parsed.action || '',
      confidence: parsed.confidence || '',
    };

    res.json(responsePayload);
  } catch (error) {
    const detailedMessage =
      error?.error?.message ||
      error?.response?.data?.error?.message ||
      error?.message ||
      'Failed to generate AI analysis.';
    console.error('AI Analysis Error:', detailedMessage);
    res.status(500).json({ error: detailedMessage });
  }
});

app.post('/api/ai-forecasting', async (req, res) => {
  if (!groqReady) return res.status(500).json({ error: 'Groq is not configured. Set GROQ_API_KEY in server/.env.' });
  const { stats, totalDemand } = req.body;
  try {
    const prompt = `You are a predictive maintenance AI.
Accumulated flow stats: ${JSON.stringify(stats)}
Current Network Demand: ${totalDemand} L/min

Return a JSON object with:
"forecast_demand_lpm": (number, predicted peak demand considering network topology, make it realistic)
"maintenance_suggestions": array of objects with { "house_id", "reason", "urgency" (High, Medium, Low) }
Focus on stations with highest cumulative flow or fault count for predictions.`;
    if (typeof fetch !== 'function') {
      throw new Error('Global fetch is not available. Please use Node 18+.');
    }
    const completion = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: getGroqModel(),
        messages: [{ role: 'system', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });
    if (!completion.ok) {
      const err = await completion.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Groq request failed.');
    }
    const data = await completion.json();
    res.json(JSON.parse(data.choices[0].message.content));
  } catch (error) { res.status(500).json({ error: 'Failed to forecast' }); }
});

app.post('/api/ai-footprint', async (req, res) => {
  if (!groqReady) return res.status(500).json({ error: 'Groq is not configured. Set GROQ_API_KEY in server/.env.' });
  const {
    screenTimeHours,
    streamingHours,
    aiQueries,
    socialMediaHours,
    netflixHours,
  } = req.body || {};

  const WATER_COEFFICIENTS = {
    streamingPerHour: 0.5,
    aiQuery: 0.7,
    screenTimePerHour: 0.2,
    socialMediaPerHour: 0.3,
  };

  const safeStreaming = Number(streamingHours ?? netflixHours ?? 0);
  const safeScreenTime = Number(screenTimeHours ?? 0);
  const safeAiQueries = Number(aiQueries ?? 0);
  const safeSocial = Number(socialMediaHours ?? 0);

  const totalWater =
    safeStreaming * WATER_COEFFICIENTS.streamingPerHour +
    safeAiQueries * WATER_COEFFICIENTS.aiQuery +
    safeScreenTime * WATER_COEFFICIENTS.screenTimePerHour +
    safeSocial * WATER_COEFFICIENTS.socialMediaPerHour;

  try {
    const prompt = `You are an environmental sustainability assistant.

A user has consumed ${totalWater.toFixed(1)} liters of water indirectly through digital activity today.

Your task:
Suggest a combination of real-world actions that can offset this water usage.

Available actions and their water savings:
- Reduce shower by 1 minute = 7.5 liters saved
- Turn off tap while brushing = 6 liters saved
- Use bucket instead of shower once = 20 liters saved
- Reduce video streaming quality for 1 hour = 3 liters saved
- Batch AI queries instead of repeated usage = 2 liters saved

Rules:
- Match or exceed the total water usage
- Combine multiple actions if needed
- Keep suggestions practical and realistic
- Output must be structured JSON

Return format:
{
  "summary": "short explanation",
  "actions": [
    {
      "action": "text",
      "waterSaved": number
    }
  ],
  "totalOffset": number
}`;

    if (typeof fetch !== 'function') {
      throw new Error('Global fetch is not available. Please use Node 18+.');
    }
    const completion = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });
    const rawText = await completion.text();
    if (!completion.ok) {
      const parsedError = safeParseJson(rawText);
      const errorMessage =
        parsedError?.error?.message ||
        parsedError?.error ||
        rawText ||
        'Groq request failed.';
      throw new Error(errorMessage);
    }
    const envelope = safeParseJson(rawText);
    const raw = envelope?.choices?.[0]?.message?.content || rawText;
    const parsed = safeParseJson(raw);
    if (!parsed) {
      throw new Error('Failed to parse Groq JSON response.');
    }
    const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
    const totalOffset = Number(parsed.totalOffset ?? actions.reduce((sum, item) => sum + Number(item.waterSaved || 0), 0));
    res.json({
      summary: parsed.summary || 'Offset plan generated.',
      actions,
      totalOffset,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed' });
  }
});
app.post('/api/rag/ingest', upload.single('file'), async (req, res) => {
  if (!isHFReady()) {
    return res.status(500).json({ error: 'HF_TOKEN is not configured. Set it in server/.env' });
  }
  try {
    let text = '';
    if (req.file) {
      const fs = require('fs');
      if (req.file.mimetype === 'application/pdf') {
        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(req.file.path);
        const pdfData = await pdfParse(dataBuffer);
        text = pdfData.text;
      } else {
        text = fs.readFileSync(req.file.path, 'utf8');
      }
      fs.unlinkSync(req.file.path); // clean up
    } else if (req.body.text) {
      text = req.body.text;
    } else {
      return res.status(400).json({ error: 'No file or text provided' });
    }

    const chunksAdded = await ingestDocument(text, { filename: req.file?.originalname || 'text-input' });
    res.json({ message: `Successfully ingested ${chunksAdded} chunks into knowledge base.` });
  } catch (error) {
    console.error('Ingest error:', error);
    res.status(500).json({ error: 'Failed to ingest document' });
  }
});

app.post('/api/aquabot', async (req, res) => {
  if (!groqReady) return res.status(500).json({ error: 'Groq is not configured. Set GROQ_API_KEY in server/.env.' });
  const { message, context } = req.body;
  try {
    // RAG Search
    const relevantChunks = await searchSimilar(message, 3);
    const contextFromStore = relevantChunks.length > 0 
      ? `\n\nKnowledge Base:\n${relevantChunks.map((c, i) => `[${i+1}] ${c}`).join('\n')}`
      : '';

    const live = context?.liveReadings || {};
    const liveSection = Object.keys(live).length > 0
      ? `\n\n🔴 LIVE ARDUINO SENSOR READINGS (real-time, from hardware):\n` +
        `  • Flow Sensor 1: ${live.flow1 ?? 'N/A'} L/min\n` +
        `  • Flow Sensor 2: ${live.flow2 ?? 'N/A'} L/min\n` +
        `  • Humidity: ${live.humidity ?? 'N/A'}%\n` +
        `  • Leak Detection: ${live.leak ?? 'N/A'}\n` +
        `  • Theft Detection: ${live.theft ?? 'N/A'}\n` +
        `  • TDS (water quality): ${live.tds ?? 'N/A'} ppm\n` +
        `  • Water Level: ${live.waterLevel ?? 'N/A'}%\n` +
        `  • System Status: ${live.status ?? 'N/A'}\n` +
        `  • Buzzer: ${live.buzzer ?? 'N/A'}\n` +
        `  • Water Health: ${live.waterHealth ?? 'N/A'}`
      : '';

    const networkSection = context?.totalDemand !== undefined
      ? `\n\n📡 NETWORK OVERVIEW:\n  • Total Demand: ${context.totalDemand?.toFixed?.(2) ?? context.totalDemand} L/min\n  • Active Anomalies: ${context.anomalyCount ?? 0}`
      : '';

    const prompt = `You are AquaBot, an expert AI assistant for the Smart Indore water monitoring platform.
You have access to real-time live sensor data from Arduino hardware nodes.${liveSection}${networkSection}${contextFromStore}

User question: "${message}"

Instructions:
- Answer in clear, concise English (2-4 sentences max).
- If the question is about sensor readings, use the LIVE DATA above for an accurate, specific answer.
- If a leak or theft is DETECTED, flag it with urgency.
- If knowledge base context is available, use it to supplement your answer.
- Be warm and professional.`;
    if (typeof fetch !== 'function') {
      throw new Error('Global fetch is not available. Please use Node 18+.');
    }
    const completion = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: getGroqModel(),
        messages: [{ role: 'system', content: prompt }],
      }),
    });
    if (!completion.ok) {
      const err = await completion.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Groq request failed.');
    }
    const data = await completion.json();
    res.json({ reply: data.choices[0].message.content });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
app.get('/api/alerts', (req, res) => {
  res.json(recentAlerts);
});

app.post('/api/alerts', (req, res) => {
  const { type, location, status } = req.body;
  const alert = {
    id: Date.now(),
    type: type || 'AI_ANOMALY',
    location: location || 'Network Analysis',
    timestamp: new Date().toISOString(),
    status: status || 'Detected'
  };
  recentAlerts.unshift(alert);
  if (recentAlerts.length > 50) recentAlerts.pop();
  
  // Also send WhatsApp if it's a leak or high priority
  if (type === 'LEAK' || type === 'THEFT') {
    sendWhatsAppMessage(reportConfig.whatsappNumber, `🤖 *AI DETECTED ALERT*\nType: ${type}\nStatus: ${status}\nLocation: ${location}`);
  }
  
  res.json({ success: true, alert });
});

app.post('/api/whatsapp/report', async (req, res) => {
  // Manual trigger
  const success = await sendWhatsAppMessage(reportConfig.whatsappNumber, "🔔 *Manual Report Request*\nEverything is running smoothly in your water network.");
  res.json({ ok: success });
});

app.get('/api/reports/config', (req, res) => {
  res.json(reportConfig);
});

app.post('/api/reports/schedule', (req, res) => {
  const { dayOfWeek, hour, minute, whatsappNumber } = req.body;
  if (dayOfWeek !== undefined) reportConfig.dayOfWeek = dayOfWeek;
  if (hour !== undefined) reportConfig.hour = hour;
  if (minute !== undefined) reportConfig.minute = minute;
  if (whatsappNumber !== undefined) reportConfig.whatsappNumber = whatsappNumber;
  
  scheduleWeeklyReport();
  res.json({ message: 'Schedule updated successfully', config: reportConfig });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});



