import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { NetworkSnapshot, SensorAlert, SensorReading } from '../utils/types';
import { fallbackNetwork } from '../utils/fallbackNetwork';

const getRuntimeBaseUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:3001';
  }

  const protocol = window.location.protocol;
  const hostname = window.location.hostname || 'localhost';
  return `${protocol}//${hostname}:3001`;
};

const getApiBaseUrl = () => {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  return configuredUrl || '/api';
};

const readJson = async <T>(response: Response, label: string): Promise<T> => {
  if (!response.ok) {
    throw new Error(`${label} request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
};

const fetchWithTimeout = (url: string, timeoutMs = 4000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));
};

const mapReadingsByHouse = (latestReadings: SensorReading[]) => {
  const readingMap: Record<string, SensorReading> = {};

  latestReadings.forEach((reading) => {
    if (reading.house_id) {
      readingMap[reading.house_id] = reading;
    }
  });

  return readingMap;
};

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [network, setNetwork] = useState<NetworkSnapshot | null>(null);
  const [readings, setReadings] = useState<Record<string, SensorReading>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<SensorAlert[]>([]);

  useEffect(() => {
    let isMounted = true;
    let telemetryInterval: ReturnType<typeof setInterval> | null = null;
    const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || getRuntimeBaseUrl();
    const apiUrl = getApiBaseUrl();
    const s = io(baseUrl, {
      transports: ['websocket', 'polling'],
    });
    setSocket(s);

    const refreshTelemetry = async () => {
      try {
        const [readingResponse, statsResponse] = await Promise.all([
          fetchWithTimeout(`${apiUrl}/readings/latest`),
          fetchWithTimeout(`${apiUrl}/stats`),
        ]);

        const latestReadings = await readJson<SensorReading[]>(readingResponse, 'Latest readings');
        const statsData = await readJson<any[]>(statsResponse, 'Stats');

        if (!isMounted) {
          return;
        }

        setReadings((previous) => ({
          ...previous,
          ...mapReadingsByHouse(latestReadings),
        }));
        setStats(statsData);
      } catch (error) {
        console.error('useSocket: Failed to refresh telemetry', error);
      }
    };

    const bootstrap = async () => {
      try {
        const [networkResponse, readingResponse, statsResponse] = await Promise.all([
          fetchWithTimeout(`${apiUrl}/network`),
          fetchWithTimeout(`${apiUrl}/readings/latest`),
          fetchWithTimeout(`${apiUrl}/stats`),
        ]);

        const networkData = await readJson<NetworkSnapshot>(networkResponse, 'Network');
        const latestReadings = await readJson<SensorReading[]>(readingResponse, 'Latest readings');
        const statsData = await readJson<any[]>(statsResponse, 'Stats');

        if (!isMounted) {
          return;
        }

        setNetwork(networkData);
        setReadings(mapReadingsByHouse(latestReadings));
        setStats(statsData);
      } catch (error) {
        console.error('useSocket: Failed to fetch bootstrap data', error);
        setNetwork(fallbackNetwork);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    bootstrap();
    telemetryInterval = setInterval(refreshTelemetry, 5000);

    s.on('connect', () => {
      setIsConnected(true);
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    s.on('initialReadings', (data: SensorReading[]) => {
      setReadings((previous) => ({
        ...previous,
        ...mapReadingsByHouse(data),
      }));
    });

    s.on('initialAlerts', (data: SensorAlert[]) => {
      setAlerts(data || []);
    });

    s.on('sensorUpdate', (data: SensorReading) => {
      setReadings((previous) => ({
        ...previous,
        [data.house_id]: data,
      }));
    });

    s.on('alertUpdate', (data: SensorAlert) => {
      setAlerts((previous) => [data, ...previous].slice(0, 30));
    });

    s.on('statsUpdate', (data: any[]) => {
      setStats(data);
    });

    return () => {
      isMounted = false;
      if (telemetryInterval) {
        clearInterval(telemetryInterval);
      }
      s.disconnect();
    };
  }, []);

  return {
    socket,
    network,
    readings,
    isConnected,
    isLoading,
    stats,
    alerts,
  };
};
