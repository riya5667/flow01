'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  GoogleMap,
  InfoWindowF,
  MarkerF,
  OverlayViewF,
  PolylineF,
  useJsApiLoader,
} from '@react-google-maps/api';
import { AssetSelection, Pipeline, SensorReading, WaterZone } from '../utils/types';
import { formatFlow, formatPressure, formatTime } from '../utils/format';
import { getReadingState, getStatusColor, getStatusLabel } from '../utils/status';

const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyA5Nl4L4FLicH5i8sdpyJHyMIbDpDs45_I';
const OVERLAY_MOUSE_TARGET = 'overlayMouseTarget';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  fullscreenControl: false,
  streetViewControl: false,
  clickableIcons: false,
  mapTypeId: 'roadmap',
  gestureHandling: 'greedy',
};

interface MapProps {
  zone: WaterZone;
  readings: Record<string, SensorReading>;
  selectedAsset: AssetSelection | null;
  onSelectAsset: (selection: AssetSelection | null) => void;
}

type TooltipState = {
  text: string;
  position: google.maps.LatLngLiteral;
} | null;

const distance = ([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]) =>
  Math.sqrt((lat2 - lat1) ** 2 + (lng2 - lng1) ** 2);

const interpolatePoint = (points: [number, number][], progress: number): [number, number] => {
  if (points.length === 1) {
    return points[0];
  }

  const lengths = points.slice(1).map((point, index) => distance(points[index], point));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const target = total * progress;
  let traversed = 0;

  for (let index = 0; index < lengths.length; index += 1) {
    const segmentLength = lengths[index];
    if (traversed + segmentLength >= target) {
      const ratio = segmentLength === 0 ? 0 : (target - traversed) / segmentLength;
      const [startLat, startLng] = points[index];
      const [endLat, endLng] = points[index + 1];
      return [startLat + (endLat - startLat) * ratio, startLng + (endLng - startLng) * ratio];
    }

    traversed += segmentLength;
  }

  return points[points.length - 1];
};

const pipelineMidpoint = (pipeline: Pipeline) => interpolatePoint(pipeline.points, 0.5);

const toLatLng = ([lat, lng]: [number, number]): google.maps.LatLngLiteral => ({ lat, lng });

const makeHouseIcon = (color: string, selected: boolean) => ({
  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
      <rect x="6" y="6" width="18" height="18" rx="4" fill="${selected ? '#f1f5f9' : '#ffffff'}" stroke="#cbd5e1" stroke-width="2" transform="rotate(45 15 15)"/>
      <circle cx="15" cy="15" r="4" fill="${color}" />
    </svg>
  `)}`,
  scaledSize: new google.maps.Size(30, 30),
  anchor: new google.maps.Point(15, 15),
});

const makeTankIcon = (selected: boolean) => ({
  path: google.maps.SymbolPath.CIRCLE,
  fillColor: '#118ab2',
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 3,
  scale: selected ? 12 : 10,
});

const getInfoWindowState = (
  zone: WaterZone,
  selectedAsset: AssetSelection | null,
  readings: Record<string, SensorReading>,
) => {
  if (!selectedAsset) {
    return null;
  }

  if (selectedAsset.type === 'tank') {
    return {
      position: toLatLng(zone.tank.position),
      title: zone.tank.label,
      subtitle: zone.name,
      reading: null,
      meta: [
        { label: 'Capacity', value: `${zone.tank.capacityLpm} L/min` },
        { label: 'Endpoints', value: String(zone.houses.length) },
      ],
    };
  }

  if (selectedAsset.type === 'house') {
    const house = zone.houses.find((item) => item.id === selectedAsset.id);
    if (!house) {
      return null;
    }

    const reading = readings[house.id];
    return {
      position: toLatLng(house.position),
      title: house.name,
      subtitle: house.label,
      reading,
      meta: [],
    };
  }

  const pipeline = zone.pipelines.find((item) => item.id === selectedAsset.id);
  if (!pipeline) {
    return null;
  }

  const house = zone.houses.find((item) => item.id === pipeline.houseId);
  const reading = readings[pipeline.houseId];

  return {
    position: toLatLng(pipelineMidpoint(pipeline)),
    title: pipeline.label,
    subtitle: house?.name || 'Distribution line',
    reading,
    meta: [],
  };
};

const WaterMap = ({ zone, readings, selectedAsset, onSelectAsset }: MapProps) => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'flow-intel-google-map',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });
  const [phase, setPhase] = useState(0);
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setPhase((value) => (value + 0.02) % 1);
    }, 90);

    return () => window.clearInterval(intervalId);
  }, []);

  const houseMap = useMemo(
    () => new globalThis.Map(zone.houses.map((house) => [house.id, house])),
    [zone.houses],
  );

  const infoState = useMemo(
    () => getInfoWindowState(zone, selectedAsset, readings),
    [zone, selectedAsset, readings],
  );

  const initialCenter = useMemo(() => toLatLng(zone.center), [zone.center[0], zone.center[1]]);

  if (loadError) {
    return <div className="map-loading">Google Maps failed to load. Check the API key and referrer settings.</div>;
  }

  if (!isLoaded) {
    return <div className="map-loading">Loading Google map...</div>;
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={initialCenter}
      zoom={17}
      options={mapOptions}
      onClick={() => setTooltip(null)}
    >
      <MarkerF
        position={toLatLng(zone.tank.position)}
        icon={makeTankIcon(selectedAsset?.type === 'tank')}
        onClick={() => onSelectAsset({ type: 'tank', id: zone.tank.id })}
      />

      <OverlayViewF
        position={toLatLng(zone.tank.position)}
        mapPaneName={OVERLAY_MOUSE_TARGET}
      >
        <div className="tank-marker">
          <span className={`tank-marker-core ${selectedAsset?.type === 'tank' ? 'tank-marker-core-active' : ''}`} />
          <span className="tank-marker-label">Water Tank / Source</span>
        </div>
      </OverlayViewF>

      {zone.pipelines.map((pipeline) => {
        const house = houseMap.get(pipeline.houseId);
        const reading = readings[pipeline.houseId];
        const state = getReadingState(reading);
        const color = getStatusColor(state);
        const isSelected = selectedAsset?.type === 'pipeline' && selectedAsset.id === pipeline.id;
        const isFlowing = (reading?.flow_rate || 0) > 0.35 && state !== 'Offline';
        const animatedDots = isFlowing
          ? [0.18, 0.48, 0.78].map((offset) => interpolatePoint(pipeline.points, (phase + offset) % 1))
          : [];

        return (
          <div key={pipeline.id}>
            <PolylineF
              path={pipeline.points.map(toLatLng)}
              options={{
                strokeColor: '#cbd5e1',
                strokeOpacity: 0.9,
                strokeWeight: isSelected ? 10 : 8,
                clickable: false,
                zIndex: isSelected ? 2 : 1,
              }}
            />
            {isSelected && (
              <PolylineF
                path={pipeline.points.map(toLatLng)}
                options={{
                  strokeColor: color,
                  strokeOpacity: 0.45,
                  strokeWeight: 14,
                  clickable: false,
                  zIndex: 2,
                }}
              />
            )}
            <PolylineF
              path={pipeline.points.map(toLatLng)}
              options={{
                strokeColor: color,
                strokeOpacity: 0.95,
                strokeWeight: isSelected ? 5 : 4,
                clickable: true,
                zIndex: isSelected ? 4 : 3,
              }}
              onClick={() => onSelectAsset({ type: 'pipeline', id: pipeline.id })}
              onMouseOver={() =>
                setTooltip({
                  text: `${pipeline.label} | ${getStatusLabel(state)}`,
                  position: toLatLng(pipelineMidpoint(pipeline)),
                })
              }
              onMouseOut={() => setTooltip((current) => (current?.text.startsWith(pipeline.label) ? null : current))}
            />

            {animatedDots.map((dot, index) => (
              <MarkerF
                key={`${pipeline.id}-${index}`}
                position={toLatLng(dot)}
                clickable={false}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  fillColor: '#8fd8ea',
                  fillOpacity: 0.95,
                  strokeColor: '#d8f1fb',
                  strokeWeight: 1,
                  scale: 4,
                }}
              />
            ))}

            {house && (
              <MarkerF
                position={toLatLng(house.position)}
                icon={makeHouseIcon(color, selectedAsset?.type === 'house' && selectedAsset.id === house.id)}
                onClick={() => onSelectAsset({ type: 'house', id: house.id })}
                onMouseOver={() =>
                  setTooltip({
                    text: house.name,
                    position: toLatLng(house.position),
                  })
                }
                onMouseOut={() => setTooltip((current) => (current?.text === house.name ? null : current))}
              />
            )}
          </div>
        );
      })}

      {tooltip && (
        <OverlayViewF position={tooltip.position} mapPaneName={OVERLAY_MOUSE_TARGET}>
          <div className="map-tooltip">{tooltip.text}</div>
        </OverlayViewF>
      )}

      {infoState && (
        <InfoWindowF position={infoState.position} onCloseClick={() => onSelectAsset(null)}>
          <div className="map-popup">
            <div className="map-popup-title">{infoState.title}</div>
            <div className="map-popup-subtitle">{infoState.subtitle}</div>
            <div className="map-popup-grid">
              {infoState.reading ? (
                <>
                  <div>
                    <span>Flow rate</span>
                    <strong>{formatFlow(infoState.reading.flow_rate)}</strong>
                  </div>
                  <div>
                    <span>Pressure</span>
                    <strong>{formatPressure(infoState.reading.pressure)}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{getStatusLabel(infoState.reading.status)}</strong>
                  </div>
                  <div>
                    <span>Last updated</span>
                    <strong>{formatTime(infoState.reading.timestamp)}</strong>
                  </div>
                </>
              ) : (
                infoState.meta.map((item) => (
                  <div key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </InfoWindowF>
      )}
    </GoogleMap>
  );
};

export default WaterMap;
