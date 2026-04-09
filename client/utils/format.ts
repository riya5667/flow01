export const formatFlow = (value?: number) => `${(value || 0).toFixed(1)} L/min`;

export const formatPressure = (value?: number) => `${(value || 0).toFixed(1)} psi`;

export const formatTime = (value?: string) => {
  if (!value) {
    return 'Awaiting telemetry';
  }

  return new Date(value).toLocaleString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: 'short',
  });
};
