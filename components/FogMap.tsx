
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Polyline, useMap } from 'react-leaflet';
import { Coordinate } from '../types';
import L from 'leaflet';

// Fix Leaflet default icon issue
try {
  if ((L.Icon.Default.prototype as any)._getIconUrl) {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
  }
  
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
} catch (e) {
  console.warn("Leaflet icon fix warning:", e);
}

interface FogMapProps {
  userLocation: Coordinate;
  visitedPath: Coordinate[];
  targetLocation?: Coordinate;
  targetRadius?: number;
  isPanicMode: boolean;
}

// Custom User Icon with pulsing effect
const createUserIcon = (isPanic: boolean) => {
  const colorClass = isPanic ? 'bg-red-500' : 'bg-cyan-400';
  const glowClass = isPanic ? 'bg-red-500' : 'bg-cyan-500';
  const shadowClass = isPanic ? 'shadow-[0_0_20px_rgba(239,68,68,0.8)]' : 'shadow-[0_0_20px_rgba(34,211,238,0.8)]';

  return L.divIcon({
    className: 'bg-transparent',
    html: `
      <div class="relative flex items-center justify-center w-[40px] h-[40px]">
        <div class="absolute inset-0 ${glowClass} rounded-full animate-ping opacity-75"></div>
        <div class="relative w-4 h-4 ${colorClass} border-2 border-white rounded-full ${shadowClass} z-10"></div>
        <!-- Radar Ring Effect -->
        <div class="absolute inset-[-10px] border border-${isPanic ? 'red' : 'cyan'}-500/30 rounded-full animate-pulse"></div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

const MapRecenter = ({ location }: { location: Coordinate }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo([location.lat, location.lng], 18, { animate: true, duration: 1.5 });
  }, [location, map]);
  return null;
};

const FogMap: React.FC<FogMapProps> = ({ userLocation, visitedPath, targetLocation, targetRadius, isPanicMode }) => {
  
  const pathData = visitedPath.map(p => [p.lat, p.lng] as [number, number]);
  const guideLineData = targetLocation ? [
    [userLocation.lat, userLocation.lng] as [number, number],
    [targetLocation.lat, targetLocation.lng] as [number, number]
  ] : [];

  return (
    <div className="absolute inset-0 z-0 bg-slate-900">
      <MapContainer 
        center={[userLocation.lat, userLocation.lng]} 
        zoom={18} 
        scrollWheelZoom={false} 
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        <MapRecenter location={userLocation} />

        {/* Visited Path Trace - CRITICAL FIX: Only render if more than 1 point to prevent Leaflet crash */}
        {pathData.length > 1 && (
          <Polyline 
            positions={pathData} 
            pathOptions={{ color: isPanicMode ? '#991b1b' : '#059669', weight: 6, opacity: 0.4, lineCap: 'round' }} 
          />
        )}

        {/* Guide Line to Target (Dashed) */}
        {targetLocation && (
           <Polyline 
             positions={guideLineData}
             pathOptions={{ color: '#06b6d4', weight: 2, dashArray: '4, 8', opacity: 0.3 }}
           />
        )}

        {/* User Marker (Custom Animated Icon) */}
        <Marker 
          position={[userLocation.lat, userLocation.lng]} 
          icon={createUserIcon(isPanicMode)} 
          zIndexOffset={1000}
        />

        {/* Mission Target Area */}
        {targetLocation && targetRadius && (
          <>
            <Circle 
              center={[targetLocation.lat, targetLocation.lng]} 
              radius={targetRadius} 
              pathOptions={{ 
                color: '#f59e0b', 
                fillColor: '#f59e0b', 
                fillOpacity: 0.1, 
                weight: 1, 
                dashArray: '5, 5' 
              }} 
            />
            <Marker position={[targetLocation.lat, targetLocation.lng]} />
          </>
        )}
      </MapContainer>
    </div>
  );
};

export default FogMap;
