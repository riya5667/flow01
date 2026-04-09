"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Smartphone, Activity, Droplet, Zap, TrendingUp, CheckCircle2, Users } from 'lucide-react';
import WaterOffsetCard from './digital-footprint/WaterOffsetCard';

const WATER_COEFFICIENTS = {
  streamingPerHour: 0.5,
  aiQuery: 0.7,
  screenTimePerHour: 0.2,
  socialMediaPerHour: 0.3,
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

export default function DigitalFootprint() {
  const [streamingHours, setStreamingHours] = useState(2);
  const [socialMediaHours, setSocialMediaHours] = useState(3);
  const [aiQueries, setAiQueries] = useState(10);
  const [screenTimeHours, setScreenTimeHours] = useState(4);

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkedMap, setCheckedMap] = useState({});
  const [reminders, setReminders] = useState({});
  const [savedDays, setSavedDays] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('aquasense_offset_days');
      if (raw) setSavedDays(JSON.parse(raw));
      const reminderRaw = localStorage.getItem('aquasense_offset_reminders');
      if (reminderRaw) setReminders(JSON.parse(reminderRaw));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const totalWater = useMemo(() => {
    return Number(
      (
        streamingHours * WATER_COEFFICIENTS.streamingPerHour +
        aiQueries * WATER_COEFFICIENTS.aiQuery +
        screenTimeHours * WATER_COEFFICIENTS.screenTimePerHour +
        socialMediaHours * WATER_COEFFICIENTS.socialMediaPerHour
      ).toFixed(1),
    );
  }, [streamingHours, aiQueries, screenTimeHours, socialMediaHours]);

  const calculate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai-footprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenTimeHours, streamingHours, aiQueries, socialMediaHours }),
      });
      const raw = await res.text();
      const parsed = safeParseJson(raw);
      if (!res.ok) {
        const errorMessage = parsed?.error || raw || 'Failed to generate offset plan.';
        throw new Error(errorMessage);
      }
      if (!parsed) {
        throw new Error('Failed to parse offset plan response.');
      }
      setPlan(parsed);
      setCheckedMap({});
    } catch (e) {
      console.error(e);
      setError(e.message || 'Failed to generate offset plan.');
    } finally {
      setLoading(false);
    }
  };

  const toggleChecked = (idx) => {
    setCheckedMap((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleReminder = (idx) => {
    setReminders((prev) => {
      const next = { ...prev, [idx]: !prev[idx] };
      localStorage.setItem('aquasense_offset_reminders', JSON.stringify(next));
      return next;
    });
  };

  const checkedOffset = useMemo(() => {
    if (!plan?.actions?.length) return 0;
    return plan.actions.reduce((sum, item, idx) => sum + (checkedMap[idx] ? Number(item.waterSaved || 0) : 0), 0);
  }, [plan, checkedMap]);

  const saveToday = () => {
    const today = new Date().toISOString().slice(0, 10);
    const entry = {
      date: today,
      totalWater,
      totalOffset: checkedOffset,
    };
    const filtered = savedDays.filter((item) => item.date !== today);
    const next = [...filtered, entry].slice(-14);
    setSavedDays(next);
    localStorage.setItem('aquasense_offset_days', JSON.stringify(next));
  };

  const weeklyTotal = useMemo(() => {
    const cutoff = Date.now() - 6 * 24 * 60 * 60 * 1000;
    return savedDays
      .filter((item) => new Date(item.date).getTime() >= cutoff)
      .reduce((sum, item) => sum + (item.totalOffset || 0), 0);
  }, [savedDays]);

  const weeklyTrend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, idx) => {
      const date = new Date(Date.now() - (6 - idx) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const item = savedDays.find((entry) => entry.date === date);
      return item ? item.totalOffset : 0;
    });
    return days;
  }, [savedDays]);

  const streak = useMemo(() => {
    let count = 0;
    for (let i = 0; i < 14; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      if (savedDays.find((entry) => entry.date === date)) {
        count += 1;
      } else {
        break;
      }
    }
    return count;
  }, [savedDays]);

  const communityAverage = 12.5;
  const comparedToAverage = totalWater - communityAverage;

  const equivalents = [
    { label: 'Buckets of water', value: (totalWater / 10).toFixed(1) },
    { label: 'Shower minutes', value: (totalWater / 7.5).toFixed(1) },
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 md:p-8 flex flex-col gap-8 w-full max-w-5xl mx-auto mt-4">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-sm">
          <Smartphone size={24} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Digital Footprint Offset Planner</h2>
          <p className="text-sm text-slate-500">Measure your digital water usage and offset it with real-world actions.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8">
        <div className="flex flex-col gap-6">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-2xl shadow-sm">
              {error}
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
              <Droplet size={14} className="text-blue-600" />
              Inputs
            </div>
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700 flex justify-between">
                  <span>Streaming Hours</span>
                  <span className="text-blue-600">{streamingHours} h</span>
                </label>
                <input type="range" min="0" max="10" value={streamingHours} onChange={(e) => setStreamingHours(Number(e.target.value))} className="w-full accent-blue-600" />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700 flex justify-between">
                  <span>Social Media Hours</span>
                  <span className="text-blue-600">{socialMediaHours} h</span>
                </label>
                <input type="range" min="0" max="10" value={socialMediaHours} onChange={(e) => setSocialMediaHours(Number(e.target.value))} className="w-full accent-blue-600" />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700 flex justify-between">
                  <span>AI Queries</span>
                  <span className="text-blue-600">{aiQueries}</span>
                </label>
                <input type="range" min="0" max="100" value={aiQueries} onChange={(e) => setAiQueries(Number(e.target.value))} className="w-full accent-blue-600" />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700 flex justify-between">
                  <span>Screen Time Hours</span>
                  <span className="text-blue-600">{screenTimeHours} h</span>
                </label>
                <input type="range" min="0" max="12" value={screenTimeHours} onChange={(e) => setScreenTimeHours(Number(e.target.value))} className="w-full accent-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500">Total digital water usage</div>
              <div className="text-2xl font-semibold text-slate-900">{totalWater} L</div>
            </div>
            <p className="text-xs text-slate-400 mt-2">Calculated using verified coefficients.</p>
          </div>

          <button
            onClick={calculate}
            disabled={loading}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-2xl transition-all shadow-lg flex justify-center items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Activity size={18} />}
            Generate Offset Plan
          </button>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500">Weekly Offset Progress</div>
              <button onClick={saveToday} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                Save today
              </button>
            </div>
            <div className="flex items-center gap-3">
              <TrendingUp size={18} className="text-emerald-500" />
              <div className="text-2xl font-semibold text-slate-900">{weeklyTotal.toFixed(1)} L</div>
              <span className="text-xs text-slate-400">last 7 days</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle2 size={14} className="text-emerald-500" />
              Streak: {streak} days
            </div>
            <div className="mt-2 h-10 bg-slate-50 rounded-xl flex items-end gap-1 px-2 pb-2">
              {weeklyTrend.map((val, idx) => (
                <div key={`trend-${idx}`} className="flex-1 bg-blue-500/60 rounded-sm" style={{ height: `${Math.max(8, val * 2)}px` }} />
              ))}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
              <Users size={14} className="text-blue-600" />
              Community benchmark
            </div>
            <p className="text-sm text-slate-700">
              You are {comparedToAverage > 0 ? `${comparedToAverage.toFixed(1)}L above` : `${Math.abs(comparedToAverage).toFixed(1)}L below`} the community average ({communityAverage}L).
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Real-world equivalents</div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-700">
              {equivalents.map((item) => (
                <div key={item.label} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="text-lg font-semibold text-slate-900">{item.value}</div>
                  <div className="text-xs text-slate-500">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <WaterOffsetCard
            totalWater={totalWater}
            plan={plan}
            checkedMap={checkedMap}
            onToggle={toggleChecked}
            reminders={reminders}
            onToggleReminder={toggleReminder}
            checkedOffset={checkedOffset}
          />
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800 flex items-start gap-2">
            <Zap size={18} />
            Offset actions are designed to be practical and matched to your daily usage.
          </div>
        </div>
      </div>
    </div>
  );
}
