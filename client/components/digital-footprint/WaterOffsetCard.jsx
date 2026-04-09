'use client';

import { Droplet, CheckCircle2, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import OffsetActionList from './OffsetActionList';
import ProgressBar from './ProgressBar';

export default function WaterOffsetCard({ totalWater, plan, checkedMap, onToggle, reminders, onToggleReminder, checkedOffset }) {
  const totalOffset = plan?.totalOffset || 0;
  const balanced = checkedOffset >= totalWater && totalWater > 0;
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    if (balanced) {
      setCelebrate(true);
      const id = setTimeout(() => setCelebrate(false), 2400);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [balanced]);

  return (
    <div className="relative bg-white border border-slate-200 rounded-3xl shadow-xl p-6 flex flex-col gap-5 overflow-hidden">
      {celebrate && (
        <div className="pointer-events-none absolute inset-0">
          {[
            { left: '15%', delay: '0s' },
            { left: '30%', delay: '0.1s' },
            { left: '45%', delay: '0.2s' },
            { left: '60%', delay: '0.05s' },
            { left: '75%', delay: '0.15s' },
            { left: '88%', delay: '0.25s' },
          ].map((confetti, idx) => (
            <span
              key={`confetti-${idx}`}
              className="absolute -top-4 text-lg"
              style={{ left: confetti.left, animation: `confetti 1.6s ease-in-out ${confetti.delay} forwards` }}
            >
              🎉
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total Digital Usage</p>
          <p className="text-3xl font-semibold text-slate-900 mt-2">
            {totalWater} <span className="text-sm font-medium text-slate-500">Liters Used Today</span>
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg">
          <Droplet size={20} />
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
          <Zap size={14} className="text-amber-500" />
          Offset Plan
        </div>
        <p className="text-sm text-slate-700 mt-2">{plan?.summary || 'Generate an offset plan to see actions.'}</p>
        <div className="mt-4">
          <OffsetActionList
            actions={plan?.actions}
            checkedMap={checkedMap}
            onToggle={onToggle}
            reminders={reminders}
            onToggleReminder={onToggleReminder}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Offset progress</span>
          <span className="font-semibold text-slate-900">{checkedOffset}L / {totalWater}L</span>
        </div>
        <ProgressBar value={checkedOffset} max={totalWater} />
      </div>

      {balanced && (
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-2xl px-3 py-2 text-sm font-semibold">
          <CheckCircle2 size={16} />
          Balanced
        </div>
      )}
      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) scale(0.9) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translateY(120px) scale(1.2) rotate(18deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
