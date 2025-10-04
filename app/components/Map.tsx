'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Location {
  address: string | null;
  lat: number;
  lng: number;
}

interface Pizzeria {
  name: string;
  url: string;
  locations: Location[];
}

interface MapProps {
  cityData?: Record<string, { pizzerias: Pizzeria[] }>;
  selectedCity?: string;
  selectedLocation?: string | null;
  onPizzeriaSelect?: (pizzeria: Pizzeria, city: string) => void;
}

const EMPTY_CITY_DATA = {};

function Map({ cityData, selectedCity, selectedLocation, onPizzeriaSelect }: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create custom icon
    const pizzaIcon = L.divIcon({
      className: 'custom-pizza-marker',
      html: '<div style="background: #dc2626; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    // Initialize map
    mapRef.current = L.map(mapContainerRef.current).setView([41.9, 12.5], 6);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(mapRef.current);

    // Store icon for later use
    (mapRef.current as any).pizzaIcon = pizzaIcon;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when data changes
  useEffect(() => {
    if (!mapRef.current) return;

    const dataToUse = cityData || EMPTY_CITY_DATA;
    if (Object.keys(dataToUse).length === 0) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    markersMapRef.current.clear();

    const bounds: L.LatLngBoundsLiteral = [];
    const pizzaIcon = (mapRef.current as any).pizzaIcon;

    // Determine which cities to display
    const citiesToDisplay = selectedCity && dataToUse[selectedCity]
      ? { [selectedCity]: dataToUse[selectedCity] }
      : dataToUse;

    // Add markers
    Object.entries(citiesToDisplay).forEach(([cityName, cityInfo]) => {
      cityInfo.pizzerias.forEach(pizzeria => {
        pizzeria.locations.forEach((location, idx) => {
          if (location.lat && location.lng) {
            const marker = L.marker([location.lat, location.lng], { icon: pizzaIcon });

            // Create popup content
            const popupContent = `
              <div style="padding: 10px; min-width: 200px;">
                <h3 style="margin: 0 0 10px 0; color: #dc2626; font-size: 16px; font-weight: bold;">
                  ${pizzeria.name}
                </h3>
                <p style="margin: 5px 0; font-size: 13px; color: #555;">
                  🏙️ ${cityName}
                </p>
                ${location.address ? `<p style="margin: 5px 0; font-size: 13px; color: #555;">📍 ${location.address}</p>` : ''}
                ${pizzeria.locations.length > 1
                  ? `<p style="margin: 8px 0; font-size: 12px; background: #f5f5f5; padding: 5px 8px; border-radius: 4px;">
                      Location ${idx + 1} of ${pizzeria.locations.length}
                    </p>`
                  : ''}
                <p style="margin-top: 10px;">
                  <a href="${pizzeria.url}" target="_blank" rel="noopener noreferrer" style="color: #dc2626; text-decoration: none; font-size: 13px;">
                    More info →
                  </a>
                </p>
              </div>
            `;

            marker.bindPopup(popupContent);
            marker.addTo(mapRef.current!);

            // Store marker with key
            const markerKey = `${cityName}-${pizzeria.name}-${idx}`;
            markersRef.current.push(marker);
            markersMapRef.current.set(markerKey, marker);

            bounds.push([location.lat, location.lng]);
          }
        });
      });
    });

    // Fit bounds if we have markers
    if (bounds.length > 0 && mapRef.current) {
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });

      // For single city, limit max zoom
      if (selectedCity) {
        setTimeout(() => {
          if (mapRef.current && mapRef.current.getZoom() > 13) {
            mapRef.current.setZoom(13);
          }
        }, 100);
      }
    }
  }, [cityData, selectedCity]);

  // Handle selected location change
  useEffect(() => {
    if (!mapRef.current || !selectedLocation) return;

    const marker = markersMapRef.current.get(selectedLocation);
    if (marker) {
      // Get the marker's position
      const latlng = marker.getLatLng();

      // Zoom to the marker
      mapRef.current.setView(latlng, 15, {
        animate: true,
        duration: 0.5
      });

      // Open the popup
      marker.openPopup();
    }
  }, [selectedLocation]);

  return (
    <div
      ref={mapContainerRef}
      className="flex-1 h-full"
      style={{ minHeight: '400px' }}
    />
  );
}

export default Map;
