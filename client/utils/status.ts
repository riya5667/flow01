import { SensorReading, SensorStatus } from './types';

export const getStatusColor = (status: SensorStatus) => {
  switch (status) {
    case 'Normal':
      return '#118ab2';
    case 'Abnormal Flow':
      return '#f2c14e';
    case 'Leak Risk':
    case 'No Flow':
      return '#d84f4f';
    default:
      return '#687279';
  }
};

export const getStatusLabel = (status: SensorStatus) => {
  switch (status) {
    case 'Abnormal Flow':
      return 'High Flow';
    default:
      return status;
  }
};

export const getReadingState = (reading?: SensorReading): SensorStatus => {
  return reading?.status || 'Offline';
};
