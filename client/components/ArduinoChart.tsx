'use client';

import React, { useEffect, useState } from 'react';
import { Activity, Bell, Droplet, Gauge, Ruler, ShieldAlert } from 'lucide-react';
import { SensorReading } from '../utils/types';

interface ArduinoChartProps {
  reading?: SensorReading;
}

export default function ArduinoChart({ reading }: ArduinoChartProps) {
  const maxDataPoints = 50;
  const [flow1Points, setFlow1Points] = useState<number[]>(Array(maxDataPoints).fill(0));
  const [flow2Points, setFlow2Points] = useState<number[]>(Array(maxDataPoints).fill(0));
  const [humidityPoints, setHumidityPoints] = useState<number[]>(Array(maxDataPoints).fill(0));

  useEffect(() => {
    if (!reading) return;

    const appendPoint = (previous: number[], value: number) => {
      const next = [...previous, value];
      if (next.length > maxDataPoints) next.shift();
      return next;
    };

    setFlow1Points((prev) => appendPoint(prev, reading.flow1 ?? reading.flow_rate ?? 0));
    setFlow2Points((prev) => appendPoint(prev, reading.flow2 ?? 0));
    setHumidityPoints((prev) => appendPoint(prev, reading.humidity ?? 0));
  }, [reading]);

  const maxValue = Math.max(...flow1Points, ...flow2Points, 10);
  const buildPoints = (dataPoints: number[], scaleMax: number) =>
    dataPoints
      .map((val, i) => {
        const x = (i / (maxDataPoints - 1)) * 300;
        const y = 100 - (val / scaleMax) * 100;
        return `${x},${y}`;
      })
      .join(' ');

  const flow1 = reading?.flow1 ?? reading?.flow_rate ?? 0;
  const flow2 = reading?.flow2 ?? 0;
  const humidity = Number.isFinite(reading?.humidity) ? Number(reading?.humidity) : null;
  const humidityValue = humidity ?? 0;
  const soil = Number.isFinite(reading?.soil) ? Number(reading?.soil) : null;
  const soilValue = soil ?? 0;
  const soilLeakSignal = soilValue >= 55;
  const soilTheftSignal = soil !== null && soilValue <= 20 && (reading?.theft ?? 0) === 1;
  const halfFlowTheftSignal =
    (flow1 > 0.05 && flow2 <= Math.max(0.05, flow1 * 0.5)) ||
    (flow2 > 0.05 && flow1 <= Math.max(0.05, flow2 * 0.5));
  const vibration = reading?.vibration ?? 0;
  const leak = reading?.leak ?? 0;
  const theft = reading?.theft ?? 0;
  const buzzer = reading?.buzzer ?? 0;
  const isAlert = vibration === 1 || humidityValue > 75 || soilLeakSignal || leak === 1 || theft === 1 || buzzer === 1 || (!!reading && reading.status !== 'Normal');
  const isConnected = !!reading && reading.status !== 'Offline';
  const waterLevel = Math.min(92, Math.max(18, ((flow1 + flow2) / 20) * 100));

  const sensors = [
    { label: 'Flow sensor 1', value: `${flow1.toFixed(2)} L/m`, icon: <Droplet size={14} />, alert: flow1 <= 0.05 },
    { label: 'Flow sensor 2', value: `${flow2.toFixed(2)} L/m`, icon: <Droplet size={14} />, alert: flow2 <= 0.05 },
    { label: 'Humidity', value: humidity === null ? 'Waiting' : `${humidity.toFixed(0)}%`, icon: <Gauge size={14} />, alert: humidityValue > 75 },
    { label: 'Soil Moisture', value: soil === null ? 'Waiting' : `${soil.toFixed(0)}%`, icon: <Droplet size={14} />, alert: soilLeakSignal },
    { label: 'Vibration', value: vibration === 1 ? 'Detected' : 'Clear', icon: <Activity size={14} />, alert: vibration === 1 },
    { label: 'Leakage', value: leak === 1 ? (soilLeakSignal ? 'Soil wet' : 'Found') : 'Clear', icon: <Droplet size={14} />, alert: leak === 1 },
    { label: 'Theft', value: theft === 1 || halfFlowTheftSignal ? (halfFlowTheftSignal ? 'Meter half drop' : soilTheftSignal ? 'Dry soil + flow drop' : 'Found') : 'Clear', icon: <ShieldAlert size={14} />, alert: theft === 1 || halfFlowTheftSignal },
    { label: 'Buzzer', value: buzzer === 1 ? 'On' : 'Off', icon: <Bell size={14} />, alert: buzzer === 1 },
  ];

  return (
    <div className="relative flex h-full min-h-[360px] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-lg">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.22),_transparent_34%)]" />

      <div className="relative z-10 flex items-center justify-between border-b border-slate-700/50 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Activity size={16} className="text-sky-400" />
          Arduino Uno Sensor Stream
        </h3>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-400">HARDWARE NODE</span>
          <div
            className={`h-2 w-2 rounded-full ${
              isConnected && !isAlert
                ? 'animate-pulse bg-green-500 shadow-[0_0_8px_#22c55e]'
                : 'bg-red-500 shadow-[0_0_8px_#ef4444]'
            }`}
          />
        </div>
      </div>

      <div className="relative z-10 grid flex-1 gap-4 p-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="flex flex-col justify-between gap-4">
          <div className="relative mx-auto h-52 w-36 overflow-hidden rounded-b-3xl rounded-t-xl border-4 border-sky-100/30 bg-slate-900 shadow-inner">
            <div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-sky-500 via-cyan-400 to-sky-300 transition-all duration-700"
              style={{ height: `${waterLevel}%` }}
            >
              <div className="absolute -top-3 left-[-20%] h-8 w-[140%] animate-[wave_2.8s_ease-in-out_infinite] rounded-[50%] bg-cyan-200/70" />
            </div>
            <div className="absolute inset-x-0 top-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-300">
              Tank Load
            </div>
            <div className="absolute inset-x-0 bottom-5 text-center text-3xl font-semibold text-white drop-shadow">
              {waterLevel.toFixed(0)}%
            </div>
          </div>

          <div
            className={`rounded-xl border px-3 py-2 text-center text-xs font-bold uppercase tracking-widest ${
              isAlert
                ? 'border-rose-400/50 bg-rose-500/15 text-rose-200'
                : 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
            }`}
          >
            {isAlert ? reading?.status || 'Alert' : 'Normal'}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {sensors.map((sensor) => (
              <div
                key={sensor.label}
                className={`rounded-xl border p-3 ${
                  sensor.alert ? 'border-rose-500/60 bg-rose-500/10' : 'border-slate-700 bg-slate-800/70'
                }`}
              >
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <span className={sensor.alert ? 'text-rose-300' : 'text-cyan-300'}>{sensor.icon}</span>
                  {sensor.label}
                </div>
                <div className={sensor.alert ? 'text-xl font-semibold text-rose-200' : 'text-xl font-semibold text-white'}>
                  {sensor.value}
                </div>
              </div>
            ))}
          </div>

          <div className="relative min-h-[160px] flex-1 border-b border-l border-slate-700">
            <svg viewBox="0 0 300 100" className="h-full w-full overflow-visible preserve-aspect-ratio-none" preserveAspectRatio="none">
              <line x1="0" y1="25" x2="300" y2="25" stroke="#334155" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="0" y1="50" x2="300" y2="50" stroke="#334155" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="0" y1="75" x2="300" y2="75" stroke="#334155" strokeWidth="0.5" strokeDasharray="2,2" />
              <polyline points={buildPoints(flow1Points, maxValue)} fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points={buildPoints(flow2Points, maxValue)} fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points={buildPoints(humidityPoints, 100)} fill="none" stroke="#f59e0b" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,3" />
            </svg>
            <div className="absolute right-0 top-0 flex flex-wrap justify-end gap-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              <span className="text-sky-300">Flow 1</span>
              <span className="text-emerald-300">Flow 2</span>
              <span className="text-amber-300">Humidity</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
            <div>Serial: FLOW1,FLOW2,HUMIDITY,SOIL,VIBRATION,LEAK,THEFT,BUZZER</div>
            <div className="text-right">
              Last: {reading?.timestamp ? new Date(reading.timestamp).toLocaleTimeString('en-IN') : 'Waiting'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
