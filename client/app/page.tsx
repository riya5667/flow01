'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSocket } from '../hooks/useSocket';
import Map from '../components/Map';
import { AssetSelection } from '../utils/types';
import {
  Activity,
  AlertCircle,
  BrainCircuit,
  CheckCircle,
  Database,
  Droplet,
  Filter,
  Home,
  Map as MapIcon,
  Search,
  Settings,
  Zap,
  Loader2,
} from 'lucide-react';
import DigitalFootprint from '../components/DigitalFootprint';
import AquaBot from '../components/AquaBot';
import ForecastingPanel from '../components/ForecastingPanel';

export default function ObservatoryDashboard() {
  const { network, readings, isConnected, isLoading } = useSocket();
  const [selectedAsset, setSelectedAsset] = useState<AssetSelection | null>(null);
  const [activeTab, setActiveTab] = useState<'live' | 'predict' | 'footprint'>('live');

  const [isGenerating, setIsGenerating] = useState(false);
  const [insights, setInsights] = useState<any[]>([]);

  const currentReadings = useMemo(() => Object.values(readings || {}), [readings]);
  const physicalNode = currentReadings.find((r) => r.house_id === 'house_1');

  let totalSensors = currentReadings.length;
  let healthyCount = 0;
  let anomalyCount = 0;
  let totalDemand = 0;

  currentReadings.forEach((r) => {
    totalDemand += r.flow_rate || 0;
    if (r.status === 'Normal') healthyCount += 1;
    else anomalyCount += 1;
  });

  const healthyPercent = totalSensors > 0 ? Math.round((healthyCount / totalSensors) * 100) : 100;
  const anomalyPercent = totalSensors > 0 ? Math.round((anomalyCount / totalSensors) * 100) : 0;

  useEffect(() => {
    if (!network?.zones.length) return;
    if (!selectedAsset) {
      setSelectedAsset({ type: 'tank', id: network.zones[0].tank.id });
    }
  }, [network]);

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
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading || !network) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-sky-400" />
          <h1 className="text-xl font-semibold">Initializing the command center…</h1>
        </div>
      </div>
    );
  }

  const activeZone = network.zones[0];
  const allNodes = activeZone.houses;
  const orderedNodes = [...allNodes].sort((a, b) => {
    const aStatus = readings[a.id]?.status === 'Normal' ? 1 : 0;
    const bStatus = readings[b.id]?.status === 'Normal' ? 1 : 0;
    return aStatus - bStatus;
  });

  const stats = [
    {
      label: 'Active stations',
      value: activeZone.houses.length,
      sub: 'Online in the network',
      icon: <Database size={18} />,
      tone: 'from-sky-500/20 via-sky-500/5 to-transparent',
      color: 'text-sky-600',
    },
    {
      label: 'Critical alerts',
      value: anomalyCount,
      sub: 'Needs immediate attention',
      icon: <AlertCircle size={18} />,
      tone: 'from-rose-500/20 via-rose-500/5 to-transparent',
      color: 'text-rose-600',
    },
    {
      label: 'Stable stations',
      value: healthyCount,
      sub: 'Running within thresholds',
      icon: <CheckCircle size={18} />,
      tone: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
      color: 'text-emerald-600',
    },
    {
      label: 'Total flow',
      value: totalDemand.toFixed(1),
      sub: 'Liters per minute',
      icon: <Droplet size={18} />,
      tone: 'from-indigo-500/20 via-indigo-500/5 to-transparent',
      color: 'text-indigo-600',
    },
  ];

  return (
    <div className="relative h-screen overflow-hidden bg-[#f4f7fb] text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-gradient-to-br from-sky-200 via-white to-transparent blur-3xl opacity-80 float-slow" />
        <div className="absolute -bottom-48 -left-24 h-[420px] w-[420px] rounded-full bg-gradient-to-tr from-indigo-200 via-white to-transparent blur-3xl opacity-70 float-slow" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.25),_transparent_55%)]" />
      </div>

      <div className="relative flex h-full">
        <aside className="hidden h-full w-[240px] flex-col border-r border-white/60 bg-white/70 px-5 py-6 shadow-[0_10px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl md:flex">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-600 text-white shadow-lg">
              <Droplet size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">FlowIntel</p>
              <p className="text-xs text-slate-500">Water observatory</p>
            </div>
          </div>

          <div className="mt-10 flex flex-1 flex-col gap-3 text-sm">
            <button
              onClick={() => setActiveTab('live')}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition ${
                activeTab === 'live'
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/15'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              <Home size={18} />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('predict')}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition ${
                activeTab === 'predict'
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/15'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              <Database size={18} />
              Forecasting
            </button>
            <button
              onClick={() => setActiveTab('footprint')}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition ${
                activeTab === 'footprint'
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/15'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              <Activity size={18} />
              Sustainability
            </button>
          </div>

          <div className="mt-auto rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 p-4 text-white shadow-xl">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-200">Live status</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm font-semibold">{isConnected ? 'Connected' : 'Disconnected'}</span>
              <span
                className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-400'}`}
              />
            </div>
            <p className="mt-2 text-xs text-slate-300">Streaming telemetry across the zone.</p>
          </div>
        </aside>

        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-6 md:px-8">
            <header className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Smart Indore</p>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                    Water Intelligence Command Center
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Real-time monitoring of distribution pressure, flow, and anomalies.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/ai-analysis"
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
                  >
                    <BrainCircuit size={16} /> AI Analyst
                  </Link>
                  <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300">
                    <Settings size={16} /> Customize view
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-4">
                  {stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="reveal-up flex min-w-[210px] flex-1 items-center gap-4 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-[0_12px_24px_rgba(15,23,42,0.08)] backdrop-blur"
                    >
                      <div className={`rounded-2xl bg-gradient-to-br ${stat.tone} p-3 ${stat.color}`}>
                        {stat.icon}
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{stat.label}</p>
                        <p className="text-2xl font-semibold text-slate-900">{stat.value}</p>
                        <p className="text-xs text-slate-500">{stat.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-400'}`}
                    />
                    {isConnected ? 'Live data stream' : 'Stream offline'}
                  </div>
                  <div className="flex items-center rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm">
                    <MapIcon size={14} className="mr-2 text-slate-400" />
                    Zone: {activeZone.name}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-600 shadow-sm">
                  <Filter size={14} className="text-slate-400" />
                  Filter
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-600 shadow-sm">
                  <Search size={16} className="text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search station, node, pipeline…"
                    className="w-56 bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />
                </div>
                <div className="ml-auto hidden items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-500 shadow-sm lg:flex">
                  <Activity size={14} className="text-emerald-500" />
                  Telemetry refresh <span className="text-slate-900">2s</span>
                </div>
              </div>
            </header>

            {activeTab === 'live' && (
              <div className="grid flex-1 grid-cols-1 gap-6 xl:grid-cols-[1.55fr_0.9fr]">
                <div className="flex min-h-[640px] flex-col gap-6">
                  <section className="flex min-h-[360px] flex-1 flex-col overflow-hidden rounded-3xl border border-white/70 bg-white/85 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Network map</p>
                        <h3 className="text-base font-semibold text-slate-900">Live stations & pipelines</h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <span className="rounded-full bg-slate-100 px-3 py-1">All stations</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">Alerts</span>
                      </div>
                    </div>
                    <div className="relative flex-1 bg-gradient-to-br from-slate-50 via-white to-slate-100">
                      <Map
                        zone={activeZone}
                        readings={readings}
                        selectedAsset={selectedAsset}
                        onSelectAsset={setSelectedAsset}
                      />
                    </div>
                  </section>

                  <section className="flex min-h-[220px] flex-1 flex-col rounded-3xl border border-white/70 bg-white/85 px-5 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">AI insights</p>
                        <h3 className="text-base font-semibold text-slate-900">Recommendations & anomaly context</h3>
                      </div>
                      <button
                        onClick={generateInsights}
                        disabled={isGenerating}
                        className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-100 disabled:opacity-60"
                      >
                        {isGenerating ? (
                          <Loader2 size={14} className="animate-spin text-indigo-700" />
                        ) : (
                          <Zap size={14} className="text-indigo-600" />
                        )}
                        Generate insights
                      </button>
                    </div>
                    <div className="mt-4 grid flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
                      {insights.length > 0 ? (
                        insights.map((insight, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
                          >
                            <div className="flex items-center gap-2 text-slate-700">
                              {insight.icon === 'BrainCircuit' ? (
                                <BrainCircuit size={16} className="text-indigo-500" />
                              ) : insight.icon === 'AlertTriangle' ? (
                                <AlertCircle size={16} className="text-rose-500" />
                              ) : (
                                <Droplet size={16} className="text-sky-500" />
                              )}
                              <h4 className="text-sm font-semibold">{insight.title}</h4>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">{insight.description}</p>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full flex h-full flex-col items-center justify-center gap-3 text-slate-400">
                          <BrainCircuit size={28} className="text-slate-300" />
                          <p className="text-sm">Run AI analysis to surface actionable insights.</p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                <div className="flex min-h-[640px] flex-col gap-6">
                  <section className="flex min-h-[360px] flex-1 flex-col rounded-3xl border border-white/70 bg-white/85 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Alert queue</p>
                        <h3 className="text-base font-semibold text-slate-900">Live telemetry feed</h3>
                      </div>
                      <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
                        {anomalyCount} critical
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-4">
                      <div className="space-y-3">
                        {orderedNodes.map((node) => {
                          const reading = readings[node.id];
                          const isRealTime = node.id === 'house_1';
                          const statusLabel = reading?.status || 'Offline';
                          const isNormal = statusLabel === 'Normal';

                          return (
                            <div
                              key={node.id}
                              onClick={() => setSelectedAsset({ type: 'house', id: node.id })}
                              className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                                selectedAsset?.id === node.id
                                  ? 'border-sky-200 bg-sky-50/40'
                                  : 'border-slate-200 bg-white/95'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`grid h-10 w-10 place-items-center rounded-2xl text-white shadow-sm ${
                                    isRealTime
                                      ? 'bg-indigo-500 shadow-indigo-400/30'
                                      : isNormal
                                        ? 'bg-emerald-400/90'
                                        : 'bg-rose-500/90'
                                  }`}
                                >
                                  <MapIcon size={16} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-slate-900">{node.name}</p>
                                    {isRealTime && (
                                      <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-700">
                                        hardware
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500">{node.label}</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span
                                  className={`rounded-full border px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                    isNormal
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                      : 'border-rose-200 bg-rose-50 text-rose-700'
                                  }`}
                                >
                                  {statusLabel}
                                </span>
                                <span className="text-base font-semibold text-slate-900">
                                  {reading?.flow_rate?.toFixed(1) || '0.0'} L/m
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>

                  <section className="flex min-h-[240px] flex-1 flex-col rounded-3xl border border-white/70 bg-white/85 px-5 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Network health</p>
                        <h3 className="text-base font-semibold text-slate-900">Alert distribution</h3>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">Updated just now</span>
                    </div>

                    <div className="mt-4 flex flex-1 flex-row items-stretch gap-8">
                      <div
                        className="relative grid h-52 w-52 place-items-center rounded-full"
                        style={{
                          background: `conic-gradient(#ef4444 0% ${anomalyPercent}%, #10b981 ${anomalyPercent}% ${
                            anomalyPercent + healthyPercent
                          }%, #e2e8f0 ${anomalyPercent + healthyPercent}% 100%)`,
                        }}
                      >
                        <div className="grid h-32 w-32 place-items-center rounded-full bg-white shadow-inner">
                          <div className="text-center">
                            <p className="text-2xl font-semibold text-slate-900">{healthyPercent}%</p>
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">Stable</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col gap-4">
                        <div className="flex flex-col gap-3 text-xs font-medium text-slate-600">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
                            <span>
                              <strong className="text-slate-900">{anomalyCount}</strong> Critical
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />
                            <span>
                              <strong className="text-slate-900">0</strong> Watchlist
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                            <span>
                              <strong className="text-slate-900">{healthyCount}</strong> Normal
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-sm bg-slate-200" />
                            <span>
                              <strong className="text-slate-900">0</strong> No data
                            </span>
                          </div>
                        </div>

                        <div className="grid flex-1 grid-cols-2 gap-3 auto-rows-fr">
                          <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">Total stations</p>
                            <p className="text-lg font-semibold text-slate-900">{activeZone.houses.length}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">Online rate</p>
                            <p className="text-lg font-semibold text-slate-900">{healthyPercent}%</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">Pressure avg</p>
                            <p className="text-lg font-semibold text-slate-900">
                              {(() => {
                                const pressures = currentReadings
                                  .map((r) => r.pressure)
                                  .filter((p) => typeof p === 'number');
                                if (!pressures.length) return '--';
                                const avg = pressures.reduce((sum, p) => sum + (p as number), 0) / pressures.length;
                                return `${avg.toFixed(1)} kPa`;
                              })()}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">Flow rate</p>
                            <p className="text-lg font-semibold text-slate-900">{totalDemand.toFixed(1)} L/m</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            )}

            {activeTab === 'predict' && <ForecastingPanel totalDemand={totalDemand} />}
            {activeTab === 'footprint' && <DigitalFootprint />}
          </div>
        </main>
      </div>

      <AquaBot context={{ totalDemand, anomalyCount, network, activeZone }} />
    </div>
  );
}
