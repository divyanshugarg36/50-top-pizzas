'use client';

import { useEffect, useRef, useState } from 'react';
import type L from 'leaflet';
import { SpinnerIcon, LocationIcon } from '../icons';

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

interface BookmarkedLocation {
  pizzeriaName: string;
  city: string;
  locationIndex: number;
  address: string | null;
  lat: number;
  lng: number;
  url: string;
  bookmarkedAt: string;
}

interface MapProps {
  cityData?: Record<string, { pizzerias: Pizzeria[] }>;
  selectedCity?: string;
  selectedLocation?: string | null;
  autoTriggerLocation?: boolean;
  maxDistance?: number;
  bookmarks?: BookmarkedLocation[];
  mapStyle?: 'default' | 'light' | 'dark' | 'satellite';
  onNearestPizzeriasUpdate?: (pizzerias: Array<{
    name: string;
    city: string;
    distance: number;
    location: Location;
    url: string;
    markerKey: string;
  }>) => void;
}

export const FullMap=({ cityData, selectedCity, selectedLocation, autoTriggerLocation, maxDistance = 30, bookmarks = [], mapStyle = 'default', onNearestPizzeriasUpdate }: MapProps) =>{
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const pizzaIconRef = useRef<L.DivIcon | null>(null);
  const bookmarkedIconRef = useRef<L.DivIcon | null>(null);
  const userLocationMarkerRef = useRef<L.Marker | null>(null);
  const LeafletRef = useRef<typeof L | null>(null);

  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLeafletReady, setIsLeafletReady] = useState(false);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return; // Already initialized

    // Dynamically import Leaflet only on client side
    import('leaflet').then((LeafletModule) => {
      const L = LeafletModule.default || LeafletModule;
      LeafletRef.current = L;

      // Double check map hasn't been initialized in the meantime
      if (mapRef.current) return;

      // Dynamically load CSS
      if (typeof document !== 'undefined' && !document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        link.crossOrigin = '';
        document.head.appendChild(link);
      }

      // Create custom icons
      pizzaIconRef.current = L.divIcon({
        className: 'custom-pizza-marker',
        html: '<div style="background: #dc2626; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      // Create bookmarked icon (gold/yellow)
      bookmarkedIconRef.current = L.divIcon({
        className: 'custom-bookmarked-marker',
        html: '<div style="background: #eab308; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(234, 179, 8, 0.6);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      // Initialize map
      mapRef.current = L.map(mapContainerRef.current!).setView([41.9, 12.5], 6);

      // Add initial tile layer (Default OpenStreetMap)
      tileLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapRef.current);

      // Mark Leaflet as ready
      setIsLeafletReady(true);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Helper function to check if a location is bookmarked
  const isLocationBookmarked = (pizzeriaName: string, cityName: string, locationIndex: number): boolean => {
    return bookmarks.some(
      b => b.pizzeriaName === pizzeriaName && b.city === cityName && b.locationIndex === locationIndex
    );
  };

  // Update markers when cityData or selectedCity changes
  useEffect(() => {
    if (!isLeafletReady || !mapRef.current || !pizzaIconRef.current || !bookmarkedIconRef.current) return;
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
          if (!LeafletRef.current) return;

          // Check if this location is bookmarked and use appropriate icon
          const isBookmarked = isLocationBookmarked(pizzeria.name, cityName, idx);
          const icon = isBookmarked ? bookmarkedIconRef.current! : pizzaIconRef.current!;

          const marker = LeafletRef.current.marker([location.lat, location.lng], { icon });

          // Create popup content with bookmark button
          const newMarkerKey = `${cityName}-${pizzeria.name}-${idx}`;
          const bookmarkButtonId = `bookmark-${newMarkerKey}`;

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
              <div style="margin-top: 10px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
                <a href="https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: none; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                  <svg style="width: 14px; height: 14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Navigate
                </a>
                <a href="${pizzeria.url}" target="_blank" rel="noopener noreferrer" style="color: #dc2626; text-decoration: none; font-size: 13px; font-weight: 600;">
                  More info →
                </a>
                <button
                  id="${bookmarkButtonId}"
                  style="background: none; border: none; cursor: pointer; color: ${isBookmarked ? '#eab308' : '#9ca3af'}; display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; padding: 0; transition: color 0.2s;"
                  title="${isBookmarked ? 'Remove bookmark' : 'Add bookmark'}"
                >
                  <svg style="width: 16px; height: 16px;" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  ${isBookmarked ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          `;

          marker.bindPopup(popupContent);

          // Add click handler for bookmark button after popup opens
          marker.on('popupopen', () => {
            const bookmarkBtn = document.getElementById(bookmarkButtonId);
            if (bookmarkBtn) {
              bookmarkBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Dispatch custom event to parent
                window.dispatchEvent(new CustomEvent('toggleBookmark', {
                  detail: {
                    pizzeriaName: pizzeria.name,
                    city: cityName,
                    locationIndex: idx,
                    address: location.address,
                    lat: location.lat,
                    lng: location.lng,
                    url: pizzeria.url
                  }
                }));
              };
            }
          });

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
  }, [isLeafletReady, cityData, selectedCity]);

  // Update marker icons when bookmarks change (without recreating all markers)
  useEffect(() => {
    if (!isLeafletReady || !pizzaIconRef.current || !bookmarkedIconRef.current) return;
    if (markersMapRef.current.size === 0) return;

    // Update each marker's icon based on bookmark status
    markersMapRef.current.forEach((marker, markerKey) => {
      const parts = markerKey.split('-');
      const idx = parseInt(parts[parts.length - 1]);
      const pizzeriaName = parts.slice(1, -1).join('-');
      const cityName = parts[0];
      const isBookmarked = isLocationBookmarked(pizzeriaName, cityName, idx);
      const icon = isBookmarked ? bookmarkedIconRef.current! : pizzaIconRef.current!;
      marker.setIcon(icon);
    });
  }, [bookmarks, isLeafletReady]);

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
          if (!LeafletRef.current) return;

          const userIcon = LeafletRef.current.divIcon({
            className: 'user-location-marker',
            html: '<div style="background: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.6);"></div>',
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });

          // Add user location marker
          userLocationMarkerRef.current = LeafletRef.current.marker([latitude, longitude], { icon: userIcon })
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

  // Update map style when prop changes
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current || !LeafletRef.current || !isLeafletReady) return;

    // Remove current tile layer
    tileLayerRef.current.remove();

    // Add new tile layer based on style
    let tileUrl = '';
    let attribution = '';

    switch (mapStyle) {
      case 'default':
        tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        attribution = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
        break;
      case 'light':
        tileUrl = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        attribution = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>';
        break;
      case 'dark':
        tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        attribution = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>';
        break;
      case 'satellite':
        tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        attribution = '© Esri, Maxar, Earthstar Geographics, and the GIS User Community';
        break;
    }

    const tileOptions: any = {
      attribution,
      maxZoom: 19,
      updateWhenIdle: false,
      updateWhenZooming: false,
      keepBuffer: 2,
    };

    // Only add subdomains if not satellite
    if (mapStyle !== 'satellite') {
      tileOptions.subdomains = ['a', 'b', 'c'];
    }

    tileLayerRef.current = LeafletRef.current.tileLayer(tileUrl, tileOptions).addTo(mapRef.current);

    // Force map to invalidate size and redraw
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize(true);
        // Trigger a slight pan to force tile reload
        const center = mapRef.current.getCenter();
        mapRef.current.panTo(center, { animate: false });
      }
    }, 50);
  }, [mapStyle, isLeafletReady]);

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
          if (!LeafletRef.current) return;

          const userIcon = LeafletRef.current.divIcon({
            className: 'user-location-marker',
            html: '<div style="background: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.6);"></div>',
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });

          // Add user location marker
          userLocationMarkerRef.current = LeafletRef.current.marker([latitude, longitude], { icon: userIcon })
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
        className="absolute top-4 right-4 md:top-auto md:bottom-6 md:right-6 bg-white hover:bg-gray-50 text-gray-700 p-4 rounded-full shadow-lg border border-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed z-[1000]"
        title={locating ? "Locating..." : "Show my location"}
      >
        {locating ? (
          <SpinnerIcon className="h-6 w-6 text-blue-600" />
        ) : (
          <LocationIcon className="h-6 w-6 text-blue-600" />
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
