// Renders the Leaflet map and approximate search-area overlay for the current location.

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl,
  shadowUrl
});

export default function MapPanel({ context }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!context?.location || !mapRef.current) {
      return undefined;
    }

    const latitude = Number(context.location.latitude);
    const longitude = Number(context.location.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return undefined;
    }

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapRef.current, {
      center: [latitude, longitude],
      zoom: 10,
      scrollWheelZoom: false
    });

    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    L.marker([latitude, longitude])
      .addTo(map)
      .bindPopup(
        `${context.location.city}, ${context.location.state}${
          context.location.zip ? ` · ZIP ${context.location.zip}` : ''
        }`
      );

    const locationAreaLayer = L.layerGroup();

    L.circle([latitude, longitude], {
      color: '#2b7a57',
      fillColor: '#2b7a57',
      fillOpacity: 0.12,
      weight: 2,
      radius: 40000
    })
      .bindPopup(
        `${context.location.city || 'Location'}, ${context.location.state || ''} · ZIP ${
          context.location.zip || 'unknown'
        }` +
          `\nCounty: ${context.county?.name || 'Unavailable'}`
      )
      .addTo(locationAreaLayer);

    const overlays = {
      'Approximate search area': locationAreaLayer
    };

    L.control.layers(null, overlays, { collapsed: false }).addTo(map);

    const legendControl = L.control({ position: 'bottomright' });

    legendControl.onAdd = function createLegend() {
      const div = L.DomUtil.create('div', 'map-legend');

      div.innerHTML = `
        <div class="legend-header">Map legend</div>
        <div class="scale-row"><span class="scale-swatch" style="background:rgba(43,122,87,0.35);border-color:#2b7a57"></span> Approximate search area</div>
        <div class="scale-row"><span class="scale-swatch" style="background:#800026"></span> High</div>
        <div class="scale-row"><span class="scale-swatch" style="background:#fc4e2a"></span> Moderate</div>
        <div class="scale-row"><span class="scale-swatch" style="background:#feb24c"></span> Low / dry</div>
        <div class="scale-row"><span class="scale-swatch" style="background:#2b7a57"></span> Minimal</div>
        <div class="scale-row"><span class="scale-swatch" style="background:#999999"></span> Unavailable</div>
      `;

      return div;
    };

    legendControl.addTo(map);

    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [context]);

  if (!context?.location) {
    return null;
  }

  const latitude = Number(context.location.latitude);
  const longitude = Number(context.location.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return (
      <section className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <p className="eyebrow">Location Map</p>
          <h2 className="h4 mb-2">Map unavailable</h2>
          <p className="text-secondary mb-0">
            This location did not return valid latitude and longitude
            coordinates.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="card border-0 shadow-sm">
      <div className="card-body p-4">
        <p className="eyebrow">Location Map</p>
        <h2 className="h4 mb-2">Approximate location</h2>

        <p className="text-secondary">
          The map shows the approximate location for the searched ZIP code.
        </p>

        <div ref={mapRef} className="map-frame" />

        <p className="map-note">
          Map layers are approximate and intended for public screening only.
          They should not be treated as parcel boundaries, engineering data, or
          permitting evidence.
        </p>
      </div>
    </section>
  );
}