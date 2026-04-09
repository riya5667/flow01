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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl mx-auto mt-4">
      
      {/* Demand Forecasting Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <TrendingUp size={20} />
          </div>
          <h3 className="font-bold text-slate-800">AI Demand Forecast (24h)</h3>
          {loading && <Loader2 size={16} className="animate-spin text-slate-400 ml-auto" />}
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          {data ? (
            <div className="flex flex-col items-center text-center gap-2 animate-in fade-in zoom-in duration-500">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Expected Peak Demand</span>
              <div className="text-5xl font-black text-indigo-600 tracking-tighter">
                {data.forecast_demand_lpm} <span className="text-2xl text-indigo-400 font-bold">L/m</span>
              </div>
              <p className="text-sm text-slate-500 mt-2 bg-slate-50 px-4 py-2 border border-slate-100 rounded-lg">
                Demand is expected to rise based on historical patterns and current network trends.
              </p>
            </div>
          ) : (
             <span className="text-slate-400 text-sm">Generating forecasts...</span>
          )}
        </div>
      </div>

      {/* Predictive Maintenance Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
            <CalendarCheck size={20} />
          </div>
          <h3 className="font-bold text-slate-800">Predictive Maintenance</h3>
        </div>
        
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
          {data?.maintenance_suggestions ? (
            data.maintenance_suggestions.map((suggestion: any, idx: number) => (
              <div key={idx} className="flex gap-3 p-3 bg-red-50/50 border border-red-100 rounded-xl hover:shadow-sm transition-shadow">
                <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1 text-sm">
                   <div className="flex justify-between items-center">
                     <span className="font-bold text-slate-800 uppercase text-xs">{suggestion.house_id}</span>
                     <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                       Urgency: {suggestion.urgency}
                     </span>
                   </div>
                   <p className="text-slate-600 text-xs">{suggestion.reason}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="flex justify-center items-center h-full text-sm text-slate-400">
              {loading ? "Analyzing wear patterns..." : "No maintenance suggestions at this time."}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
