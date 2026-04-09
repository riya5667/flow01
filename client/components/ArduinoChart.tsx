'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Activity, Zap } from 'lucide-react';
import { SensorReading } from '../utils/types';

interface ArduinoChartProps {
  reading?: SensorReading;
}

export default function ArduinoChart({ reading }: ArduinoChartProps) {
  const [dataPoints, setDataPoints] = useState<number[]>(Array(50).fill(0));
  const maxDataPoints = 50;
  
  useEffect(() => {
    if (reading) {
      setDataPoints(prev => {
        const newData = [...prev, reading.flow_rate || 0];
        if (newData.length > maxDataPoints) {
          newData.shift();
        }
        return newData;
      });
    }
  }, [reading]);

  // For SVG drawing
  const maxValue = Math.max(...dataPoints, 40); // At least 40 scale
  const points = dataPoints.map((val, i) => {
    const x = (i / (maxDataPoints - 1)) * 300;
    const y = 100 - (val / maxValue) * 100;
    return `${x},${y}`;
  }).join(' ');

  const currentFlow = reading?.flow_rate || 0;
  const isConnected = reading && reading.status !== 'Offline' && reading.status !== 'Hors Ligne';

  return (
    <div className="bg-slate-900 rounded-2xl shadow-lg border border-slate-700 flex flex-col h-full overflow-hidden text-white relative">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-blue-900/20 to-transparent pointer-events-none"></div>
      
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50 z-10">
        <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
          <Activity size={16} className="text-blue-400" />
          Arduino Real-Time Flow
        </h3>
        <div className="flex items-center gap-2">
           <span className="text-xs font-mono text-slate-400">HARDWARE NODE</span>
           <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_#22c55e] animate-pulse' : 'bg-red-500'}`}></div>
        </div>
      </div>
      
      <div className="flex-1 p-6 flex flex-col justify-between relative z-10">
        <div className="flex justify-between items-end mb-4">
           <div>
             <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Current Flow Rate</span>
             <div className="text-4xl font-light tracking-tight text-white flex items-baseline gap-1">
               {currentFlow.toFixed(1)} <span className="text-lg text-slate-400 font-normal">L/m</span>
             </div>
           </div>
           {reading?.pressure && (
             <div className="text-right">
                <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Pressure</span>
                <div className="text-xl font-medium text-blue-400">
                  {reading.pressure.toFixed(1)} kPa
                </div>
             </div>
           )}
        </div>
        
        <div className="w-full h-[120px] relative mt-auto border-b border-l border-slate-700">
           <svg viewBox="0 0 300 100" className="w-full h-full overflow-visible preserve-aspect-ratio-none" preserveAspectRatio="none">
             {/* Grid lines */}
             <line x1="0" y1="25" x2="300" y2="25" stroke="#334155" strokeWidth="0.5" strokeDasharray="2,2" />
             <line x1="0" y1="50" x2="300" y2="50" stroke="#334155" strokeWidth="0.5" strokeDasharray="2,2" />
             <line x1="0" y1="75" x2="300" y2="75" stroke="#334155" strokeWidth="0.5" strokeDasharray="2,2" />
             
             {/* Chart fill */}
             <polygon points={`0,100 ${points} 300,100`} fill="url(#chartGradient)" />
             
             {/* Chart line */}
             <polyline
               points={points}
               fill="none"
               stroke="#3b82f6"
               strokeWidth="2"
               strokeLinecap="round"
               strokeLinejoin="round"
             />
             
             {/* Active point indicator */}
             <circle cx="300" cy={100 - (currentFlow / maxValue) * 100} r="3" fill="#60a5fa" stroke="#fff" strokeWidth="1" />
             
             <defs>
               <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                 <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                 <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
               </linearGradient>
             </defs>
           </svg>
        </div>
      </div>
    </div>
  );
}
