'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  Zap,
  Target,
  Waves
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
  const lastLeakAlertRef = useRef('');

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
      const alertKey = [
        primaryReading?.house_id || network?.zones?.[0]?.name || 'Unknown',
        Number(liveFlow || 0).toFixed(2),
        reason,
      ].join(':');

      setToastMessage(`Leak detected. ${reason}`);
      setShowLeakToast(true);

      if (lastLeakAlertRef.current !== alertKey) {
        lastLeakAlertRef.current = alertKey;
        fetch('/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'LEAK',
            location: primaryReading?.house_id || 'Main Network',
            status: 'AI Confirmed Critical',
            reason: reason
          }),
        }).catch((alertError) => {
          console.error('Failed to notify backend about leak alert', alertError);
        });
      }

      const timeout = setTimeout(() => setShowLeakToast(false), 5000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [liveFlow, baseline, history, riskLevel, network, primaryReading]);

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

      // Log to global alerts page if critical
      if (leakPercent > 70 || (data.anomaly && data.anomaly.toLowerCase().includes('yes'))) {
        fetch('/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'LEAK',
            location: 'Network Analysis (AI)',
            status: 'High Probability Detected',
            reason: data.cause || 'Anomalous flow pattern identified by AI'
          })
        }).catch(e => console.error('Alert log error', e));
      }
    } catch (err) {
      setError(err.message || 'Something went wrong while running the analysis.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-[#f8f9fa] min-h-screen h-screen overflow-y-auto text-slate-900 font-sans selection:bg-cyan-100 selection:text-cyan-900">
      {/* Decorative Blobs */}
      <div className="fixed top-[-10%] right-[-5%] w-[400px] h-[400px] bg-cyan-200/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[300px] h-[300px] bg-[#0f6f7a]/10 blur-[100px] rounded-full pointer-events-none" />

      {showLeakToast && (
        <div className="fixed top-6 right-6 z-50 bg-red-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right duration-300 ring-4 ring-red-500/20">
          <div className="bg-white/20 p-2 rounded-lg">
            <AlertTriangle size={20} className="animate-pulse" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-80">Critical Alert</p>
            <p className="text-sm font-bold">{toastMessage}</p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col gap-8 relative z-10">
        <header className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0f6f7a] to-[#38d4e8] text-white flex items-center justify-center shadow-xl shadow-cyan-900/10 ring-1 ring-white/20">
                <BrainCircuit size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">AI Intelligent Analysis</h1>
                <p className="text-slate-500 font-medium">Advanced neural network diagnostics for water infrastructure.</p>
              </div>
            </div>
            <button
              onClick={handleRun}
              disabled={isRunning || isLoading}
              className="group relative overflow-hidden inline-flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-slate-900 text-white text-sm font-bold shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              {isRunning ? <Loader2 size={18} className="animate-spin text-cyan-400" /> : <Zap size={18} className="text-cyan-400" />}
              {isRunning ? 'Analyzing Live Data...' : 'Run Neural Diagnostics'}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Live Flow', val: `${formatNumber(liveFlow, 1)} L/m`, icon: Droplet, color: 'text-cyan-600', bg: 'bg-cyan-50' },
              { label: 'Baseline', val: `${baseline ?? '—'} L/m`, icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { label: 'Deviation', val: `${formatNumber(deviation, 0)}%`, icon: Activity, color: deviation > 0 ? 'text-blue-600' : 'text-orange-600', bg: deviation > 0 ? 'bg-blue-50' : 'bg-orange-50' },
              { label: 'Risk Level', val: riskLevel, icon: ShieldAlert, color: riskLevel === 'High' ? 'text-red-600' : 'text-emerald-600', bg: riskLevel === 'High' ? 'bg-red-50' : 'bg-emerald-50' },
              { label: 'Trend', val: trendUp ? 'Increasing' : 'Decreasing', icon: trendUp ? TrendingUp : TrendingDown, color: trendUp ? 'text-emerald-600' : 'text-red-600', bg: 'bg-slate-50' },
              { label: 'Zone', val: network?.zones?.[0]?.name || 'Main', icon: Waves, color: 'text-slate-600', bg: 'bg-slate-50' },
            ].map((stat, i) => (
              <div key={i} className="bg-white/70 backdrop-blur-sm border border-slate-200/60 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-lg ${stat.bg} ${stat.color}`}>
                    <stat.icon size={14} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{stat.label}</span>
                </div>
                <p className={`text-sm font-bold ${stat.color}`}>{stat.val}</p>
              </div>
            ))}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8">
          <section className="space-y-6">
            <div className="bg-white border border-slate-200/80 rounded-[32px] overflow-hidden shadow-xl shadow-slate-200/40">
              <div className="p-8 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Telemetry Waveform</h3>
                  <p className="text-sm text-slate-500">Real-time flow signature analysis</p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black text-[#0f6f7a] tracking-tight">{formatNumber(liveFlow, 1)}</span>
                  <span className="ml-1 text-xs font-bold text-slate-400 uppercase">L/min</span>
                </div>
              </div>
              
              <div className="px-8 pb-8">
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 shadow-inner h-[180px] flex items-center justify-center">
                   <svg width="100%" height="100%" viewBox="0 0 280 80" preserveAspectRatio="none" className="drop-shadow-lg">
                    <defs>
                      <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#38d4e8" />
                        <stop offset="100%" stopColor="#0f6f7a" />
                      </linearGradient>
                    </defs>
                    <path d={sparkPath} fill="none" stroke="url(#lineGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d={sparkPath} fill="none" stroke="#0f6f7a" strokeWidth="8" opacity="0.1" />
                  </svg>
                </div>
                
                <div className="grid grid-cols-3 gap-6 mt-8">
                  <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-xl ring-1 ring-white/10">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/80 mb-3">Anomaly Meter</p>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 flex items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/20">
                        <Activity size={20} className="animate-pulse" />
                      </div>
                      <div>
                        <p className="text-lg font-black tracking-tight">{Math.abs(deviation).toFixed(0)}%</p>
                        <p className="text-[10px] font-medium text-white/50 uppercase">Deviation</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">AI Summary</p>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed italic">"{aiSummary}"</p>
                  </div>
                  
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">Confidence Score</p>
                    <div className="flex items-end gap-2 mb-2">
                      <p className="text-2xl font-black text-slate-800 tracking-tight">{confidencePercent}%</p>
                      <CheckCircle2 size={16} className="text-emerald-500 mb-1.5" />
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-400 to-[#0f6f7a]" style={{ width: `${confidencePercent}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fieldLabels.slice(0, 4).map((field) => {
                const value = result?.[field.key] || 'Awaiting Input';
                const severity = getSeverity(value, field.key);
                const styles = severityStyles[severity];
                return (
                  <div key={field.key} className={`bg-white border-l-4 ${styles.border} rounded-2xl p-5 shadow-sm flex flex-col gap-2`}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{field.label}</p>
                    <p className={`text-sm font-bold leading-relaxed ${styles.text}`}>{value}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="bg-white border border-slate-200/80 rounded-[32px] p-8 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800">System Verdict</h3>
                <Target size={20} className="text-cyan-600" />
              </div>
              
              <div className="space-y-6">
                <div className="relative pt-8 flex justify-center">
                   <svg width="200" height="100" viewBox="0 0 180 90">
                    <path d="M10 80 A80 80 0 0 1 170 80" stroke="#f1f5f9" strokeWidth="12" fill="none" strokeLinecap="round" />
                    <path
                      d="M10 80 A80 80 0 0 1 170 80"
                      stroke={leakPercent > 60 ? '#ef4444' : leakPercent > 30 ? '#f59e0b' : '#10b981'}
                      strokeWidth="12"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${(leakPercent / 100) * 251} 999`}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute top-[60px] text-center">
                    <p className="text-3xl font-black text-slate-800 tracking-tight">{leakPercent}%</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Leak Probability</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-5 space-y-4 border border-slate-100">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase">Primary Verdict</span>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${leakPercent > 50 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {leakPercent > 50 ? 'Action Required' : 'Optimal'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    Based on neural analysis of current flow vs historical baselines, {leakPercent > 50 ? 'the system has identified a potential anomaly that requires field inspection.' : 'your infrastructure is currently operating within expected efficiency margins.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-[32px] p-8 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800">AI Alerts</h3>
                <div className="p-2 bg-amber-50 rounded-lg">
                   <AlertTriangle size={18} className="text-amber-500" />
                </div>
              </div>
              
              <div className="space-y-3">
                {alertItems.length === 0 ? (
                  <div className="py-6 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                    <CheckCircle2 size={24} className="text-emerald-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-400">No active AI alerts</p>
                  </div>
                ) : (
                  alertItems.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-4 p-4 rounded-2xl bg-red-50 border border-red-100">
                      <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                      <p className="text-xs font-bold text-red-800 leading-relaxed">{item}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
