'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  BrainCircuit,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Droplet,
  ShieldAlert,
  Activity,
} from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import sampleAIData from '../utils/sampleAIData';

const buildLastReadings = (readings) =>
  readings.map((reading) => ({
    houseId: reading.house_id,
    flowRate: reading.flow_rate,
    pressure: reading.pressure,
    status: reading.status,
    time: reading.timestamp || reading.time || reading.created_at || null,
  }));

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const formatNumber = (value, digits = 1) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Number(value).toFixed(digits);
};

const getSeverity = (value, key) => {
  if (value === null || value === undefined || value === '') {
    return 'unknown';
  }

  const text = String(value).toLowerCase();

  if (key === 'leakProbability') {
    const numeric = Number(String(value).replace(/[^0-9.]/g, ''));
    if (!Number.isNaN(numeric)) {
      if (numeric >= 70) return 'critical';
      if (numeric >= 35) return 'warning';
      return 'normal';
    }
  }

  if (text.includes('critical') || text.includes('severe') || text.includes('urgent') || text.includes('leak')) {
    return 'critical';
  }
  if (text.includes('warning') || text.includes('watch') || text.includes('elevated') || text.includes('possible')) {
    return 'warning';
  }
  if (text.includes('normal') || text.includes('stable') || text.includes('ok') || text.includes('healthy')) {
    return 'normal';
  }

  return 'unknown';
};

const severityStyles = {
  normal: {
    border: 'border-emerald-200',
    background: 'bg-emerald-50/60',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  warning: {
    border: 'border-amber-200',
    background: 'bg-amber-50/60',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    icon: AlertTriangle,
  },
  critical: {
    border: 'border-red-200',
    background: 'bg-red-50/60',
    text: 'text-red-700',
    dot: 'bg-red-500',
    icon: AlertTriangle,
  },
  unknown: {
    border: 'border-slate-200',
    background: 'bg-slate-50',
    text: 'text-slate-600',
    dot: 'bg-slate-400',
    icon: BrainCircuit,
  },
};

const fieldLabels = [
  { key: 'status', label: 'Status' },
  { key: 'anomaly', label: 'Anomaly' },
  { key: 'leakProbability', label: 'Leak Probability' },
  { key: 'cause', label: 'Cause' },
  { key: 'prediction', label: 'Prediction' },
  { key: 'action', label: 'Action' },
  { key: 'confidence', label: 'Confidence' },
];

const buildSparkPath = (values, width, height) => {
  if (!values.length) return '';
  const max = Math.max(...values);
  const min = Math.min(...values);
  const dx = width / (values.length - 1 || 1);
  const scale = max === min ? 0 : height / (max - min);

  return values
    .map((value, index) => {
      const x = index * dx;
      const y = height - (value - min) * scale;
      return `${index === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
};

const parsePercent = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value <= 1 ? value * 100 : value;
  const numeric = Number(String(value).replace(/[^0-9.]/g, ''));
  if (Number.isNaN(numeric)) return null;
  return numeric <= 1 ? numeric * 100 : numeric;
};

export default function AIAnalysis() {
  const { network, readings, isLoading } = useSocket();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [usingSample, setUsingSample] = useState(false);
  const [history, setHistory] = useState([]);
  const [showLeakToast, setShowLeakToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const currentReadings = useMemo(() => Object.values(readings || {}), [readings]);
  const primaryReading = currentReadings.find((reading) => reading.house_id === 'house_1') || currentReadings[0];
  const baseline = useMemo(() => {
    if (!currentReadings.length) return null;
    const total = currentReadings.reduce((sum, reading) => sum + (reading.flow_rate || 0), 0);
    return Number((total / currentReadings.length).toFixed(2));
  }, [currentReadings]);

  const hasData = Boolean(primaryReading && network?.zones?.length);
  const fallbackFlow = sampleAIData.currentFlow;
  const liveFlow = hasData ? primaryReading?.flow_rate ?? 0 : fallbackFlow;

  useEffect(() => {
    const initial = Array.from({ length: 30 }, (_, idx) => {
      const base = liveFlow || fallbackFlow || 10;
      const jitter = Math.sin(idx / 4) * 1.2 + (Math.random() - 0.5) * 0.8;
      return Number((base + jitter).toFixed(2));
    });
    setHistory(initial);
  }, []);

  useEffect(() => {
    if (hasData) {
      setHistory((prev) => [...prev.slice(-59), Number((liveFlow || 0).toFixed(2))]);
      return undefined;
    }

    const interval = setInterval(() => {
      setHistory((prev) => {
        const base = prev[prev.length - 1] ?? fallbackFlow ?? 10;
        const jitter = (Math.random() - 0.5) * 1.6;
        return [...prev.slice(-59), Number((base + jitter).toFixed(2))];
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [hasData, liveFlow, fallbackFlow]);

  const deviation = baseline ? ((liveFlow - baseline) / baseline) * 100 : 0;
  const riskLevel = Math.abs(deviation) > 50 ? 'High' : Math.abs(deviation) > 20 ? 'Medium' : 'Low';
  const trendUp = history.length > 1 && history[history.length - 1] >= history[history.length - 2];
  const avgPressure = useMemo(() => {
    if (!currentReadings.length) return null;
    const total = currentReadings.reduce((sum, reading) => sum + (reading.pressure || 0), 0);
    return Number((total / currentReadings.length).toFixed(1));
  }, [currentReadings]);
  const minFlow = useMemo(() => {
    if (!currentReadings.length) return null;
    return Math.min(...currentReadings.map((reading) => reading.flow_rate || 0));
  }, [currentReadings]);
  const maxFlow = useMemo(() => {
    if (!currentReadings.length) return null;
    return Math.max(...currentReadings.map((reading) => reading.flow_rate || 0));
  }, [currentReadings]);
  const alertCount = useMemo(() => {
    return currentReadings.filter((reading) => reading.status && reading.status !== 'Normal').length;
  }, [currentReadings]);
  const zoneLabel = network?.zones?.[0]?.areaLabel || '—';

  const confidencePercent = clamp(parsePercent(result?.confidence ?? 0.82) ?? 82, 0, 100);
  const leakPercent = clamp(parsePercent(result?.leakProbability ?? Math.abs(deviation)) ?? 20, 0, 100);

  const aiSummary = result?.prediction
    ? `${result.prediction} ${result.action ? `Action: ${result.action}.` : ''}`
    : `Flow is ${Math.abs(deviation) < 15 ? 'stable' : 'volatile'} and ${Math.abs(deviation).toFixed(0)}% ${deviation >= 0 ? 'above' : 'below'} baseline. ${leakPercent > 50 ? 'Leak risk elevated.' : 'No leak patterns detected.'}`;

  const sparkPath = buildSparkPath(history.slice(-30), 280, 80);
  const alertItems = (result?.anomaly || '').toLowerCase().includes('yes')
    ? [`${new Date().toLocaleTimeString()} — Potential anomaly flagged (${Math.abs(deviation).toFixed(0)}%)`]
    : [];

  useEffect(() => {
    if (!baseline) return;
    const prev = history.length > 1 ? history[history.length - 2] : liveFlow;
    const dropFromBaseline = liveFlow < baseline * 0.65;
    const suddenDrop = prev > 0 && liveFlow < prev * 0.7;

    if (riskLevel !== 'High') {
      setShowLeakToast(false);
      return undefined;
    }

    if (riskLevel === 'High' && (dropFromBaseline || suddenDrop)) {
      const reason = dropFromBaseline ? 'Flow dropped below 65% of baseline.' : 'Sudden flow drop detected.';
      setToastMessage(`Leak detected. ${reason}`);
      setShowLeakToast(true);
      const timeout = setTimeout(() => setShowLeakToast(false), 5000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [liveFlow, baseline, history, riskLevel]);

  const handleRun = async () => {
    setError('');

    setIsRunning(true);
    try {
      const apiUrl = '/api';
      const payload = hasData
        ? {
            currentFlow: primaryReading?.flow_rate ?? null,
            lastReadings: buildLastReadings(currentReadings),
            baseline,
            zone: network?.zones?.[0]?.name || 'Unknown',
            time: new Date().toISOString(),
            alerts: currentReadings
              .filter((reading) => reading.status && reading.status !== 'Normal')
              .map((reading) => ({
                houseId: reading.house_id,
                status: reading.status,
                flowRate: reading.flow_rate,
                pressure: reading.pressure,
              })),
          }
        : sampleAIData;

      const response = await fetch(`${apiUrl}/ai-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(async () => {
          const text = await response.text().catch(() => '');
          return { error: text };
        });
        throw new Error(errorPayload.error || 'Failed to run AI analysis.');
      }

      const data = await response.json();
      setUsingSample(!hasData);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Something went wrong while running the analysis.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50/70 min-h-screen h-screen overflow-y-auto text-slate-900 relative">
      <div className="pointer-events-none absolute -top-32 right-[-120px] h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-[-120px] h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl" />
      {showLeakToast && (
        <div className="fixed top-6 right-6 z-50 bg-red-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-pulse">
          <AlertTriangle size={18} />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}
      <div className="max-w-[1280px] mx-auto px-6 md:px-8 py-10 pb-20 flex flex-col gap-8 relative">
        <header className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-lg">
                <BrainCircuit size={22} />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">AI Water Analysis</h1>
                <p className="text-sm text-slate-500">Live telemetry summarized into actionable risk signals.</p>
              </div>
            </div>
            <button
              onClick={handleRun}
              disabled={isRunning || isLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-900 text-white text-sm font-semibold shadow-lg hover:bg-slate-800 transition-colors disabled:opacity-60"
            >
              {isRunning ? <Loader2 size={16} className="animate-spin" /> : <BrainCircuit size={16} />}
              Run Analysis
            </button>
          </div>

          <div className="bg-white/80 border border-slate-200/70 rounded-2xl px-4 py-3 shadow-md flex flex-wrap items-center gap-5 backdrop-blur">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              Live Context
            </div>
            <div className="text-sm text-slate-600 flex items-center gap-2">
              <Droplet size={14} className="text-blue-500" />
              Current flow: <span className="font-semibold text-slate-800">{formatNumber(liveFlow, 1)}</span> L/m
            </div>
            <div className="text-sm text-slate-600">
              Baseline: <span className="font-semibold text-slate-800">{baseline ?? '—'}</span> L/m
            </div>
            <div className="text-sm text-slate-600">
              % Deviation: <span className="font-semibold text-slate-800">{formatNumber(deviation, 0)}%</span>
            </div>
            <div className="text-sm text-slate-600 flex items-center gap-2">
              Risk: <span className={`font-semibold ${riskLevel === 'High' ? 'text-red-600' : riskLevel === 'Medium' ? 'text-amber-600' : 'text-emerald-600'}`}>{riskLevel}</span>
            </div>
            <div className="text-sm text-slate-600 flex items-center gap-1">
              {trendUp ? <TrendingUp size={16} className="text-emerald-600" /> : <TrendingDown size={16} className="text-red-600" />}
              Trend
            </div>
            <div className="text-sm text-slate-600">
              Zone: <span className="font-semibold text-slate-800">{network?.zones?.[0]?.name || '—'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-3">
            <div className="flex flex-col gap-2">
              {error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-2xl shadow-sm">
                  {error}
                </div>
              )}
              {!hasData && !isLoading && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-2xl shadow-sm">
                  Waiting for live sensor data. Analysis will be available once readings are received.
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {result && (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-2xl shadow-sm">
                  Analysis updated at {new Date().toLocaleTimeString()}.
                </div>
              )}
              {usingSample && (
                <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-3 py-2 rounded-2xl shadow-sm">
                  Using sample data (safe to delete later).
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-6">
          <section className="bg-white border border-slate-200/70 rounded-3xl p-6 shadow-xl flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Live Analysis</p>
                <h2 className="text-lg font-semibold text-slate-800">Flow waveform</h2>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-800">{formatNumber(liveFlow, 1)} <span className="text-sm font-medium text-slate-500">L/m</span></p>
                <p className="text-xs text-slate-400">Current flow rate</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-100 rounded-2xl p-4 shadow-inner">
              <svg width="100%" height="120" viewBox="0 0 280 80" preserveAspectRatio="none">
                <path d={sparkPath} fill="none" stroke="#3b82f6" strokeWidth="2" />
                <path d={sparkPath} fill="none" stroke="#93c5fd" strokeWidth="6" opacity="0.15" />
              </svg>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-col gap-2 shadow-lg">
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">Flow Gauge</p>
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-16">
                    <svg width="64" height="64" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="26" stroke="#1f2937" strokeWidth="8" fill="none" />
                      <circle
                        cx="32"
                        cy="32"
                        r="26"
                        stroke={deviation > 50 ? '#ef4444' : deviation > 20 ? '#f59e0b' : '#10b981'}
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${clamp((Math.abs(deviation) / 80) * 164, 20, 164)} 999`}
                        transform="rotate(-90 32 32)"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                      {formatNumber(Math.abs(deviation), 0)}%
                    </span>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{riskLevel} risk</p>
                    <p className="text-xs text-white/60">Deviation vs baseline</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2 shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">AI Summary</p>
                <p className="text-sm text-slate-700 leading-relaxed">{aiSummary}</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2 shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Confidence</p>
                <div className="flex items-center gap-3">
                  <ShieldAlert size={18} className="text-indigo-500" />
                  <p className="text-2xl font-semibold text-slate-800">{confidencePercent}%</p>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 via-blue-500 to-indigo-500"
                    style={{ width: `${confidencePercent}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <div className="bg-white border border-slate-200/70 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">AI Status</p>
                  <h3 className="text-lg font-semibold text-slate-800">System verdict</h3>
                </div>
                <Activity size={18} className="text-emerald-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-2xl border ${severityStyles[getSeverity(result?.status, 'status')].border} ${severityStyles[getSeverity(result?.status, 'status')].background} p-3`}>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Status</p>
                  <p className={`text-sm font-semibold ${severityStyles[getSeverity(result?.status, 'status')].text}`}>
                    {result?.status || 'Normal'}
                  </p>
                </div>
                <div className={`rounded-2xl border ${severityStyles[getSeverity(result?.anomaly, 'anomaly')].border} ${severityStyles[getSeverity(result?.anomaly, 'anomaly')].background} p-3`}>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Anomaly</p>
                  <p className={`text-sm font-semibold ${severityStyles[getSeverity(result?.anomaly, 'anomaly')].text}`}>
                    {result?.anomaly || 'None'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wider text-slate-500">Leak</p>
                  <p className="text-sm font-semibold text-slate-800">{leakPercent}%</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wider text-slate-500">Prediction</p>
                  <p className="text-sm font-semibold text-slate-800">{result?.prediction || 'Stable'}</p>
                </div>
              </div>
              <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-lg">
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">Leak Probability</p>
                <div className="mt-3">
                  <svg width="100%" height="80" viewBox="0 0 180 90">
                    <path d="M10 80 A80 80 0 0 1 170 80" stroke="#1f2937" strokeWidth="10" fill="none" />
                    <path
                      d="M10 80 A80 80 0 0 1 170 80"
                      stroke={leakPercent > 60 ? '#ef4444' : leakPercent > 30 ? '#f59e0b' : '#10b981'}
                      strokeWidth="10"
                      fill="none"
                      strokeDasharray={`${(leakPercent / 100) * 251} 999`}
                    />
                  </svg>
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span>Low</span>
                    <span>High</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-lg flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Alerts</p>
                <AlertTriangle size={16} className="text-amber-500" />
              </div>
              {alertItems.length === 0 ? (
                <p className="text-sm text-slate-500">No anomalies in last 2 hours.</p>
              ) : (
                <div className="flex flex-col gap-2 text-sm text-slate-700">
                  {alertItems.map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 mt-2" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Location</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">{zoneLabel}</p>
            <p className="text-xs text-slate-500">Zone overview</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Avg Pressure</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">{avgPressure ?? '—'} kPa</p>
            <p className="text-xs text-slate-500">Across active nodes</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Flow Range</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">
              {formatNumber(minFlow, 1)} - {formatNumber(maxFlow, 1)} L/m
            </p>
            <p className="text-xs text-slate-500">Min / Max last update</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Active Alerts</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">{alertCount}</p>
            <p className="text-xs text-slate-500">Non-normal stations</p>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {fieldLabels.map((field) => {
            const value = result?.[field.key] || 'N/A';
            const severity = getSeverity(value, field.key);
            const styles = severityStyles[severity];
            const Icon = styles.icon;
            return (
              <div
                key={field.key}
                className={`rounded-2xl border ${styles.border} ${styles.background} p-4 shadow-sm flex flex-col gap-3 min-h-[140px] transition-transform duration-200 hover:-translate-y-1 hover:shadow-md`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${styles.dot}`} />
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">{field.label}</span>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                    <Icon size={16} className={styles.text} />
                  </div>
                </div>
                <p className={`text-sm font-semibold leading-relaxed ${styles.text}`}>{value}</p>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
