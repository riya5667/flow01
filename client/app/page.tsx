'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSocket } from '../hooks/useSocket';
import Map from '../components/Map';
import { AssetSelection } from '../utils/types';
import {
  Activity,
  AlertCircle,
  BarChart3,
  BrainCircuit,
  CheckCircle,
  Database,
  Droplet,
  Filter,
  Gauge,
  Home,
  LayoutDashboard,
  Loader2,
  Map as MapIcon,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Waves,
  Zap,
} from 'lucide-react';
import DigitalFootprint from '../components/DigitalFootprint';
import AquaBot from '../components/AquaBot';
import ForecastingPanel from '../components/ForecastingPanel';

const tabConfig = [
  { id: 'live', label: 'Live Grid', icon: Home },
  { id: 'predict', label: 'Forecast', icon: Database },
  { id: 'footprint', label: 'Footprint', icon: Activity },
] as const;

export default function ObservatoryDashboard() {
  const { network, readings, isConnected, isLoading } = useSocket();
  const [selectedAsset, setSelectedAsset] = useState<AssetSelection | null>(null);
  const [activeTab, setActiveTab] = useState<'live' | 'predict' | 'footprint'>('live');
  const [isGenerating, setIsGenerating] = useState(false);
  const [insights, setInsights] = useState<any[]>([]);

  const currentReadings = useMemo(() => Object.values(readings || {}), [readings]);
  const physicalNode = currentReadings.find((r) => r.house_id === 'house_1');

  let healthyCount = 0;
  let anomalyCount = 0;
  let totalDemand = 0;

  currentReadings.forEach((reading) => {
    totalDemand += reading.flow_rate || 0;
    if (reading.status === 'Normal') healthyCount += 1;
    else anomalyCount += 1;
  });

  const totalSensors = currentReadings.length;
  const healthyPercent = totalSensors > 0 ? Math.round((healthyCount / totalSensors) * 100) : 100;
  const anomalyPercent = totalSensors > 0 ? Math.round((anomalyCount / totalSensors) * 100) : 0;
  const averagePressure =
    totalSensors > 0
      ? currentReadings.reduce((sum, reading) => sum + (reading.pressure || 0), 0) / totalSensors
      : 0;

  useEffect(() => {
    if (!network?.zones.length) return;
    if (!selectedAsset) {
      setSelectedAsset({ type: 'tank', id: network.zones[0].tank.id });
    }
  }, [network, selectedAsset]);

  const generateInsights = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/ai-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          physicalNode,
          totalDemand,
          anomalyCount,
        }),
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setInsights(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading || !network) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#eef7f5] text-slate-900">
        <div className="rounded-[2rem] border border-white/70 bg-white/80 px-8 py-7 text-center shadow-[0_28px_90px_rgba(15,23,42,0.16)] backdrop-blur">
          <Loader2 className="mx-auto mb-4 h-9 w-9 animate-spin text-cyan-600" />
          <h1 className="text-xl font-bold tracking-tight">Bringing FlowIntel online</h1>
          <p className="mt-2 text-sm text-slate-500">Syncing live telemetry, maps, and sensor health.</p>
        </div>
      </div>
    );
  }

  const activeZone = network.zones[0];
  const allNodes = activeZone.houses;

  return (
    <div className="relative flex h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_10%,rgba(20,184,166,0.16),transparent_28%),linear-gradient(135deg,#f7fbfb_0%,#eef7f5_48%,#f8fafc_100%)] text-slate-900">
      <nav className="z-30 hidden w-[88px] shrink-0 flex-col items-center border-r border-white/70 bg-white/62 px-4 py-6 shadow-[12px_0_45px_rgba(15,23,42,0.08)] backdrop-blur-2xl lg:flex">
        <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_18px_35px_rgba(15,23,42,0.28)]">
          <Waves size={25} />
        </div>

        <div className="mt-9 flex flex-col gap-3">
          {tabConfig.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={`group grid h-12 w-12 place-items-center rounded-2xl border transition-all ${
                  isActive
                    ? 'border-slate-950 bg-slate-950 text-white shadow-[0_16px_30px_rgba(15,23,42,0.25)]'
                    : 'border-white/70 bg-white/70 text-slate-500 hover:border-cyan-200 hover:text-cyan-700 hover:shadow-md'
                }`}
              >
                <Icon size={20} />
              </button>
            );
          })}
        </div>

        <div className="mt-auto grid h-12 w-12 place-items-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
          <ShieldCheck size={20} />
        </div>
      </nav>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1660px] flex-col gap-6 pb-10">
            <header className="relative overflow-hidden rounded-[2rem] border border-white/75 bg-white/70 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur-2xl sm:p-6">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-300" />
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-3xl">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">
                      <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      {isConnected ? 'Telemetry live' : 'Socket offline'}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-500">
                      Smart Indore Water Grid
                    </span>
                  </div>
                  <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
                    FlowIntel Command Center
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                    A polished live operations surface for distribution health, demand, leak signals, and AI-guided
                    intervention across the municipal water network.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/ai-analysis"
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-[0_18px_40px_rgba(15,23,42,0.24)] transition hover:-translate-y-0.5 hover:bg-slate-800"
                  >
                    <BrainCircuit size={17} /> AI Analyst
                  </Link>
                  <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:text-cyan-700">
                    <Settings size={17} /> Customize
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="stat-tile">
                  <div className="stat-icon bg-cyan-50 text-cyan-700">
                    <LayoutDashboard size={18} />
                  </div>
                  <div>
                    <p className="stat-label">Stations</p>
                    <strong className="stat-value">{activeZone.houses.length}</strong>
                  </div>
                </div>
                <div className="stat-tile">
                  <div className="stat-icon bg-emerald-50 text-emerald-700">
                    <CheckCircle size={18} />
                  </div>
                  <div>
                    <p className="stat-label">Healthy</p>
                    <strong className="stat-value">{healthyCount}</strong>
                  </div>
                </div>
                <div className="stat-tile">
                  <div className="stat-icon bg-rose-50 text-rose-700">
                    <AlertCircle size={18} />
                  </div>
                  <div>
                    <p className="stat-label">Alerts</p>
                    <strong className="stat-value">{anomalyCount}</strong>
                  </div>
                </div>
                <div className="stat-tile">
                  <div className="stat-icon bg-amber-50 text-amber-700">
                    <Gauge size={18} />
                  </div>
                  <div>
                    <p className="stat-label">Avg Pressure</p>
                    <strong className="stat-value">{averagePressure.toFixed(1)} kPa</strong>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="inline-flex rounded-2xl border border-slate-200 bg-white/82 p-1 shadow-sm">
                  {tabConfig.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition sm:px-4 ${
                          isActive ? 'bg-slate-950 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        <Icon size={16} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white/82 px-3 py-2 shadow-sm md:w-[360px]">
                  <Filter size={16} className="text-cyan-600" />
                  <Search size={16} className="text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search station, pipe, or alert..."
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
            </header>

            {activeTab === 'live' && (
              <div className="grid min-h-[680px] grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
                <div className="flex min-h-0 flex-col gap-6">
                  <section className="panel-shell flex h-[62vh] min-h-[420px] flex-col overflow-hidden">
                    <div className="panel-heading">
                      <div>
                        <p className="eyebrow">Geospatial Network</p>
                        <h2 className="panel-title">Live station map</h2>
                      </div>
                      <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">
                        {activeZone.name}
                      </span>
                    </div>
                    <div className="relative min-h-0 flex-1 overflow-hidden bg-slate-100">
                      <Map
                        zone={activeZone}
                        readings={readings}
                        selectedAsset={selectedAsset}
                        onSelectAsset={setSelectedAsset}
                      />
                    </div>
                  </section>

                  <section className="panel-shell min-h-[240px]">
                    <div className="panel-heading">
                      <div>
                        <p className="eyebrow">OpenAI Intelligence</p>
                        <h2 className="panel-title">Operational insights</h2>
                      </div>
                      <button
                        onClick={generateInsights}
                        disabled={isGenerating}
                        className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800 shadow-sm transition hover:border-teal-300 hover:bg-teal-100 disabled:opacity-50"
                      >
                        {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        Generate
                      </button>
                    </div>

                    <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
                      {insights.length > 0 ? (
                        insights.map((insight, idx) => (
                          <article key={idx} className="insight-card">
                            <div className="flex items-center gap-2 text-slate-800">
                              {insight.icon === 'BrainCircuit' ? (
                                <BrainCircuit size={17} className="text-cyan-600" />
                              ) : insight.icon === 'AlertTriangle' ? (
                                <AlertCircle size={17} className="text-rose-600" />
                              ) : (
                                <Droplet size={17} className="text-teal-600" />
                              )}
                              <h3 className="text-sm font-black leading-snug">{insight.title}</h3>
                            </div>
                            <p className="text-xs leading-6 text-slate-500">{insight.description}</p>
                          </article>
                        ))
                      ) : (
                        <div className="col-span-full grid min-h-[130px] place-items-center rounded-2xl border border-dashed border-slate-200 bg-white/60 p-6 text-center">
                          <div>
                            <BrainCircuit className="mx-auto mb-3 text-slate-300" size={34} />
                            <p className="text-sm font-semibold text-slate-500">
                              Generate AI guidance from the latest flow, pressure, and alert patterns.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                <aside className="flex min-h-0 flex-col gap-6">
                  <section className="panel-shell flex min-h-[420px] flex-1 flex-col overflow-hidden">
                    <div className="panel-heading">
                      <div>
                        <p className="eyebrow">Telemetry Stream</p>
                        <h2 className="panel-title">Stations</h2>
                      </div>
                      <span className="text-xs font-bold text-slate-400">{allNodes.length} endpoints</span>
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto p-4">
                      {allNodes.map((node) => {
                        const reading = readings[node.id];
                        const isRealTime = node.id === 'house_1';
                        const isNormal = reading?.status === 'Normal';
                        const isSelected = selectedAsset?.id === node.id;

                        return (
                          <button
                            key={node.id}
                            onClick={() => setSelectedAsset({ type: 'house', id: node.id })}
                            className={`station-row ${isSelected ? 'station-row-active' : ''}`}
                          >
                            <div className="flex min-w-0 gap-3">
                              <div
                                className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white shadow-sm ${
                                  isRealTime ? 'bg-slate-950' : isNormal ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                              >
                                <MapIcon size={17} />
                              </div>
                              <div className="min-w-0 text-left">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="truncate text-sm font-black text-slate-900">{node.name}</h3>
                                  {isRealTime && (
                                    <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-cyan-700">
                                      Hardware
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-xs text-slate-500">
                                  {node.label} | {reading?.pressure ? `${reading.pressure.toFixed(1)} kPa` : 'No pressure data'}
                                </p>
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              <span
                                className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                                  isNormal ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {reading?.status || 'Offline'}
                              </span>
                              <p className="mt-2 font-mono text-sm font-black text-slate-900">
                                {reading?.flow_rate?.toFixed(1) || '0.0'} L/m
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="panel-shell">
                    <div className="panel-heading">
                      <div>
                        <p className="eyebrow">Network Health</p>
                        <h2 className="panel-title">Alert mix</h2>
                      </div>
                      <BarChart3 size={18} className="text-cyan-600" />
                    </div>
                    <div className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:justify-center">
                      <div
                        className="relative grid h-40 w-40 shrink-0 place-items-center rounded-full shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]"
                        style={{
                          background: `conic-gradient(#fb7185 0% ${anomalyPercent}%, #10b981 ${anomalyPercent}% ${
                            anomalyPercent + healthyPercent
                          }%, #e2e8f0 ${anomalyPercent + healthyPercent}% 100%)`,
                        }}
                      >
                        <div className="grid h-28 w-28 place-items-center rounded-full bg-white shadow-inner">
                          <div className="text-center">
                            <p className="text-3xl font-black tracking-tight text-slate-950">{healthyPercent}%</p>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Stable</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 text-sm font-semibold text-slate-600">
                        <div className="legend-row">
                          <span className="h-3 w-3 rounded bg-rose-400" />
                          <strong>{anomalyCount}</strong> Crisis
                        </div>
                        <div className="legend-row">
                          <span className="h-3 w-3 rounded bg-amber-400" />
                          <strong>0</strong> Watch
                        </div>
                        <div className="legend-row">
                          <span className="h-3 w-3 rounded bg-emerald-500" />
                          <strong>{healthyCount}</strong> Normal
                        </div>
                        <div className="legend-row">
                          <span className="h-3 w-3 rounded bg-slate-200" />
                          <strong>0</strong> No data
                        </div>
                      </div>
                    </div>
                  </section>
                </aside>
              </div>
            )}

            {activeTab === 'predict' && <ForecastingPanel totalDemand={totalDemand} />}
            {activeTab === 'footprint' && <DigitalFootprint />}
          </div>
        </div>
      </main>

      <AquaBot context={{ totalDemand, anomalyCount, network, activeZone }} />
    </div>
  );
}
