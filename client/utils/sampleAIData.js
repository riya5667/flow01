const sampleAIData = {
  currentFlow: 6.4,
  lastReadings: [
    { houseId: 'house_1', flowRate: 6.4, pressure: 58.9, status: 'Alert', time: '2026-04-08T09:30:00Z' },
    { houseId: 'house_2', flowRate: 8.2, pressure: 60.1, status: 'Warning', time: '2026-04-08T09:30:00Z' },
    { houseId: 'house_3', flowRate: 14.1, pressure: 67.7, status: 'Normal', time: '2026-04-08T09:30:00Z' },
    { houseId: 'house_4', flowRate: 4.9, pressure: 55.2, status: 'Alert', time: '2026-04-08T09:30:00Z' },
  ],
  baseline: 11.8,
  zone: 'Sample Zone - Indore East',
  time: '2026-04-08T09:30:00Z',
  alerts: [
    { houseId: 'house_3', status: 'Alert', flowRate: 41.3, pressure: 64.7 },
  ],
};

export default sampleAIData;
