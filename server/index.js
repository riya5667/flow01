const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { initDb, storeReading, getLatestReadings, getReadingHistory, getHouseStats, getRecentAlerts } = require('./db');
const { getHardwareStatus, setupHardware } = require('./hardware');
const { getNetworkSnapshot, houses, zones } = require('./network');
const { sendLeakAlert, sendWaterReport } = require('./whatsapp');

// Keep track of the last time an alert was sent for each node to prevent spamming.
const lastAlerts = {};
const ALERT_COOLDOWN_MS = 20000; // 20 seconds

const toFiniteNumber = (value) => {
  const numeric = Number(String(value ?? '').replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
};

const getAlertKey = (reading = {}) =>
  String(reading.house_id || reading.houseId || reading.zone || reading.zoneName || 'global');

const shouldAlertForReading = (reading = {}) => {
  const status = String(reading.status || '').toLowerCase();
  const flowRate = toFiniteNumber(reading.flow_rate ?? reading.flowRate);
  const pressure = toFiniteNumber(reading.pressure);
  const vibration = toFiniteNumber(reading.vibration);
  const humidity = toFiniteNumber(reading.humidity);
  const flow1 = toFiniteNumber(reading.flow1);
  const flow2 = toFiniteNumber(reading.flow2);

  return (
    vibration === 1 ||
    (humidity !== null && humidity > Number(process.env.HUMIDITY_ALERT_THRESHOLD || 75)) ||
    (flow1 !== null && flow2 !== null && flow1 <= 0.05 && flow2 <= 0.05) ||
    status.includes('leak') ||
    status.includes('abnormal') ||
    status.includes('error') ||
    status.includes('no flow') ||
    status.includes('vibration') ||
    status.includes('humidity') ||
    status.includes('stopped') ||
    status.includes('pressure drop') ||
    (flowRate !== null && flowRate <= 0.35) ||
    (pressure !== null && pressure <= 8)
  );
};

const shouldAlertForAnalysis = ({ currentFlow, baseline, lastReadings, parsed }) => {
  const flowRate = toFiniteNumber(currentFlow);
  const baselineFlow = toFiniteNumber(baseline);
  const leakProbability = toFiniteNumber(parsed?.leakProbability);
  const status = String(parsed?.status || '').toLowerCase();
  const anomaly = String(parsed?.anomaly || '').toLowerCase();
  const previousFlow = Array.isArray(lastReadings) && lastReadings.length > 0
    ? toFiniteNumber(lastReadings[lastReadings.length - 1]?.flowRate ?? lastReadings[lastReadings.length - 1]?.flow_rate)
    : null;

  const dropFromBaseline =
    flowRate !== null && baselineFlow !== null && baselineFlow > 0 && flowRate < baselineFlow * 0.65;
  const suddenDrop =
    flowRate !== null && previousFlow !== null && previousFlow > 0 && flowRate < previousFlow * 0.7;

  return (
    status.includes('leak') ||
    anomaly.includes('leak') ||
    (leakProbability !== null && leakProbability > 70) ||
    dropFromBaseline ||
    suddenDrop ||
    (flowRate !== null && flowRate <= 0.35)
  );
};

const buildHeuristicAnalysis = ({ currentFlow, baseline, lastReadings, alerts, zone }) => {
  const flowRate = toFiniteNumber(currentFlow) ?? 0;
  const baselineFlow = toFiniteNumber(baseline);
  const previousFlow = Array.isArray(lastReadings) && lastReadings.length > 0
    ? toFiniteNumber(lastReadings[lastReadings.length - 1]?.flowRate ?? lastReadings[lastReadings.length - 1]?.flow_rate)
    : null;
  const activeAlerts = Array.isArray(alerts) ? alerts.length : 0;

  const dropFromBaseline =
    baselineFlow !== null && baselineFlow > 0 ? flowRate < baselineFlow * 0.65 : false;
  const suddenDrop =
    previousFlow !== null && previousFlow > 0 ? flowRate < previousFlow * 0.7 : false;
  const severeDrop =
    baselineFlow !== null && baselineFlow > 0
      ? Math.max(0, Math.round(((baselineFlow - flowRate) / baselineFlow) * 100))
      : flowRate <= 0.35
        ? 95
        : activeAlerts > 0
          ? 72
          : 18;

  if (flowRate <= 0.35 || dropFromBaseline || suddenDrop) {
    return {
      status: 'Leak suspected',
      anomaly: 'Yes',
      leakProbability: `${Math.min(99, Math.max(72, severeDrop))}%`,
      cause: flowRate <= 0.35 ? 'Near-zero flow detected.' : 'Flow dropped sharply from expected range.',
      prediction: `Leak risk is elevated for ${zone || 'the monitored zone'}.`,
      action: 'Inspect the line, valve, and meter immediately.',
      confidence: '84%',
    };
  }

  return {
    status: 'Normal',
    anomaly: 'None',
    leakProbability: `${Math.max(5, Math.min(35, severeDrop))}%`,
    cause: 'Flow is within the expected operating band.',
    prediction: `No immediate leak pattern detected for ${zone || 'the monitored zone'}.`,
    action: activeAlerts > 0 ? 'Continue monitoring active alerts.' : 'Continue routine monitoring.',
    confidence: '76%',
  };
};

const dispatchLeakAlert = (reading = {}) => {
  if (!shouldAlertForReading(reading)) {
    return false;
  }

  const now = Date.now();
  const key = getAlertKey(reading);
  const lastTime = lastAlerts[key] || 0;

  if (now - lastTime <= ALERT_COOLDOWN_MS) {
    return false;
  }

  lastAlerts[key] = now;
  sendLeakAlert(reading);
  return true;
};

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

io.on('connection', (socket) => {
  console.log('A client connected:', socket.id);

  getLatestReadings((readings) => {
    socket.emit('initialReadings', readings);
  });

  getRecentAlerts({ limit: 20 }, (alerts) => {
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
  io.emit('sensorUpdate', reading);

  if (Array.isArray(reading.alert_reasons) && reading.alert_reasons.length > 0) {
    reading.alert_reasons.forEach((message) => {
      io.emit('alertUpdate', {
        house_id: reading.house_id,
        type: reading.status,
        message,
        severity: 'critical',
        timestamp: reading.timestamp,
      });
    });
  }

  // Real-time alert: keep WhatsApp in sync with the same leak-like conditions the UI flags.
  dispatchLeakAlert(reading);

  // Broadcast global stats update for the "Total Flow" card
  getHouseStats((stats) => {
    io.emit('statsUpdate', stats);
  });
};

app.get('/api/status', (req, res) => {
  res.json({
    status: 'Online',
    message: 'Flow monitoring backend is streaming telemetry.',
    houses: houses.length,
    zones: zones.length,
    hardware: getHardwareStatus(),
    generatedAt: new Date().toISOString(),
  });
});

app.get('/api/hardware/status', (req, res) => {
  res.json(getHardwareStatus());
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
    res.json(readings);
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

app.get('/api/alerts/recent', (req, res) => {
  const limit = Number(req.query.limit || 30);
  getRecentAlerts({ limit }, (alerts) => {
    res.json(alerts);
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
- TDS: ${physicalNode?.tds || 0} ppm
- Water Health: ${physicalNode?.water_health || 'Unknown'}
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
  const {
    currentFlow,
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

  if (!groqReady) {
    const fallbackPayload = buildHeuristicAnalysis({ currentFlow, baseline, lastReadings, alerts, zone });
    if (shouldAlertForAnalysis({ currentFlow, baseline, lastReadings, parsed: fallbackPayload })) {
      dispatchLeakAlert({
        house_id: zone || 'Unknown',
        flow_rate: currentFlow,
        status: fallbackPayload.status,
      });
    }
    return res.json(fallbackPayload);
  }

  try {
    const prompt = `Analyze water flow sensor data.

Input:

* Current flow: ${currentFlow}
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

    // WhatsApp Trigger: if AI analysis confirms a high probability leak
    if (shouldAlertForAnalysis({ currentFlow, baseline, lastReadings, parsed })) {
      dispatchLeakAlert({
        house_id: zone || 'Unknown',
        flow_rate: currentFlow,
        status: parsed.status
      });
    }

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

app.post('/api/alerts/leak', (req, res) => {
  const {
    house_id,
    flow_rate,
    pressure,
    status,
    zone,
    reason,
  } = req.body || {};

  const alertReading = {
    house_id: house_id || zone || 'Unknown',
    flow_rate,
    pressure,
    status: status || reason || 'Leak suspected',
  };

  const sent = dispatchLeakAlert(alertReading);
  res.json({ ok: true, sent });
});

app.post('/api/whatsapp/report', (req, res) => {
  getHouseStats((stats) => {
    getRecentAlerts({ limit: 10 }, async (recentAlerts) => {
      try {
        const result = await sendWaterReport({
          stats,
          alerts: recentAlerts,
          generatedAt: new Date(),
        });
        res.json({ ok: !!result.ok, result });
      } catch (error) {
        console.error('[WhatsApp] Report failed:', error.message);
        res.status(500).json({ error: error.message || 'Failed to send WhatsApp report' });
      }
    });
  });
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
app.post('/api/aquabot', async (req, res) => {
  if (!groqReady) return res.status(500).json({ error: 'Groq is not configured. Set GROQ_API_KEY in server/.env.' });
  const { message, context } = req.body;
  try {
    const prompt = `You are AquaBot, an AI assistant for the Smart Indore water observatory.
Context: ${JSON.stringify(context)}
User says: "${message}"
Reply warmly, concisely, in French (as the dashboard is in French). Max 3 sentences.`;
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
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
