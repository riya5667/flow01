"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Bell, 
  FileText, 
  ChevronLeft, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Settings, 
  Save, 
  Calendar,
  ShieldAlert,
  MessageSquare
} from 'lucide-react';
import AquaBot from '../../components/AquaBot';

type Alert = {
  id: number;
  type: 'LEAK' | 'THEFT';
  location: string;
  timestamp: string;
  status: string;
};

type ReportConfig = {
  enabled: boolean;
  dayOfWeek: number;
  hour: number;
  minute: number;
  whatsappNumber: string;
};

export default function AlertsReportsPage() {
  const [activeTab, setActiveTab] = useState<'alerts' | 'reports'>('alerts');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [config, setConfig] = useState<ReportConfig>({
    enabled: true,
    dayOfWeek: 0,
    hour: 9,
    minute: 0,
    whatsappNumber: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [alertsRes, configRes] = await Promise.all([
        fetch('/api/alerts'),
        fetch('/api/reports/config')
      ]);
      const alertsData = await alertsRes.json();
      const configData = await configRes.json();
      setAlerts(alertsData);
      setConfig(configData);
    } catch (e) {
      console.error('Fetch error', e);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await fetch('/api/reports/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      alert('Report schedule updated!');
    } catch (e) {
      alert('Failed to update schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-[#101010] p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-100 transition-colors">
              <ChevronLeft size={20} />
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">Alerts & Reports</h1>
          </div>
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
            <button 
              onClick={() => setActiveTab('alerts')}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'alerts' ? 'bg-[#0f6f7a] text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Active Alerts
            </button>
            <button 
              onClick={() => setActiveTab('reports')}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'reports' ? 'bg-[#0f6f7a] text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Weekly Reports
            </button>
          </div>
        </header>

        {activeTab === 'alerts' ? (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                    <ShieldAlert size={20} />
                  </div>
                  <h2 className="text-xl font-bold">System Incident Log</h2>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Real-time monitoring</span>
              </div>

              {alerts.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} />
                  </div>
                  <p className="text-slate-500 font-medium">No critical incidents detected recently.</p>
                  <p className="text-slate-400 text-sm mt-1">Your network is secure.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="py-4 flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${alert.type === 'LEAK' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'}`}>
                          <AlertTriangle size={20} />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800">{alert.type} DETECTED</h3>
                          <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                            <span className="font-semibold">{alert.location}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1"><Clock size={14} /> {new Date(alert.timestamp).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider">
                          <MessageSquare size={12} />
                          WhatsApp Sent
                        </div>
                        <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                          {alert.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-[#0f6f7a] to-[#0d5a63] text-white p-6 rounded-2xl shadow-lg">
                <h3 className="text-lg font-bold mb-2">WhatsApp Integration</h3>
                <p className="text-cyan-100 text-sm mb-4 leading-relaxed">
                  Automatic notifications are active. Whenever a leak or theft is detected by the Arduino sensors, an instant alert is dispatched to your registered device.
                </p>
                <div className="flex items-center gap-2 text-xs font-bold bg-white/10 w-fit px-3 py-1.5 rounded-lg">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-ping" />
                  GATEWAY ACTIVE
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center">
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Current Config</h3>
                <p className="text-2xl font-bold text-slate-800">{config.whatsappNumber || 'No Number Set'}</p>
                <p className="text-slate-500 text-sm mt-1">Alerts are routed to this primary contact.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                    <Calendar size={20} />
                  </div>
                  <h2 className="text-xl font-bold">Schedule Weekly Report</h2>
                </div>
                <Settings size={20} className="text-slate-300" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">WhatsApp Number</label>
                    <input 
                      type="text" 
                      value={config.whatsappNumber}
                      onChange={(e) => setConfig({...config, whatsappNumber: e.target.value})}
                      placeholder="+91 99999 99999"
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f6f7a] focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">Reporting Day</label>
                    <select 
                      value={config.dayOfWeek}
                      onChange={(e) => setConfig({...config, dayOfWeek: parseInt(e.target.value)})}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f6f7a] transition-all"
                    >
                      <option value={0}>Sunday</option>
                      <option value={1}>Monday</option>
                      <option value={2}>Tuesday</option>
                      <option value={3}>Wednesday</option>
                      <option value={4}>Thursday</option>
                      <option value={5}>Friday</option>
                      <option value={6}>Saturday</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">Reporting Time</label>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <select 
                          value={config.hour}
                          onChange={(e) => setConfig({...config, hour: parseInt(e.target.value)})}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f6f7a]"
                        >
                          {Array.from({length: 24}).map((_, i) => (
                            <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <select 
                          value={config.minute}
                          onChange={(e) => setConfig({...config, minute: parseInt(e.target.value)})}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f6f7a]"
                        >
                          {[0, 15, 30, 45].map((m) => (
                            <option key={m} value={m}>{m.toString().padStart(2, '0')} min</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <p className="text-indigo-700 text-sm leading-relaxed">
                      <strong>Next Report:</strong> Every week on {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][config.dayOfWeek]} at {config.hour.toString().padStart(2, '0')}:{config.minute.toString().padStart(2, '0')}.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-10 flex justify-end">
                <button 
                  onClick={saveConfig}
                  disabled={saving}
                  className="inline-flex items-center gap-2 bg-[#0f6f7a] text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-[#0f6f7a]/20 hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  Save Schedule
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <FileText size={18} className="text-slate-400" />
                Past Reports
              </h3>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 text-slate-400 rounded-lg">
                        <FileText size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">Weekly Performance Report - Week {20 - i}</p>
                        <p className="text-xs text-slate-400">May {15 - (i*7)}, 2024</p>
                      </div>
                    </div>
                    <button className="text-xs font-bold text-[#0f6f7a] hover:underline">Download PDF</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Reusing AquaBot component for consistent AI assistance */}
      <AquaBot context={{ activeTab, alertCount: alerts.length }} />
    </div>
  );
}

function Loader2({ className, size }: { className?: string, size?: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={`animate-spin ${className}`}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
