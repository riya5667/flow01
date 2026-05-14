export type SensorStatus =
  | 'Normal'
  | 'Abnormal Flow'
  | 'Leak Risk'
  | 'No Flow'
  | 'Offline'
  | 'Sensor Error'
  | 'Night Leak Warning'
  | 'High Vibration'
  | 'High Humidity'
  | 'Low Water Level'
  | 'Water Leakage'
  | 'Water Theft'
  | 'Flow Stopped';

export type WaterHealth = 'Good' | 'Bad' | 'Unknown';

export interface SensorReading {
  house_id: string;
  pipeline_id?: string;
  zone_id?: string;
  flow1?: number;
  flow2?: number;
  flow_rate: number;
  pressure: number;
  tds?: number;
  vibration?: number;
  humidity?: number;
  distance_cm?: number;
  water_level?: number;
  leak?: number;
  theft?: number;
  buzzer?: number;
  water_health?: WaterHealth;
  status: SensorStatus;
  timestamp: string;
  is_mock?: boolean;
  alert_reasons?: string[];
}

export interface SensorAlert {
  id?: number;
  house_id: string;
  type: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp: string;
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
