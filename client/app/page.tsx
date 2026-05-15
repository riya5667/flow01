'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Bell,
  CalendarDays,
  ChevronDown,
  Download,
  Droplet,
  FileText,
  Filter,
  Grid2X2,
  LayoutDashboard,
  Loader2,
  Search,
  Settings2,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { AssetSelection } from '../utils/types';
import { formatTds } from '../utils/format';
import ForecastingPanel from '../components/ForecastingPanel';
import DigitalFootprint from '../components/DigitalFootprint';
import AquaBot from '../components/AquaBot';

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ObservatoryDashboard() {
  const { network, readings, isConnected, isLoading, stats: backendStats, alerts } = useSocket();
  const [selectedAsset, setSelectedAsset] = useState<AssetSelection | null>(null);
  const [activeTab, setActiveTab] = useState<'live' | 'predict' | 'footprint'>('live');
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);

  const currentReadings = useMemo(() => Object.values(readings || {}), [readings]);
  const activeZone = network?.zones[0];
  const physicalNode = currentReadings.find((reading) => reading.house_id === 'house_1');
  const physicalWaterHealth = physicalNode?.water_health || 'Unknown';
  const physicalTds = physicalNode?.tds || 0;
  const flow1 = physicalNode?.flow1 ?? physicalNode?.flow_rate ?? 0;
  const flow2 = physicalNode?.flow2 ?? 0;
  const humidity = Number.isFinite(physicalNode?.humidity) ? Number(physicalNode?.humidity) : null;
  const humidityValue = humidity ?? 0;
  const measuredWaterLevel = Number.isFinite(physicalNode?.water_level) ? Number(physicalNode?.water_level) : null;
  const leak = physicalNode?.leak ?? 0;
  const theft = physicalNode?.theft ?? 0;
  const buzzer = physicalNode?.buzzer ?? 0;
  const hardwareAlert = !!physicalNode && (humidityValue > 75 || leak === 1 || theft === 1 || buzzer === 1 || physicalNode.status !== 'Normal');

  const totals = useMemo(() => {
    return currentReadings.reduce(
      (acc, reading) => {
        acc.demand += reading.flow_rate || 0;
        if (reading.status === 'Normal') acc.healthy += 1;
        else acc.alerts += 1;
        return acc;
      },
      { demand: 0, healthy: 0, alerts: 0 },
    );
  }, [currentReadings]);

  const totalCumulativeFlow = useMemo(() => {
    if (!backendStats) return 0;
    return backendStats.reduce((sum: number, stat: any) => sum + (stat.cumulative_flow_liters || 0), 0);
  }, [backendStats]);

  const healthyPercent = currentReadings.length
    ? Math.round((totals.healthy / currentReadings.length) * 100)
    : 100;
  const waterLevel = measuredWaterLevel ?? Math.min(94, Math.max(14, ((flow1 + flow2) / 22) * 100 || healthyPercent));

  const monthlyDemand = monthLabels.map((month, index) => {
    const seasonalOffset = [0.44, 0.3, 0.62, 0.36, 0.68, 0.82, 1, 0.74, 0.96, 0.7, 0.55, 0.78][index];
    const liveBoost = Math.min(totals.demand * 5, 28);
    return {
      month,
      value: Math.round(120 + seasonalOffset * 780 + liveBoost),
    };
  });
  const chartMax = Math.max(...monthlyDemand.map((item) => item.value), 1000);

  const sendWhatsAppReport = async () => {
    setIsSendingReport(true);
    setReportStatus(null);

    try {
      const response = await fetch('/api/whatsapp/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.ok) {
        const reason = payload.result?.reason;
        const message =
          reason === 'missing_meta_config' || reason === 'missing_config'
            ? 'Meta WhatsApp is not configured on the server'
            : payload.error || payload.result?.reason || 'WhatsApp report was not sent';

        throw new Error(message);
      }

      setReportStatus(`Report sent on WhatsApp${payload.result?.provider ? ` via ${payload.result.provider}` : ''}`);
    } catch (error: any) {
      setReportStatus(error?.message || 'Report send failed');
    } finally {
      setIsSendingReport(false);
    }
  };

  useEffect(() => {
    if (!network?.zones.length) return;
    if (!selectedAsset) {
      setSelectedAsset({ type: 'tank', id: network.zones[0].tank.id });
    }
  }, [network, selectedAsset]);

  if (isLoading || !network || !activeZone) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f3f3f1] text-[#111]">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#38d4e8]" />
          <h1 className="text-xl font-semibold">Initializing FlowIntel</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#e9e9e7] p-4 text-[#101010] sm:p-5 xl:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-[1640px] flex-col rounded-[22px] border border-white/80 bg-[#f7f7f5] p-5 shadow-[0_28px_90px_rgba(20,20,20,0.14)] sm:p-6 xl:p-7">
        <header className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#38d4e8] text-[#064e58]">
              <Droplet size={25} fill="currentColor" />
            </div>
            <span className="text-2xl font-semibold tracking-tight">FlowIntel</span>
          </div>

          <nav className="flex flex-wrap items-center rounded-full bg-white/78 p-1 text-sm font-semibold shadow-[0_10px_28px_rgba(18,18,18,0.06)]">
            <button
              onClick={() => setActiveTab('live')}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-3 transition ${
                activeTab === 'live' ? 'bg-[#0f6f7a] text-white shadow-lg shadow-[#0f6f7a]/20' : 'text-[#191919]'
              }`}
            >
              <LayoutDashboard size={16} />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('predict')}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-3 transition ${
                activeTab === 'predict' ? 'bg-[#0f6f7a] text-white shadow-lg shadow-[#0f6f7a]/20' : 'text-[#191919]'
              }`}
            >
              <Activity size={16} />
              Analytics
            </button>
            <button className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-[#191919]">
              <Grid2X2 size={16} />
              Nodes
            </button>
            <Link href="/ai-analysis" className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-[#191919]">
              <FileText size={16} />
              AI Report
            </Link>
            <Link href="/alerts-reports" className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-[#191919]">
              <Bell size={16} />
              Alerts
            </Link>
            <button
              onClick={() => setActiveTab('footprint')}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-3 transition ${
                activeTab === 'footprint' ? 'bg-[#0f6f7a] text-white shadow-lg shadow-[#0f6f7a]/20' : 'text-[#191919]'
              }`}
            >
              <CalendarDays size={16} />
              Footprint
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <button className="grid h-12 w-12 place-items-center rounded-full bg-white text-[#161616] shadow-[0_10px_25px_rgba(18,18,18,0.06)]">
              <Search size={20} />
            </button>
            <button className="relative grid h-12 w-12 place-items-center rounded-full bg-white text-[#161616] shadow-[0_10px_25px_rgba(18,18,18,0.06)]">
              <Bell size={19} />
              {alerts.length > 0 && <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-[#ff5c35]" />}
            </button>
            <div className="flex items-center gap-3 rounded-full bg-white px-2 py-1.5 shadow-[0_10px_25px_rgba(18,18,18,0.06)]">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-[#0f6f7a] text-sm font-bold text-white">FI</div>
              <ChevronDown size={18} />
            </div>
          </div>
        </header>

        <main className="mt-7 flex flex-1 flex-col">
          <section className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <h1 className="text-[clamp(1.85rem,3.4vw,3rem)] font-semibold leading-none tracking-[-0.04em]">
                Water Overview
              </h1>
              <p className="mt-3 text-base font-medium text-[#6d6d68]">
                Analyze distribution health to make data-driven decisions
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold shadow-[0_10px_25px_rgba(18,18,18,0.06)]">
                Monthly
                <ChevronDown size={16} />
              </button>
              <button
                onClick={sendWhatsAppReport}
                disabled={isSendingReport}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold shadow-[0_10px_25px_rgba(18,18,18,0.06)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSendingReport ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Send report
              </button>
              <button className="inline-flex items-center gap-2 rounded-full bg-[#0f6f7a] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(15,111,122,0.22)]">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#38d4e8] text-[#064e58]">
                  <Filter size={16} />
                </span>
                Filter
              </button>
            </div>
          </section>
          {reportStatus && (
            <div className="mt-3 inline-flex rounded-full bg-white px-4 py-2 text-xs font-bold text-[#0f6f7a] shadow-[0_10px_25px_rgba(18,18,18,0.06)]">
              {reportStatus}
            </div>
          )}

          {activeTab === 'live' && (
            <div className="mt-7 flex flex-1 flex-col gap-5">
              <section className="grid gap-5 xl:grid-cols-[1fr_1fr_1.15fr]">
                <article className="relative min-h-[170px] overflow-hidden rounded-[22px] bg-[#38d4e8] p-5 shadow-[0_18px_45px_rgba(15,111,122,0.18)] xl:p-6">
                  <div className="absolute inset-y-0 right-0 w-3/5 bg-[linear-gradient(135deg,rgba(255,255,255,0.18)_0_45%,transparent_45%)]" />
                  <div className="relative z-10 flex h-full flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-medium tracking-[-0.04em]">Total Flow</h2>
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-white/90">
                        <TrendingUp size={19} />
                      </span>
                    </div>
                    <div>
                      <p className="text-2xl font-semibold tracking-[-0.04em]">{totalCumulativeFlow.toFixed(1)} L</p>
                      <div className="mt-3 flex items-center gap-3 text-xs font-bold">
                        <span className="rounded-full bg-white/70 px-3 py-1.5">+ {Math.max(healthyPercent - 80, 4)}%</span>
                        <span>Than last month</span>
                      </div>
                    </div>
                  </div>
                </article>

                <article className="relative min-h-[170px] overflow-hidden rounded-[22px] bg-white p-5 shadow-[0_18px_45px_rgba(18,18,18,0.06)] xl:p-6">
                  <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0_42%,rgba(240,240,238,0.9)_42%_62%,transparent_62%)]" />
                  <div className="relative z-10 flex h-full flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-medium tracking-[-0.04em]">Live Demand</h2>
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f7f7f5]">
                        <Zap size={19} />
                      </span>
                    </div>
                    <div>
                      <p className="text-2xl font-semibold tracking-[-0.04em]">{totals.demand.toFixed(1)} L/m</p>
                      <div className="mt-3 flex items-center gap-3 text-xs font-bold">
                        <span className="rounded-full bg-[#38d4e8] px-3 py-1.5">+ {Math.max(totals.healthy, 1)} stable</span>
                        <span>Live network load</span>
                      </div>
                    </div>
                  </div>
                </article>

                <article className="relative min-h-[170px] rounded-[22px] bg-white p-5 shadow-[0_18px_45px_rgba(18,18,18,0.06)] xl:p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-medium tracking-[-0.04em]">Water Target</h2>
                      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{formatTds(physicalTds)}</p>
                    </div>
                    <button className="grid h-10 w-10 place-items-center rounded-full bg-[#f7f7f5]">
                      <Settings2 size={18} />
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-[1.35fr_0.75fr_0.25fr] gap-2">
                    <div className="h-7 rounded-lg bg-[#0f6f7a] bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.12)_0_2px,transparent_2px_7px)]" />
                    <div className="h-7 rounded-lg bg-[#38d4e8] bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.2)_0_2px,transparent_2px_7px)]" />
                    <div className="h-7 rounded-lg bg-[#c9f8ff] bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.4)_0_2px,transparent_2px_7px)]" />
                  </div>
                  <div className="mt-3 flex justify-between text-[10px] font-semibold text-[#85857f]">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#0f6f7a]" />
                      TDS
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#38d4e8]" />
                      Total Flow
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#c9f8ff]" />
                      Target
                    </span>
                  </div>
                </article>
              </section>

              <section className="grid gap-5 xl:grid-cols-[0.62fr_1.38fr]">
                <article className="min-h-[240px] overflow-hidden rounded-[22px] bg-white p-6 shadow-[0_18px_45px_rgba(18,18,18,0.06)] xl:p-7">
                  <div className="flex h-full items-center justify-between gap-5">
                    <div className="min-w-[140px]">
                      <h2 className="text-xl font-semibold tracking-[-0.03em]">Tank Level</h2>
                      <p className="mt-1 text-sm font-medium text-[#8f8f89]">Animated live reservoir</p>
                      <span className="mt-4 inline-flex rounded-full bg-[#e6fbff] px-4 py-2 text-sm font-bold text-[#0f6f7a]">
                        {waterLevel.toFixed(0)}% full
                      </span>
                    </div>

                    <div className="flex items-end justify-center gap-4">
                      <div className="relative h-36 w-28 overflow-hidden rounded-b-[30px] rounded-t-[18px] border-[5px] border-[#d9f7fb] bg-[#f7f7f5] shadow-inner">
                          <div className="absolute inset-x-3 top-4 z-20 flex justify-between">
                            {[80, 60, 40, 20].map((mark) => (
                              <span key={mark} className="h-px w-3 bg-[#b7dfe5]" />
                            ))}
                          </div>
                          <div
                            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0f6f7a] via-[#24bcd0] to-[#67e6f4] transition-[height] duration-700 ease-out"
                            style={{ height: `${waterLevel}%` }}
                          >
                            <div className="absolute -top-3 left-[-25%] h-8 w-[150%] animate-[waterWave_3s_ease-in-out_infinite] rounded-[50%] bg-[#c9f8ff]/80" />
                            <div className="absolute -top-2 left-[-15%] h-7 w-[135%] animate-[waterWave_4.6s_ease-in-out_infinite_reverse] rounded-[50%] bg-white/30" />
                            <span className="absolute left-8 top-8 h-3 w-3 animate-[bubbleRise_3.8s_ease-in_infinite] rounded-full bg-white/60" />
                            <span className="absolute right-9 top-16 h-2 w-2 animate-[bubbleRise_4.8s_ease-in_infinite] rounded-full bg-white/50" />
                            <span className="absolute left-14 top-24 h-2.5 w-2.5 animate-[bubbleRise_4.2s_ease-in_infinite] rounded-full bg-white/45" />
                          </div>
                          <div className="absolute inset-x-0 bottom-5 z-30 text-center text-3xl font-semibold tracking-[-0.04em] text-white drop-shadow">
                            {waterLevel.toFixed(0)}
                          </div>
                      </div>
                    </div>
                  </div>
                </article>

                <article className="min-h-[240px] overflow-hidden rounded-[22px] bg-white p-6 shadow-[0_18px_45px_rgba(18,18,18,0.06)] xl:p-7">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold tracking-[-0.03em]">Live Hardware State</h2>
                      <p className="text-sm font-medium text-[#8f8f89]">Arduino node and environmental sensors</p>
                    </div>
                    <span
                      className={`rounded-full px-4 py-2 text-xs font-bold ${
                        hardwareAlert ? 'bg-[#ffe7df] text-[#b73717]' : 'bg-[#e6fbff] text-[#0f6f7a]'
                      }`}
                    >
                      {hardwareAlert ? physicalNode?.status || 'Alert' : 'Normal'}
                    </span>
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      ['Flow 1', `${flow1.toFixed(2)} L/m`],
                      ['Flow 2', `${flow2.toFixed(2)} L/m`],
                      ['Humidity', humidity === null ? 'Waiting' : `${humidity.toFixed(0)}%`],
                      ['Leakage', leak === 1 ? 'Found' : 'Clear'],
                      ['Theft', theft === 1 ? 'Found' : 'Clear'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl bg-[#f7f7f5] p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#999991]">{label}</p>
                        <p className="mt-2 text-xl font-semibold tracking-[-0.03em]">{value}</p>
                      </div>
                    ))}
                  </div>
                </article>
              </section>

              <section className="grid flex-1 gap-5">
                <article className="rounded-[22px] bg-white p-6 shadow-[0_18px_45px_rgba(18,18,18,0.06)] xl:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-medium tracking-[-0.04em]">Water Flow Statistics</h2>
                      <p className="mt-1 text-sm font-medium text-[#8f8f89]">
                        Stable stations: {healthyPercent}% &bull; Health: {physicalWaterHealth}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs font-bold">
                      <button className="inline-flex items-center gap-2 rounded-full bg-[#f4f4f2] px-4 py-2">
                        Flow Overview
                        <ChevronDown size={15} />
                      </button>
                      <button className="inline-flex items-center gap-2 rounded-full bg-[#f4f4f2] px-4 py-2">
                        Summary
                        <ChevronDown size={15} />
                      </button>
                      <button className="inline-flex items-center gap-2 rounded-full bg-[#0f6f7a] px-4 py-2 text-white">
                        Yearly
                        <ChevronDown size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-7 grid min-h-[340px] grid-cols-[58px_1fr] gap-5">
                    <div className="flex flex-col justify-between pb-9 pt-1 text-xs font-semibold text-[#5f5f59]">
                      <span>$1000</span>
                      <span>$750</span>
                      <span>$500</span>
                      <span>$25</span>
                      <span>$0</span>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-x-0 top-0 h-full">
                        {[0, 1, 2, 3, 4].map((line) => (
                          <div
                            key={line}
                            className="absolute left-0 right-0 border-t border-dashed border-[#deded9]"
                            style={{ top: `${line * 23}%` }}
                          />
                        ))}
                      </div>
                      <div className="relative z-10 grid h-full grid-cols-12 items-end gap-4 pb-9">
                        {monthlyDemand.map((item) => {
                          const height = Math.max(14, (item.value / chartMax) * 100);
                          const isSelected = item.month === 'Jun';
                          return (
                            <button
                              key={item.month}
                              className="group flex h-full min-w-0 flex-col items-center justify-end gap-3"
                              aria-label={`${item.month} demand ${item.value}`}
                            >
                              {isSelected && (
                                <span className="mb-1 rounded-2xl bg-white px-4 py-3 text-left text-sm font-semibold shadow-[0_12px_32px_rgba(18,18,18,0.16)]">
                                  <span className="block text-[11px] text-[#8c8c86]">Flow</span>
                                  {item.value}.00
                                </span>
                              )}
                              <span
                                className="w-full rounded-t-xl bg-[#38d4e8] bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.26)_0_2px,transparent_2px_7px)] transition group-hover:bg-[#0f6f7a]"
                                style={{ height: `${height}%` }}
                              />
                              <span className="text-xs font-medium text-[#5f5f59]">{item.month}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </article>
              </section>

            </div>
          )}

          {activeTab === 'predict' && (
            <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-[24px] bg-white p-6 shadow-[0_18px_45px_rgba(18,18,18,0.06)]">
              <ForecastingPanel totalDemand={totals.demand} />
            </div>
          )}

          {activeTab === 'footprint' && (
            <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-[24px] bg-white p-6 shadow-[0_18px_45px_rgba(18,18,18,0.06)]">
              <DigitalFootprint />
            </div>
          )}
        </main>
      </div>

      <AquaBot context={{
        totalDemand: totals.demand,
        anomalyCount: totals.alerts,
        network,
        activeZone,
        liveReadings: {
          flow1: flow1.toFixed(2),
          flow2: flow2.toFixed(2),
          humidity: humidity !== null ? humidity.toFixed(1) : 'N/A',
          leak: leak === 1 ? 'DETECTED' : 'Clear',
          theft: theft === 1 ? 'DETECTED' : 'Clear',
          tds: physicalTds,
          waterHealth: physicalWaterHealth,
          waterLevel: waterLevel.toFixed(1),
          status: physicalNode?.status || 'Offline',
          buzzer: buzzer === 1 ? 'Active' : 'Off',
        }
      }} />
    </div>
  );
}
