const zones = [
  {
    id: 'zone-super-corridor',
    name: 'Indore City Central Grid',
    areaLabel: 'Indore East Service Area',
    description:
      'Primary residential and commercial distribution network routing through dense urban alleyways.',
    center: [22.6963268, 75.9316839],
    tank: {
      id: 'tank-super-corridor',
      label: 'Main City Reservoir',
      position: [22.6978, 75.9288],
      capacityLpm: 3200,
    },
    houses: [
      {
        id: 'house_1',
        name: 'Scheme 114 Homes',
        label: 'Residential Cluster A',
        position: [22.6989, 75.9346],
        demandBand: 'Standard',
      }
    ],
    pipelines: [
      {
        id: 'pipe_1',
        label: 'Alleyway Line P-01',
        houseId: 'house_1',
        points: [
          [22.6978, 75.9288], [22.6979, 75.9295], [22.6980, 75.9299],
          [22.6984, 75.9301], [22.6985, 75.9306], [22.6984, 75.9312],
          [22.6986, 75.9318], [22.6988, 75.9324], [22.6987, 75.9331],
          [22.6989, 75.9335], [22.6988, 75.9341], [22.6989, 75.9346],
        ],
      }
    ],
  },
];

const houses = zones.flatMap((zone) =>
  zone.houses.map((house) => {
    const pipeline = zone.pipelines.find((item) => item.houseId === house.id);

    return {
      ...house,
      zoneId: zone.id,
      zoneName: zone.name,
      pipelineId: pipeline?.id,
      pipelineLabel: pipeline?.label,
      tankId: zone.tank.id,
    };
  }),
);

const houseMap = new Map(houses.map((house) => [house.id, house]));

const getNetworkSnapshot = () => ({
  generatedAt: new Date().toISOString(),
  zones,
});

const getHouseById = (houseId) => houseMap.get(houseId);

module.exports = {
  zones,
  houses,
  getNetworkSnapshot,
  getHouseById,
};
