export type SensorStatus =
  | 'Normal'
  | 'Abnormal Flow'
  | 'Leak Risk'
  | 'No Flow'
  | 'Offline';

export interface SensorReading {
  house_id: string;
  pipeline_id?: string;
  zone_id?: string;
  flow_rate: number;
  pressure: number;
  status: SensorStatus;
  timestamp: string;
  is_mock?: boolean;
}

export interface WaterTank {
  id: string;
  label: string;
  position: [number, number];
  capacityLpm: number;
}

export interface HouseNode {
  id: string;
  name: string;
  label: string;
  position: [number, number];
  demandBand: string;
}

export interface Pipeline {
  id: string;
  label: string;
  houseId: string;
  points: [number, number][];
}

export interface WaterZone {
  id: string;
  name: string;
  areaLabel: string;
  description: string;
  center: [number, number];
  tank: WaterTank;
  houses: HouseNode[];
  pipelines: Pipeline[];
}

export interface NetworkSnapshot {
  generatedAt: string;
  zones: WaterZone[];
}

export type AssetSelection =
  | { type: 'tank'; id: string }
  | { type: 'house'; id: string }
  | { type: 'pipeline'; id: string };
