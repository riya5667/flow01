const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { initDb, storeReading, getLatestReadings, getReadingHistory, getHouseStats } = require('./db');
const { setupHardware } = require('./hardware');
const { getNetworkSnapshot, houses, zones } = require('./network');

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

initDb();

io.on('connection', (socket) => {
  console.log('A client connected:', socket.id);

  getLatestReadings((readings) => {
    socket.emit('initialReadings', readings);
  });

  socket.on('disconnect', () => {
    console.log('A client disconnected:', socket.id);
  });
});

const handleSensorData = (reading) => {
  console.log('Received sensor data:', reading);
  storeReading(reading);
  io.emit('sensorUpdate', reading);
};

setupHardware(handleSensorData);

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



