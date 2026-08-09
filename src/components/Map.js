'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';

// Component to dynamically change map center
function ChangeView({ center, zoom }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

export default function Map({ center = [4.8829, -77.0267], zoom = 14, markers = [], className = '' }) {
  // Buenaventura default center [4.8829, -77.0267]
  return (
    <div style={{ width: '100%', height: '100%' }} className={className}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} style={{ width: '100%', height: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        <ChangeView center={center} zoom={zoom} />
        {markers.map((marker, idx) => (
          <Marker key={idx} position={marker.position}>
            {marker.popup && <Popup>{marker.popup}</Popup>}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
