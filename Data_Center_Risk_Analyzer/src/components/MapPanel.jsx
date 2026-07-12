import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

function droughtColor(dsci) {
  if (dsci === null || dsci === undefined) return '#999999';
  if (dsci >= 300) return '#800026';
  if (dsci >= 150) return '#fc4e2a';
  if (dsci > 0) return '#feb24c';
  return '#ffffb2';
}

export default function MapPanel({ context, mapUrl }) {
  const mapRef = useRef(null);

  useEffect(() => {
    if (!context?.location) return;

    const { latitude, longitude } = context.location;

    // Fix default icon paths for many bundlers
    L.Icon.Default.mergeOptions({
      iconUrl,
      iconRetinaUrl,
      shadowUrl
    });

    const map = L.map(mapRef.current, {
      center: [Number(latitude), Number(longitude)],
      zoom: 10,
      scrollWheelZoom: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const baseMarker = L.marker([Number(latitude), Number(longitude)]).bindPopup(
      `${context.location.city}, ${context.location.state} · ZIP ${context.location.zip}`
    );

    // Drought overlay
    const dsci = context.drought?.dsci ?? null;
    const droughtLayer = L.layerGroup();
    const droughtCircle = L.circle([Number(latitude), Number(longitude)], {
      color: droughtColor(dsci),
      fillColor: droughtColor(dsci),
      fillOpacity: 0.35,
      radius: 20000
    }).bindPopup(`Drought: ${context.drought?.label || 'Unavailable'}`);
    droughtLayer.addLayer(droughtCircle);

    // Administrative boundary overlay (placeholder)
    const adminLayer = L.layerGroup();
    const adminBoundary = L.circle([Number(latitude), Number(longitude)], {
      color: '#2b7a57',
      weight: 2,
      fill: false,
      radius: 40000
    }).bindPopup(`County: ${context.county?.name || 'Unavailable'}`);
    adminLayer.addLayer(adminBoundary);

    // Water sources overlay (placeholder)
    const waterLayer = L.layerGroup();
    const offsets = [
      [0.06, 0.06],
      [-0.05, 0.05],
      [0.04, -0.05]
    ];
    offsets.forEach((o, i) => {
      const m = L.circleMarker([Number(latitude) + o[0], Number(longitude) + o[1]], {
        radius: 6,
        color: '#2171b5',
        fillColor: '#6baed6',
        fillOpacity: 0.9
      }).bindPopup(`Water source ${i + 1}`);
      waterLayer.addLayer(m);
    });

    baseMarker.addTo(map);

    const overlays = {
      'Drought severity': droughtLayer,
      'Administrative boundary': adminLayer,
      'Water sources': waterLayer
    };

    L.control.layers(null, overlays, { collapsed: true }).addTo(map);

    // Legend control
    const legendControl = L.control({ position: 'topright' });
    legendControl.onAdd = function () {
      const div = L.DomUtil.create('div', 'map-legend');
      div.innerHTML = `
        <div class="legend-header">Map overlays</div>
        <div class="legend-body">
          <label><input type="checkbox" data-layer="Drought severity" /> Drought severity</label><br/>
          <label><input type="checkbox" data-layer="Administrative boundary" /> Administrative boundary</label><br/>
          <label><input type="checkbox" data-layer="Water sources" /> Water sources</label>
          <hr/>
          <div class="legend-scale"><strong>Drought scale</strong>
            <div class="scale-row"><span class="scale-swatch" style="background:#800026"></span> High</div>
            <div class="scale-row"><span class="scale-swatch" style="background:#fc4e2a"></span> Moderate</div>
            <div class="scale-row"><span class="scale-swatch" style="background:#feb24c"></span> Low</div>
            <div class="scale-row"><span class="scale-swatch" style="background:#ffffb2"></span> Minimal</div>
          </div>
        </div>
      `;
      L.DomEvent.disableClickPropagation(div);
      return div;
    };
    legendControl.addTo(map);

    // Wire checkboxes
    setTimeout(() => {
      const legendEl = document.querySelector('.map-legend');
      if (legendEl) {
        legendEl.querySelectorAll('input[data-layer]').forEach((input) => {
          const layerName = input.getAttribute('data-layer');
          input.addEventListener('change', (e) => {
            const checked = e.target.checked;
            if (checked) overlays[layerName].addTo(map);
            else overlays[layerName].remove();
          });
        });
      }
    }, 100);

    return () => {
      map.remove();
    };
  }, [context]);

  if (!context?.location) {
    return (
      <p className="text-secondary mb-0">
        Look up a ZIP code to show the approximate location, Census
        population context, drought context, and NOAA/NWS weather
        summary.
      </p>
    );
  }

  return <div ref={mapRef} className="map-frame" />;
}
