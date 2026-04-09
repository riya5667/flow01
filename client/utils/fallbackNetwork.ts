import { NetworkSnapshot } from './types';

export const fallbackNetwork: NetworkSnapshot = {
  generatedAt: new Date().toISOString(),
  zones: [
    {
      id: 'zone-super-corridor',
      name: 'Super Corridor South Grid',
      areaLabel: 'Indore East Service Area',
      description:
        'Primary residential distribution cluster mapped around the supplied Google Maps area near the eastern corridor.',
      center: [22.6963268, 75.9316839],
      tank: {
        id: 'tank-super-corridor',
        label: 'Water Tank / Source',
        position: [22.6978, 75.9288],
        capacityLpm: 1280,
      },
      houses: [
        {
          id: 'house_1',
          name: 'Scheme 114 Homes',
          label: 'Residential Cluster A1',
          position: [22.6989, 75.9346],
          demandBand: 'Standard',
        },
        {
          id: 'house_2',
          name: 'Tulsi Nagar Block',
          label: 'Residential Cluster B2',
          position: [22.6947, 75.9363],
          demandBand: 'High',
        },
        {
          id: 'house_3',
          name: 'Service Quarters East',
          label: 'Residential Cluster C3',
          position: [22.6935, 75.9304],
          demandBand: 'Standard',
        },
      ],
      pipelines: [
        {
          id: 'pipe_1',
          label: 'Feeder Line P-01',
          houseId: 'house_1',
          points: [
            [22.6978, 75.9288],
            [22.6982, 75.9311],
            [22.6989, 75.9346],
          ],
        },
        {
          id: 'pipe_2',
          label: 'Feeder Line P-02',
          houseId: 'house_2',
          points: [
            [22.6978, 75.9288],
            [22.6965, 75.9327],
            [22.6947, 75.9363],
          ],
        },
        {
          id: 'pipe_3',
          label: 'Feeder Line P-03',
          houseId: 'house_3',
          points: [
            [22.6978, 75.9288],
            [22.6958, 75.9294],
            [22.6935, 75.9304],
          ],
        },
      ],
    },
    {
      id: 'zone-super-corridor-north',
      name: 'Super Corridor North Grid',
      areaLabel: 'Indore East Expansion Area',
      description:
        'Northern extension of the same mapped area with mixed residential and priority public demand nodes.',
      center: [22.7006, 75.9374],
      tank: {
        id: 'tank-super-corridor-north',
        label: 'Water Tank / Source',
        position: [22.6996, 75.9348],
        capacityLpm: 1460,
      },
      houses: [
        {
          id: 'house_4',
          name: 'Ring Road Villas',
          label: 'Residential Cluster D4',
          position: [22.7025, 75.9402],
          demandBand: 'Standard',
        },
        {
          id: 'house_5',
          name: 'Community Health Centre',
          label: 'Priority Supply Node E5',
          position: [22.6992, 75.9416],
          demandBand: 'Critical',
        },
        {
          id: 'house_6',
          name: 'Apartment Cluster North',
          label: 'Residential Cluster F6',
          position: [22.6974, 75.9386],
          demandBand: 'High',
        },
      ],
      pipelines: [
        {
          id: 'pipe_4',
          label: 'Feeder Line V-04',
          houseId: 'house_4',
          points: [
            [22.6996, 75.9348],
            [22.7012, 75.9377],
            [22.7025, 75.9402],
          ],
        },
        {
          id: 'pipe_5',
          label: 'Feeder Line V-05',
          houseId: 'house_5',
          points: [
            [22.6996, 75.9348],
            [22.6995, 75.9378],
            [22.6992, 75.9416],
          ],
        },
        {
          id: 'pipe_6',
          label: 'Feeder Line V-06',
          houseId: 'house_6',
          points: [
            [22.6996, 75.9348],
            [22.6987, 75.9368],
            [22.6974, 75.9386],
          ],
        },
      ],
    },
  ],
};
