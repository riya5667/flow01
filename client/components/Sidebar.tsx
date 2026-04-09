import { Activity, AlertTriangle, Gauge, Radio, Waves, WifiOff } from 'lucide-react';
import { formatFlow, formatPressure, formatTime } from '../utils/format';
import { getReadingState, getStatusColor, getStatusLabel } from '../utils/status';
import { AssetSelection, SensorReading, WaterZone } from '../utils/types';

interface SidebarProps {
  zones: WaterZone[];
  selectedZoneId: string;
  onSelectZone: (zoneId: string) => void;
  onSelectAsset: (selection: AssetSelection) => void;
  readings: Record<string, SensorReading>;
  isConnected: boolean;
  selectedAsset: AssetSelection | null;
}

const Sidebar = ({
  zones,
  selectedZoneId,
  onSelectZone,
  onSelectAsset,
  readings,
  isConnected,
  selectedAsset,
}: SidebarProps) => {
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId) || zones[0];
  const zoneReadings = selectedZone.houses.map((house) => readings[house.id]);
  const totalFlow = zoneReadings.reduce((sum, reading) => sum + (reading?.flow_rate || 0), 0);
  const averagePressure =
    zoneReadings.reduce((sum, reading) => sum + (reading?.pressure || 0), 0) /
    Math.max(zoneReadings.length, 1);
  const activeAlerts = zoneReadings.filter((reading) => {
    const state = getReadingState(reading);
    return state !== 'Normal' && state !== 'Offline';
  }).length;

  return (
    <aside className="control-panel flex h-full flex-col gap-6 overflow-hidden rounded-[1.8rem] border border-[rgba(34,52,58,0.22)] bg-[rgba(241,238,229,0.88)] p-5 shadow-[0_28px_80px_rgba(25,38,41,0.14)] backdrop-blur">
      <div className="flex items-start justify-between gap-4 border-b border-[rgba(34,52,58,0.12)] pb-4">
        <div>
          <p className="eyebrow">Municipal Control Deck</p>
          <h1 className="mt-2 text-[clamp(1.6rem,2vw,2.3rem)] font-semibold leading-none text-[var(--ink-strong)]">
            FlowIntel
          </h1>
          <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--ink-soft)]">
            Live service supervision for district water distribution, leak triage, and pressure stability.
          </p>
        </div>
        <div className={`status-pill ${isConnected ? 'status-pill-live' : 'status-pill-offline'}`}>
          {isConnected ? <Radio size={16} /> : <WifiOff size={16} />}
          <span>{isConnected ? 'Telemetry Live' : 'Socket Offline'}</span>
        </div>
      </div>

      <section>
        <p className="eyebrow">Active Zones</p>
        <div className="mt-3 grid gap-3">
          {zones.map((zone) => (
            <button
              key={zone.id}
              onClick={() => onSelectZone(zone.id)}
              className={`zone-button ${zone.id === selectedZoneId ? 'zone-button-active' : ''}`}
            >
              <div>
                <div className="text-sm font-semibold text-[var(--ink-strong)]">{zone.name}</div>
                <div className="text-xs text-[var(--ink-soft)]">{zone.areaLabel}</div>
              </div>
              <div className="text-right text-xs text-[var(--ink-soft)]">
                <div>{zone.houses.length} endpoints</div>
                <div>{zone.tank.capacityLpm} L/min cap</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="metric-slab">
          <Waves className="metric-icon" />
          <span className="metric-label">Total Flow</span>
          <strong>{formatFlow(totalFlow)}</strong>
        </div>
        <div className="metric-slab">
          <Gauge className="metric-icon" />
          <span className="metric-label">Avg Pressure</span>
          <strong>{formatPressure(averagePressure)}</strong>
        </div>
        <div className="metric-slab">
          <AlertTriangle className="metric-icon" />
          <span className="metric-label">Alerts</span>
          <strong>{activeAlerts} active</strong>
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Service Nodes</p>
          <button
            className="text-xs font-medium text-[var(--signal-blue)]"
            onClick={() => onSelectAsset({ type: 'tank', id: selectedZone.tank.id })}
          >
            Focus source
          </button>
        </div>
        <div className="mt-3 flex-1 space-y-3 overflow-auto pr-1">
          {selectedZone.houses.map((house) => {
            const reading = readings[house.id];
            const state = getReadingState(reading);
            const isSelected = selectedAsset?.type === 'house' && selectedAsset.id === house.id;

            return (
              <button
                key={house.id}
                onClick={() => onSelectAsset({ type: 'house', id: house.id })}
                className={`node-row ${isSelected ? 'node-row-selected' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-3.5 w-3.5 rounded-full" style={{ backgroundColor: getStatusColor(state) }} />
                  <div className="text-left">
                    <div className="text-sm font-semibold text-[var(--ink-strong)]">{house.name}</div>
                    <div className="text-xs text-[var(--ink-soft)]">{house.label}</div>
                    <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                      {getStatusLabel(state)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-[var(--ink-strong)]">{formatFlow(reading?.flow_rate)}</div>
                  <div className="text-xs text-[var(--ink-soft)]">{formatPressure(reading?.pressure)}</div>
                  <div className="mt-2 text-[11px] text-[var(--ink-muted)]">{formatTime(reading?.timestamp)}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[1.4rem] border border-[rgba(34,52,58,0.12)] bg-[rgba(255,255,255,0.45)] px-4 py-3">
        <div className="flex items-center gap-3 text-[var(--ink-strong)]">
          <Activity size={18} />
          <div className="text-sm font-semibold">Operator note</div>
        </div>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
          Use the zone selector to switch service districts, then click any pipeline or house for live telemetry and
          maintenance context.
        </p>
      </section>
    </aside>
  );
};

export default Sidebar;
