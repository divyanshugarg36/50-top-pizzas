'use client';

import { useEffect, useRef, useState } from 'react';
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
  autoTriggerLocation?: boolean;
  maxDistance?: number;
  onNearestPizzeriasUpdate?: (pizzerias: Array<{
    name: string;
    city: string;
    distance: number;
    location: Location;
    url: string;
    markerKey: string;
  }>) => void;
}

export const FullMap=({ cityData, selectedCity, selectedLocation, autoTriggerLocation, maxDistance = 30, onNearestPizzeriasUpdate }: MapProps) =>{
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const pizzaIconRef = useRef<L.DivIcon | null>(null);
  const userLocationMarkerRef = useRef<L.Marker | null>(null);

  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create custom icon
    pizzaIconRef.current = L.divIcon({
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

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when cityData or selectedCity changes
  useEffect(() => {
    if (!mapRef.current || !pizzaIconRef.current) return;
    if (!cityData || Object.keys(cityData).length === 0) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    markersMapRef.current.clear();

    const bounds: L.LatLngBoundsLiteral = [];

    // Determine which cities to display
    const citiesToDisplay = selectedCity && cityData[selectedCity]
      ? { [selectedCity]: cityData[selectedCity] }
      : cityData;

    // Add markers
    Object.entries(citiesToDisplay).forEach(([cityName, cityInfo]) => {
      if (!cityInfo || !cityInfo.pizzerias) return;

      cityInfo.pizzerias.forEach(pizzeria => {
        if (!pizzeria || !pizzeria.locations) return;

        pizzeria.locations.forEach((location, idx) => {
          if (!location || !location.lat || !location.lng) return;

          const marker = L.marker([location.lat, location.lng], { icon: pizzaIconRef.current! });

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
      const latlng = marker.getLatLng();
      mapRef.current.setView(latlng, 15, {
        animate: true,
        duration: 0.5
      });
      marker.openPopup();
    }
  }, [selectedLocation]);

  // Auto-trigger location if permission is already granted
  useEffect(() => {
    if (!autoTriggerLocation || !mapRef.current || !cityData) return;

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;

          // Save user location
          setUserLocation({ lat: latitude, lng: longitude });

          // Remove old user location marker if exists
          if (userLocationMarkerRef.current) {
            userLocationMarkerRef.current.remove();
          }

          // Create blue marker for user location
          const userIcon = L.divIcon({
            className: 'user-location-marker',
            html: '<div style="background: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.6);"></div>',
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });

          // Add user location marker
          userLocationMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon })
            .addTo(mapRef.current!)
            .bindPopup('<div style="padding: 8px;"><strong>📍 Your Location</strong></div>');

          // Center map on user location
          mapRef.current!.setView([latitude, longitude], 13, {
            animate: true,
            duration: 1
          });

          // Find nearest pizzerias
          findNearestPizzerias(latitude, longitude);
        },
        (error) => {
          console.log('Could not auto-fetch location:', error);
        }
      );
    }
  }, [autoTriggerLocation, cityData]);

  // Re-calculate nearest pizzerias when maxDistance changes
  useEffect(() => {
    if (!userLocation || !cityData) return;
    findNearestPizzerias(userLocation.lat, userLocation.lng);
  }, [maxDistance]);

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Find nearest pizzerias
  const findNearestPizzerias = (userLat: number, userLng: number) => {
    if (!cityData) return;

    const pizzeriasWithDistance: Array<{
      name: string;
      city: string;
      distance: number;
      location: Location;
      url: string;
      markerKey: string;
    }> = [];

    Object.entries(cityData).forEach(([cityName, cityInfo]) => {
      if (!cityInfo || !cityInfo.pizzerias) return;

      cityInfo.pizzerias.forEach(pizzeria => {
        if (!pizzeria || !pizzeria.locations) return;

        pizzeria.locations.forEach((location, idx) => {
          if (!location || !location.lat || !location.lng) return;

          const distance = calculateDistance(userLat, userLng, location.lat, location.lng);
          pizzeriasWithDistance.push({
            name: pizzeria.name,
            city: cityName,
            distance,
            location,
            url: pizzeria.url,
            markerKey: `${cityName}-${pizzeria.name}-${idx}`
          });
        });
      });
    });

    // Sort by distance and filter by maxDistance, then take all results
    const nearest = pizzeriasWithDistance
      .filter(p => p.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance);

    // Send to parent component
    if (onNearestPizzeriasUpdate) {
      onNearestPizzeriasUpdate(nearest);
    }
  };

  // Handle show my location
  const handleShowMyLocation = () => {
    if (!mapRef.current) return;

    setLocating(true);
    setLocationError(null);

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;

          // Save user location
          setUserLocation({ lat: latitude, lng: longitude });

          // Remove old user location marker if exists
          if (userLocationMarkerRef.current) {
            userLocationMarkerRef.current.remove();
          }

          // Create blue marker for user location
          const userIcon = L.divIcon({
            className: 'user-location-marker',
            html: '<div style="background: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.6);"></div>',
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });

          // Add user location marker
          userLocationMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon })
            .addTo(mapRef.current!)
            .bindPopup('<div style="padding: 8px;"><strong>📍 Your Location</strong></div>');

          // Center map on user location
          mapRef.current!.setView([latitude, longitude], 13, {
            animate: true,
            duration: 1
          });

          // Find nearest pizzerias
          findNearestPizzerias(latitude, longitude);

          setLocating(false);
        },
        (error) => {
          setLocating(false);
          setLocationError(error.message);
          setTimeout(() => setLocationError(null), 3000);
        }
      );
    } else {
      setLocating(false);
      setLocationError('Geolocation not supported');
      setTimeout(() => setLocationError(null), 3000);
    }
  };

  return (
    <div className="flex-1 h-full relative">
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />

      {/* Show My Location Button */}
      <button
        onClick={handleShowMyLocation}
        disabled={locating}
        className="absolute bottom-6 right-6 bg-white hover:bg-gray-50 text-gray-700 px-4 py-3 rounded-lg shadow-lg border border-gray-200 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed z-[1000]"
        title="Show my location"
      >
        {locating ? (
          <>
            <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm font-medium">Locating...</span>
          </>
        ) : (
          <>
            <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-medium">My Location</span>
          </>
        )}
      </button>

      {/* Error Toast */}
      {locationError && (
        <div className="absolute top-6 right-6 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg z-[1000] max-w-xs">
          <p className="text-sm font-medium">Location Error</p>
          <p className="text-xs mt-1 opacity-90">{locationError}</p>
        </div>
      )}
    </div>
  );
}
