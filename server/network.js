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
      },
      {
        id: 'house_2',
        name: 'Tulsi Nagar Block',
        label: 'Residential Cluster B',
        position: [22.6947, 75.9363],
        demandBand: 'High',
      },
      {
        id: 'house_3',
        name: 'Service Quarters East',
        label: 'Administration Offices',
        position: [22.6935, 75.9304],
        demandBand: 'Standard',
      },
      {
        id: 'house_4',
        name: 'Ring Road Villas',
        label: 'Residential Estate',
        position: [22.7025, 75.9402],
        demandBand: 'Standard',
      },
      {
        id: 'house_5',
        name: 'Community Health Centre',
        label: 'Priority Supply Node',
        position: [22.6992, 75.9416],
        demandBand: 'Critical',
      },
      {
        id: 'house_6',
        name: 'Apartment Cluster North',
        label: 'High-Density Residential',
        position: [22.6974, 75.9386],
        demandBand: 'High',
      },
      {
        id: 'house_7',
        name: 'Palasia Market',
        label: 'Commercial Hub',
        position: [22.7015, 75.9250],
        demandBand: 'High',
      },
      {
        id: 'house_8',
        name: 'Bhawarkuan Junction',
        label: 'Transport Node',
        position: [22.6920, 75.9250],
        demandBand: 'Critical',
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
      },
      {
        id: 'pipe_2',
        label: 'Tulsi Sector Line P-02',
        houseId: 'house_2',
        points: [
          [22.6978, 75.9288], [22.6974, 75.9291], [22.6968, 75.9292],
          [22.6965, 75.9296], [22.6965, 75.9304], [22.6962, 75.9311],
          [22.6959, 75.9315], [22.6956, 75.9322], [22.6955, 75.9334],
          [22.6953, 75.9345], [22.6950, 75.9354], [22.6948, 75.9359],
          [22.6947, 75.9363],
        ],
      },
      {
        id: 'pipe_3',
        label: 'Admin Branch P-03',
        houseId: 'house_3',
        points: [
          [22.6978, 75.9288], [22.6973, 75.9283], [22.6965, 75.9280],
          [22.6958, 75.9276], [22.6951, 75.9274], [22.6945, 75.9277],
          [22.6941, 75.9282], [22.6938, 75.9289], [22.6936, 75.9296],
          [22.6934, 75.9300], [22.6935, 75.9304],
        ],
      },
      {
        id: 'pipe_4',
        label: 'Ring Road Main P-04',
        houseId: 'house_4',
        points: [
          [22.6978, 75.9288], [22.6985, 75.9289], [22.6991, 75.9292],
          [22.6995, 75.9298], [22.6998, 75.9306], [22.7001, 75.9315],
          [22.7003, 75.9328], [22.7005, 75.9340], [22.7008, 75.9352],
          [22.7011, 75.9368], [22.7014, 75.9382], [22.7020, 75.9395],
          [22.7025, 75.9402],
        ],
      },
      {
        id: 'pipe_5',
        label: 'Health Node Loop P-05',
        houseId: 'house_5',
        points: [
          [22.6978, 75.9288], [22.6982, 75.9290], [22.6984, 75.9298],
          [22.6982, 75.9308], [22.6983, 75.9320], [22.6981, 75.9332],
          [22.6981, 75.9346], [22.6980, 75.9360], [22.6982, 75.9372],
          [22.6985, 75.9385], [22.6987, 75.9398], [22.6990, 75.9408],
          [22.6992, 75.9416],
        ],
      },
      {
        id: 'pipe_6',
        label: 'North Heights Line P-06',
        houseId: 'house_6',
        points: [
          [22.6978, 75.9288], [22.6975, 75.9294], [22.6975, 75.9305],
          [22.6972, 75.9316], [22.6972, 75.9328], [22.6968, 75.9340],
          [22.6968, 75.9352], [22.6970, 75.9363], [22.6972, 75.9375],
          [22.6974, 75.9386],
        ],
      },
      {
        id: 'pipe_7',
        label: 'Commercial Strip P-07',
        houseId: 'house_7',
        points: [
          [22.6978, 75.9288], [22.6982, 75.9283], [22.6987, 75.9278],
          [22.6991, 75.9271], [22.6995, 75.9264], [22.7001, 75.9259],
          [22.7006, 75.9255], [22.7011, 75.9252], [22.7015, 75.9250],
        ],
      },
      {
        id: 'pipe_8',
        label: 'Transit Junction P-08',
        houseId: 'house_8',
        points: [
          [22.6978, 75.9288], [22.6974, 75.9284], [22.6968, 75.9281],
          [22.6961, 75.9276], [22.6954, 75.9270], [22.6946, 75.9265],
          [22.6938, 75.9261], [22.6931, 75.9256], [22.6925, 75.9253],
          [22.6920, 75.9250],
        ],
      },
      // Decorative complex arterial main lines that don't connect to a specific tracked house 
      // but make the city grid look dense!
      {
        id: 'pipe_main_1',
        label: 'City Central Artery',
        houseId: undefined,
        points: [
          [22.6978, 75.9288], [22.6972, 75.9295], [22.6965, 75.9302],
          [22.6960, 75.9308], [22.6956, 75.9315], [22.6952, 75.9305],
          [22.6945, 75.9310], [22.6939, 75.9318], [22.6934, 75.9325],
        ],
      },
      {
        id: 'pipe_main_2',
        label: 'Eastward Bypass Loop',
        houseId: undefined,
        points: [
          [22.6989, 75.9346], [22.6995, 75.9352], [22.7002, 75.9357],
          [22.7008, 75.9364], [22.7015, 75.9369], [22.7022, 75.9375],
          [22.7028, 75.9382], [22.7032, 75.9390]
        ],
      },
      {
        id: 'pipe_main_3',
        label: 'Southern Distribution Manifold',
        houseId: undefined,
        points: [
          [22.6965, 75.9280], [22.6960, 75.9271], [22.6954, 75.9262],
          [22.6958, 75.9255], [22.6963, 75.9248], [22.6968, 75.9244],
          [22.6975, 75.9241]
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
