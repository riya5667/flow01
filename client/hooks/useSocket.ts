import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { NetworkSnapshot, SensorReading } from '../utils/types';
import { fallbackNetwork } from '../utils/fallbackNetwork';

const getRuntimeBaseUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:3001';
  }

  const protocol = window.location.protocol;
  const hostname = window.location.hostname || 'localhost';
  return `${protocol}//${hostname}:3001`;
};

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [network, setNetwork] = useState<NetworkSnapshot | null>(null);
  const [readings, setReadings] = useState<Record<string, SensorReading>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || getRuntimeBaseUrl();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${baseUrl}/api`;
    const s = io(baseUrl, {
      transports: ['websocket', 'polling'],
    });
    setSocket(s);

    const bootstrap = async () => {
      try {
        const [networkResponse, readingResponse] = await Promise.all([
          fetch(`${apiUrl}/network`),
          fetch(`${apiUrl}/readings/latest`),
        ]);

        const networkData: NetworkSnapshot = await networkResponse.json();
        const latestReadings: SensorReading[] = await readingResponse.json();

        if (!isMounted) {
          return;
        }

        const readingMap: Record<string, SensorReading> = {};
        latestReadings.forEach((reading) => {
          readingMap[reading.house_id] = reading;
        });

        setNetwork(networkData);
        setReadings(readingMap);
      } catch (error) {
        console.error('Failed to fetch bootstrap data', error);
        setNetwork(fallbackNetwork);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    bootstrap();

    s.on('connect', () => {
      setIsConnected(true);
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    s.on('initialReadings', (data: SensorReading[]) => {
      const readingMap: Record<string, SensorReading> = {};
      data.forEach((reading) => {
        readingMap[reading.house_id] = reading;
      });
      setReadings((previous) => ({
        ...previous,
        ...readingMap,
      }));
    });

    s.on('sensorUpdate', (data: SensorReading) => {
      setReadings((previous) => ({
        ...previous,
        [data.house_id]: data,
      }));
    });

    return () => {
      isMounted = false;
      s.disconnect();
    };
  }, []);

  return {
    socket,
    network,
    readings,
    isConnected,
    isLoading,
  };
};
