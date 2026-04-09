import { formatFlow, formatPressure, formatTime } from '../utils/format';
import { getStatusColor, getStatusLabel } from '../utils/status';
import { AssetSelection, SensorReading, WaterZone } from '../utils/types';

interface LegendProps {
  zone: WaterZone;
  selectedAsset: AssetSelection | null;
  readings: Record<string, SensorReading>;
  isConnected: boolean;
}

const Legend = ({ zone, selectedAsset, readings, isConnected }: LegendProps) => {
  const selectedHouse =
    selectedAsset?.type === 'house' ? zone.houses.find((house) => house.id === selectedAsset.id) : undefined;
  const selectedPipeline =
    selectedAsset?.type === 'pipeline'
      ? zone.pipelines.find((pipeline) => pipeline.id === selectedAsset.id)
      : undefined;
  const selectedReading = readings[selectedHouse?.id || selectedPipeline?.houseId || ''];

  return (
    <aside className="legend-panel flex h-full flex-col gap-5 rounded-[1.8rem] border border-[rgba(34,52,58,0.2)] bg-[rgba(30,44,46,0.92)] p-5 text-[var(--paper)] shadow-[0_28px_80px_rgba(17,26,27,0.2)]">
      <div className="border-b border-[rgba(240,236,226,0.12)] pb-4">
        <p className="eyebrow text-[rgba(240,236,226,0.64)]">Telemetry Brief</p>
        <h2 className="mt-2 text-xl font-semibold">{zone.name}</h2>
        <p className="mt-2 text-sm leading-6 text-[rgba(240,236,226,0.72)]">{zone.description}</p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[rgba(240,236,226,0.72)]">Control link</span>
          <span className={`font-semibold ${isConnected ? 'text-[#98d2d7]' : 'text-[#f2c14e]'}`}>
            {isConnected ? 'Socket active' : 'Buffering updates'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[rgba(240,236,226,0.72)]">Source capacity</span>
          <span className="font-semibold">{zone.tank.capacityLpm} L/min</span>
        </div>
      </section>

      <section className="rounded-[1.4rem] border border-[rgba(240,236,226,0.12)] bg-[rgba(255,255,255,0.04)] p-4">
        <p className="eyebrow text-[rgba(240,236,226,0.54)]">Legend</p>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <span className="h-2 w-12 rounded-full" style={{ backgroundColor: '#118ab2' }} />
            <span>Blue pipeline: Normal flow</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="h-2 w-12 rounded-full" style={{ backgroundColor: '#f2c14e' }} />
            <span>Yellow pipeline: Abnormal or high flow</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="h-2 w-12 rounded-full" style={{ backgroundColor: '#d84f4f' }} />
            <span>Red pipeline: No flow or leak risk</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex gap-1">
              <span className="flow-dot-preview" />
              <span className="flow-dot-preview flow-dot-preview-soft" />
            </span>
            <span>Animated blue dots: Active water movement</span>
          </div>
        </div>
      </section>

      <section className="flex-1 rounded-[1.4rem] border border-[rgba(240,236,226,0.12)] bg-[rgba(255,255,255,0.04)] p-4">
        <p className="eyebrow text-[rgba(240,236,226,0.54)]">Selected Asset</p>
        <div className="mt-4 space-y-3 text-sm">
          <div className="text-lg font-semibold">
            {selectedAsset?.type === 'tank'
              ? zone.tank.label
              : selectedHouse?.name || selectedPipeline?.label || 'Select a pipeline or house'}
          </div>
          <div className="text-[rgba(240,236,226,0.72)]">
            {selectedAsset?.type === 'tank'
              ? 'Primary municipal source node feeding the active district.'
              : selectedHouse?.label || 'Click map features to inspect live telemetry.'}
          </div>
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-[rgba(240,236,226,0.64)]">Status</span>
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: `${getStatusColor(selectedReading?.status || 'Offline')}24` }}
              >
                {getStatusLabel(selectedReading?.status || 'Offline')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[rgba(240,236,226,0.64)]">Flow</span>
              <span>{formatFlow(selectedReading?.flow_rate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[rgba(240,236,226,0.64)]">Pressure</span>
              <span>{formatPressure(selectedReading?.pressure)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[rgba(240,236,226,0.64)]">Last update</span>
              <span>{formatTime(selectedReading?.timestamp)}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.4rem] border border-[rgba(240,236,226,0.12)] bg-[rgba(255,255,255,0.04)] p-4 text-sm leading-6 text-[rgba(240,236,226,0.72)]">
        Hover on pipelines for quick labels. Click lines or houses to open full popup telemetry with flow, pressure,
        status, and timestamp from the Node.js stream.
      </section>
    </aside>
  );
};

export default Legend;
