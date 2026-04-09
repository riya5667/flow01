'use client';

import { useSocket } from '../../hooks/useSocket';
import { useEffect, useRef, useState } from 'react';
import { SensorReading } from '../../utils/types';
import { Activity, BrainCircuit, Droplet, AlertTriangle, CheckCircle, PieChart } from 'lucide-react';

export default function HowItWorks() {
  const { readings, isConnected } = useSocket();
  const [logFeed, setLogFeed] = useState<SensorReading[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Buffer live readings for the feed
  useEffect(() => {
    if (!readings) return;
    // ONLY show real (non-mock) readings in the feed
    const currentReadings = Object.values(readings).filter(r => !r.is_mock);
    if (currentReadings.length === 0) return;

    setLogFeed(prev => {
      // Pick random a random reading that was just updated
      const packetSize = Math.floor(Math.random() * 2) + 1;
      const newPackets = currentReadings.sort(() => 0.5 - Math.random()).slice(0, packetSize);
      
      const newFeed = [...prev, ...newPackets];
      return newFeed.slice(-30); // Keep last 30 logs visible
    });
  }, [readings]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logFeed]);

  // Compute real-time analytics
  // ONLY use real (non-mock) readings for calculations
  const currentReadings = Object.values(readings || {}).filter(r => !r.is_mock);
  let totalSensors = currentReadings.length;
  let healthyCount = 0;
  let anomalyCount = 0;
  let totalFlow = 0;

  currentReadings.forEach(r => {
    totalFlow += (r.flow_rate || 0);
    if (r.status === 'Normal') healthyCount++;
    else anomalyCount++;
  });

  const healthyPercent = totalSensors > 0 ? Math.round((healthyCount / totalSensors) * 100) : 100;
  const anomalyPercent = totalSensors > 0 ? Math.round((anomalyCount / totalSensors) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        {/* Header & Short Explanation */}
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-blue-400 tracking-wider uppercase mb-4 shadow-blue-500 drop-shadow-sm">
            How Aquasense Works
          </h1>
          <p className="max-w-3xl mx-auto text-slate-400 text-lg leading-relaxed">
            Aquasense is a next-generation smart water distribution platform. It utilizes physical IoT sensors 
            at municipal nodes to monitor real-time flow and pressure metrics. This telemetry is streamed securely 
            to an intelligent operations center, allowing city managers to instantly detect leaks, optimize 
            water pressure routing, and forecast long-term infrastructure health through AI analytics.
          </p>
        </header>

        {/* Single Cohesive Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl relative overflow-hidden flex flex-col divide-y divide-slate-800/60">
          <div className="absolute top-0 right-0 p-32 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none"></div>
          
          {/* Analytics Pie Charts */}
          <div className="p-8 lg:p-12 relative z-10 flex flex-col md:flex-row gap-12 items-center justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-3">
                <PieChart className="text-indigo-500" />
                Live Network Analytics
              </h2>
              <p className="text-sm text-slate-400 max-w-sm mb-4">
                Real-time breakdown of water distribution across the municipal network, identifying optimal flow and tracking potential loss points based on live sensor telemetry.
              </p>
              <div className="bg-slate-950 rounded border border-slate-800 p-3 inline-block">
                <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Current Total Demand</p>
                <p className="text-2xl font-mono text-cyan-400 font-bold">{totalFlow.toFixed(1)} <span className="text-sm text-slate-500">L/min</span></p>
              </div>
            </div>
            
            <div className="flex flex-row items-center justify-center gap-10">
              <div className="text-center group">
                <div className="relative w-32 h-32 rounded-full flex items-center justify-center bg-slate-800 mx-auto mb-4 shadow-lg transition-transform group-hover:scale-105" style={{ background: `conic-gradient(#3b82f6 0% ${healthyPercent}%, #0f172a ${healthyPercent}% 100%)` }}>
                  <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)]">
                    <div className="flex flex-col">
                      <span className="text-xl font-bold text-blue-400">{healthyPercent}%</span>
                    </div>
                  </div>
                </div>
                <h4 className="font-bold text-sm text-slate-300">Healthy Flow Rates</h4>
                <p className="text-xs text-slate-500 mt-1">{healthyCount} Nodes Normal</p>
              </div>
              
              <div className="text-center group">
                <div className="relative w-32 h-32 rounded-full flex items-center justify-center bg-slate-800 mx-auto mb-4 shadow-lg transition-transform group-hover:scale-105" style={{ background: `conic-gradient(#ef4444 0% ${anomalyPercent}%, #f59e0b ${anomalyPercent}% ${anomalyPercent + 5}%, #0f172a ${anomalyPercent + 5}% 100%)` }}>
                  <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)]">
                    <div className="flex flex-col">
                      <span className="text-xl font-bold text-amber-500">{anomalyPercent}%</span>
                    </div>
                  </div>
                </div>
                <h4 className="font-bold text-sm text-slate-300">Detected Leak Risk</h4>
                <p className="text-xs text-slate-500 mt-1">{anomalyCount} Nodes Warning</p>
              </div>
            </div>
          </div>

          {/* AI Smart Suggestions */}
          <div className="p-8 lg:p-12">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
              <BrainCircuit className="text-purple-500" />
              AI Smart Suggestions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-gradient-to-r from-purple-900/30 to-slate-900/50 border border-purple-500/20 p-6 rounded-xl shadow-sm hover:border-purple-500/40 transition-colors cursor-default">
                <div className="flex items-center gap-3 mb-3">
                  <BrainCircuit className="text-purple-400" size={24} />
                  <h4 className="font-bold text-purple-300 text-sm uppercase tracking-wide">Pressure Optimization Available</h4>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">System demand is currently at <span className="text-slate-200 font-semibold">{totalFlow.toFixed(1)} L/min</span>. Lowering supply pressure by 5% tonight will save an estimated 1,200L without affecting resident experience.</p>
              </div>
              <div className="bg-gradient-to-r from-blue-900/20 to-slate-900/50 border border-blue-500/20 p-6 rounded-xl shadow-sm hover:border-blue-500/40 transition-colors cursor-default">
                <div className="flex items-center gap-3 mb-3">
                  <Droplet className="text-blue-400" size={24} />
                  <h4 className="font-bold text-blue-300 text-sm uppercase tracking-wide">Main Tank Refill Scheduling</h4>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">Peak consumption expected at 07:00 AM. Begin reservoir pump cycle at <span className="text-slate-200 font-semibold">04:30 AM</span> for optimal energy efficiency.</p>
              </div>
            </div>
          </div>

          {/* Live Alerts Panel */}
          <div className="p-8 lg:p-12 relative z-10 flex flex-col lg:flex-row gap-8">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold flex items-center gap-3">
                  <Activity className="text-teal-500" />
                  Live Socket Stream
                </h2>
                <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-950 rounded border border-slate-800 shadow-inner">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                    {isConnected ? 'Connected' : 'Offline'}
                  </span>
                </div>
              </div>
              
              <div className="bg-slate-950 rounded-xl border border-slate-800 h-64 overflow-y-auto p-4 flex flex-col gap-2 font-mono text-xs shadow-inner" ref={scrollRef}>
                {logFeed.length === 0 && isConnected && (
                  <span className="text-slate-500 italic">Listening for telemetry...</span>
                )}
                {logFeed.map((log, i) => (
                  <div key={i} className="flex gap-4 border-b border-slate-900 pb-1 w-full whitespace-nowrap">
                    <span className="text-slate-600">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                    <span className="text-blue-400 w-16">N-[{log.house_id.split('_')[1] || log.house_id}]</span>
                    <span className="text-slate-400">{'->'}</span>
                    <span className="text-teal-400 w-24">FLW: {log.flow_rate.toFixed(1)} L/m</span>
                    <span className="text-indigo-400 w-24">PRS: {log.pressure.toFixed(1)} kPa</span>
                    <span className={`${log.status === 'Normal' ? 'text-green-500' : 'text-amber-500'} font-bold ml-auto`}>
                      [{log.status}]
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:w-1/3 flex flex-col gap-5">
              <h2 className="text-xl font-bold mb-3 flex items-center gap-3">
                <AlertTriangle className="text-amber-500" />
                Active Alerts
              </h2>
              {anomalyCount === 0 ? (
                <div className="p-5 rounded-xl border border-emerald-900/40 bg-gradient-to-br from-emerald-900/10 to-slate-900/50 flex flex-col gap-3 h-full justify-center">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="text-emerald-500" size={24} />
                    <h4 className="font-bold text-emerald-400 text-lg">System Optimal</h4>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">No anomalies detected in the live data stream. All sensors reporting normal flow rates.</p>
                </div>
              ) : (
                currentReadings.filter(r => r.status !== 'Normal').slice(0, 2).map((alert, idx) => (
                  <div key={idx} className="p-5 rounded-xl border border-amber-900/40 bg-gradient-to-br from-amber-900/10 to-slate-900/50 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="text-amber-500" size={18} />
                      <h4 className="font-bold text-amber-400 text-sm">{alert.status} Warning</h4>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">Node {alert.house_id} reporting unusual metrics (Flow: {alert.flow_rate.toFixed(1)}). Auto-flagged for review.</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
