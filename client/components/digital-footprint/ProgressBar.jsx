'use client';

import { useEffect, useState } from 'react';

export default function ProgressBar({ value, max }) {
  const safeMax = max > 0 ? max : 1;
  const target = Math.min(100, Math.round((value / safeMax) * 100));
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setWidth(target), 50);
    return () => clearTimeout(id);
  }, [target]);

  return (
    <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-blue-500 to-indigo-500 transition-all duration-700"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
