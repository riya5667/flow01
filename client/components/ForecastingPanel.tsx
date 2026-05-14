"use client";
import React, { useState, useEffect } from 'react';
import { Loader2, TrendingUp, AlertTriangle, CalendarCheck } from 'lucide-react';

export default function ForecastingPanel({ totalDemand }: { totalDemand: number }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const fetchForecast = async () => {
    setLoading(true);
    try {
      // First get stats from backend
      const statsRes = await fetch('/api/stats');
      const stats = await statsRes.json();

      const res = await fetch('/api/ai-forecasting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats, totalDemand })
      });
      const forecastData = await res.json();
      setData(forecastData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, [totalDemand]);

  return (
    <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-[1.05fr_1fr]">
      <div className="panel-shell flex min-h-[420px] flex-col gap-5 p-6">
        <div className="flex items-center gap-3 border-b border-slate-200/70 pb-4">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="eyebrow">Demand Model</p>
            <h3 className="panel-title">AI demand forecast</h3>
          </div>
          {loading && <Loader2 size={16} className="animate-spin text-slate-400 ml-auto" />}
        </div>
        
        <div className="flex flex-1 flex-col items-center justify-center rounded-[1.5rem] border border-slate-200/70 bg-white/62 p-6 text-center shadow-inner">
          {data ? (
            <div className="flex flex-col items-center text-center gap-2 animate-in fade-in zoom-in duration-500">
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-[0.18em]">Expected peak demand</span>
              <div className="font-display text-6xl font-black tracking-tighter text-slate-950">
                {data.forecast_demand_lpm} <span className="text-2xl font-bold text-cyan-600">L/m</span>
              </div>
              <p className="mt-3 max-w-md rounded-2xl border border-cyan-100 bg-cyan-50/70 px-4 py-3 text-sm leading-6 text-slate-600">
                Demand is expected to rise based on historical patterns and current network trends.
              </p>
            </div>
          ) : (
             <span className="text-sm font-semibold text-slate-400">Generating forecasts...</span>
          )}
        </div>
      </div>

      <div className="panel-shell flex min-h-[420px] flex-col gap-5 p-6">
        <div className="flex items-center gap-3 border-b border-slate-200/70 pb-4">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-amber-700">
            <CalendarCheck size={20} />
          </div>
          <div>
            <p className="eyebrow">Maintenance</p>
            <h3 className="panel-title">Predictive worklist</h3>
          </div>
        </div>
        
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
          {data?.maintenance_suggestions ? (
            data.maintenance_suggestions.map((suggestion: any, idx: number) => (
              <div key={idx} className="flex gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <AlertTriangle size={20} className="mt-0.5 shrink-0 text-rose-600" />
                <div className="flex flex-col gap-1 text-sm">
                   <div className="flex justify-between items-center">
                     <span className="font-bold text-slate-800 uppercase text-xs">{suggestion.house_id}</span>
                     <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase text-rose-700">
                       Urgency: {suggestion.urgency}
                     </span>
                   </div>
                   <p className="text-slate-600 text-xs">{suggestion.reason}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="flex h-full items-center justify-center rounded-[1.5rem] border border-dashed border-slate-200 bg-white/60 text-sm font-semibold text-slate-400">
              {loading ? "Analyzing wear patterns..." : "No maintenance suggestions at this time."}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
