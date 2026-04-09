import React from 'react';
import { Activity, Droplet, TrendingUp, AlertTriangle } from 'lucide-react';

export default function SensorCapabilities() {
  const capabilities = [
    { label: "Consumed Volume", value: 40, color: "#3b82f6", icon: <Droplet size={14} className="text-blue-500" /> },
    { label: "Leak Detection", value: 30, color: "#ef4444", icon: <AlertTriangle size={14} className="text-red-500" /> },
    { label: "Pressure Profiles", value: 20, color: "#10b981", icon: <Activity size={14} className="text-emerald-500" /> },
    { label: "AI Forecasting", value: 10, color: "#8b5cf6", icon: <TrendingUp size={14} className="text-purple-500" /> },
  ];

  let cumulativePercent = 0;
  
  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  const createPieSlice = (slice: typeof capabilities[0]) => {
    const startX = getCoordinatesForPercent(cumulativePercent)[0];
    const startY = getCoordinatesForPercent(cumulativePercent)[1];
    
    cumulativePercent += slice.value / 100;
    
    const endX = getCoordinatesForPercent(cumulativePercent)[0];
    const endY = getCoordinatesForPercent(cumulativePercent)[1];
    
    const largeArcFlag = slice.value > 50 ? 1 : 0;
    
    const pathData = [
      `M ${startX} ${startY}`,
      `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`
    ].join(' ');

    return (
      <path
        key={slice.label}
        d={pathData}
        fill="none"
        stroke={slice.color}
        strokeWidth="0.4"
        className="transition-all duration-500 hover:opacity-80 cursor-pointer"
      />
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-[220px]">
      <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
        <h3 className="font-semibold text-slate-800 text-sm">What the sensor measures</h3>
        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Derived Metrics</span>
      </div>
      
      <div className="flex-1 flex flex-row items-center justify-center gap-8 p-6">
        
        {/* SVG Doughnut Chart */}
        <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
          <svg viewBox="-1.2 -1.2 2.4 2.4" className="w-full h-full transform -rotate-90">
            {capabilities.map(createPieSlice)}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <span className="text-2xl font-bold text-slate-800 tracking-tight">4</span>
            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold text-center leading-tight">Use<br/>Cases</span>
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex flex-col gap-3 font-medium text-xs text-slate-600 w-full">
          {capabilities.map((cap) => (
            <div key={cap.label} className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-white border border-slate-100 shadow-sm flex flex-shrink-0 items-center justify-center">
                  {cap.icon}
                </div>
                <span>{cap.label}</span>
              </div>
              <strong className="text-slate-800">{cap.value}%</strong>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
