'use client';

import { Droplet, CheckCircle2, Bell, Star } from 'lucide-react';

export default function OffsetActionList({ actions, checkedMap, onToggle, reminders, onToggleReminder }) {
  if (!actions || actions.length === 0) {
    return (
      <div className="text-sm text-slate-500 flex items-center gap-2">
        <CheckCircle2 size={16} className="text-emerald-500" />
        No actions needed yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {actions.map((item, idx) => {
        const checked = Boolean(checkedMap?.[idx]);
        const isHighImpact = Number(item.waterSaved) >= 10;
        return (
        <div key={`${item.action}-${idx}`} className={`flex items-start gap-3 bg-white border ${checked ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'} rounded-2xl p-3 shadow-sm`}>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Droplet size={16} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggle?.(idx)}
                className={`w-4 h-4 rounded border ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'} flex items-center justify-center`}
              >
                {checked && <CheckCircle2 size={12} className="text-white" />}
              </button>
              <p className={`text-sm font-semibold ${checked ? 'text-emerald-800 line-through' : 'text-slate-800'}`}>{item.action}</p>
              {isHighImpact && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                  <Star size={10} /> High impact
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">{item.waterSaved} liters saved</p>
            <button
              onClick={() => onToggleReminder?.(idx)}
              className={`mt-2 text-xs font-semibold inline-flex items-center gap-1 rounded-full px-2 py-1 border ${reminders?.[idx] ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-slate-200 text-slate-500'}`}
            >
              <Bell size={12} />
              {reminders?.[idx] ? 'Reminder set' : 'Set reminder'}
            </button>
          </div>
        </div>
      )})}
    </div>
  );
}
