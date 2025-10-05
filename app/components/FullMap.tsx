'use client';

import { useEffect, useRef, useState } from 'react';
import type L from 'leaflet';
import { SpinnerIcon, LocationIcon } from '../icons';

interface Award {
  rank: number | null;
  name: string;
}

interface Location {
  address: string | null;
  lat: number;
  lng: number;
}

interface Pizzeria {
  name: string;
  url: string;
  locations: Location[];
  awards?: Award[];
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
    awards?: Award[];
  }>) => void;
}

export const FullMap=({ cityData, selectedCity, selectedLocation, autoTriggerLocation, maxDistance = 30, bookmarks = [], mapStyle = 'default', onNearestPizzeriasUpdate }: MapProps) =>{
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());
  const clusterMarkersRef = useRef<L.Marker[]>([]);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const pizzaIconRef = useRef<L.DivIcon | null>(null);
  const bookmarkedIconRef = useRef<L.DivIcon | null>(null);
  const userLocationMarkerRef = useRef<L.Marker | null>(null);
  const LeafletRef = useRef<typeof L | null>(null);

  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLeafletReady, setIsLeafletReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(2);
  const [viewportBounds, setViewportBounds] = useState<L.LatLngBounds | null>(null);
  const shouldFitBoundsRef = useRef(true);
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

  // Clustering algorithm
  const clusterMarkers = (markers: Array<{
    lat: number;
    lng: number;
    isBookmarked: boolean;
    data: {
      cityName: string;
      pizzeria: Pizzeria;
      location: Location;
      idx: number;
    };
  }>, zoom: number) => {
    // Distance threshold in pixels (adjusted by zoom level)
    // Lower zoom = larger clusters, more aggressive clustering
    const pixelDistance =
      zoom < 4 ? 150 :  // World view - very large clusters
      zoom < 6 ? 100 :  // Continental view
      zoom < 8 ? 80 :   // Country view
      zoom < 10 ? 60 :  // Regional view
      zoom < 12 ? 40 :  // City view
      zoom < 14 ? 25 :  // District view
      zoom < 16 ? 15 :  // Street view
      0;                // Max zoom - show all

    if (pixelDistance === 0) return markers.map(m => [m]); // No clustering at max zoom

    const clusters: Array<Array<typeof markers[0]>> = [];
    const used = new Set<number>();

    for (let i = 0; i < markers.length; i++) {
      if (used.has(i)) continue;

      const cluster = [markers[i]];
      used.add(i);

      // Always prioritize bookmarked markers
      if (markers[i].isBookmarked) {
        clusters.push(cluster);
        continue;
      }

      // Find nearby markers
      for (let j = i + 1; j < markers.length; j++) {
        if (used.has(j)) continue;
        if (markers[j].isBookmarked) continue; // Don't cluster bookmarked markers

        const distance = Math.sqrt(
          Math.pow(markers[i].lat - markers[j].lat, 2) +
          Math.pow(markers[i].lng - markers[j].lng, 2)
        );

        // Convert lat/lng distance to approximate pixel distance at this zoom
        const approxPixelDistance = distance * Math.pow(2, zoom) * 256 / 360;

        if (approxPixelDistance < pixelDistance) {
          cluster.push(markers[j]);
          used.add(j);
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  };

  // Update markers when cityData or selectedCity changes
  useEffect(() => {
    if (!isLeafletReady || !mapRef.current || !pizzaIconRef.current || !bookmarkedIconRef.current) return;
    if (!cityData || Object.keys(cityData).length === 0) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    markersMapRef.current.clear();
    clusterMarkersRef.current.forEach(marker => marker.remove());
    clusterMarkersRef.current = [];

    const bounds: L.LatLngBoundsLiteral = [];
    const currentZoom = mapRef.current.getZoom();

    // Determine which cities to display
    const citiesToDisplay = selectedCity && cityData[selectedCity]
      ? { [selectedCity]: cityData[selectedCity] }
      : cityData;

    // Collect all markers first
    const allMarkers: Array<{
      lat: number;
      lng: number;
      isBookmarked: boolean;
      data: {
        cityName: string;
        pizzeria: Pizzeria;
        location: Location;
        idx: number;
      };
    }> = [];

    Object.entries(citiesToDisplay).forEach(([cityName, cityInfo]) => {
      if (!cityInfo || !cityInfo.pizzerias) return;

      cityInfo.pizzerias.forEach(pizzeria => {
        if (!pizzeria || !pizzeria.locations) return;

        pizzeria.locations.forEach((location, idx) => {
          if (!location || !location.lat || !location.lng) return;

          // Viewport culling: skip markers outside viewport (with buffer for smooth panning)
          if (viewportBounds) {
            const bounds = viewportBounds.pad(0.5); // 50% buffer around viewport
            if (!bounds.contains([location.lat, location.lng])) {
              return; // Skip this marker
            }
          }

          const isBookmarked = isLocationBookmarked(pizzeria.name, cityName, idx);

          allMarkers.push({
            lat: location.lat,
            lng: location.lng,
            isBookmarked,
            data: { cityName, pizzeria, location, idx }
          });
        });
      });
    });

    // Cluster markers based on zoom level
    const clusters = clusterMarkers(allMarkers, currentZoom);

    // Create markers for each cluster
    clusters.forEach(cluster => {
      if (!LeafletRef.current) return;

      if (cluster.length === 1) {
        // Single marker - render normally
        const { lat, lng, isBookmarked, data } = cluster[0];
        const { cityName, pizzeria, location, idx } = data;
        const icon = isBookmarked ? bookmarkedIconRef.current! : pizzaIconRef.current!;

        const marker = LeafletRef.current.marker([lat, lng], { icon });

          // Create popup content with bookmark button
          const newMarkerKey = `${cityName}-${pizzeria.name}-${idx}`;
          const bookmarkButtonId = `bookmark-${newMarkerKey}`;

          const popupContent = `
            <div style="padding: 10px; min-width: 200px;">
              <h3 style="margin: 0 0 10px 0; color: #dc2626; font-size: 16px; font-weight: bold;">
                ${pizzeria.name}
              </h3>
              ${pizzeria.awards && pizzeria.awards.length > 0
                ? pizzeria.awards.map(award => `
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                      <span style="color: #ca8a04; font-weight: bold; font-size: 13px;">
                        ${award.rank ? `#${award.rank}` : '🏆'}
                      </span>
                      <span style="font-size: 12px; color: #374151; font-weight: 500;">
                        ${award.name}
                      </span>
                    </div>
                  `).join('')
                : ''
              }
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

        bounds.push([lat, lng]);
      } else {
        // Cluster marker - show count and create custom icon
        const centerLat = cluster.reduce((sum, m) => sum + m.lat, 0) / cluster.length;
        const centerLng = cluster.reduce((sum, m) => sum + m.lng, 0) / cluster.length;

        const clusterIcon = LeafletRef.current.divIcon({
          html: `
            <div style="
              background: #dc2626;
              border: 3px solid white;
              border-radius: 50%;
              width: 40px;
              height: 40px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: 14px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              cursor: pointer;
            ">
              ${cluster.length}
            </div>
          `,
          className: '',
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const clusterMarker = LeafletRef.current.marker([centerLat, centerLng], { icon: clusterIcon });

        // Create popup showing list of pizzerias in cluster
        const clusterPopupContent = `
          <div style="padding: 10px; max-width: 250px;">
            <h3 style="margin: 0 0 10px 0; color: #dc2626; font-size: 14px; font-weight: bold;">
              ${cluster.length} Pizzerias in this area
            </h3>
            <div style="max-height: 200px; overflow-y: auto;">
              ${cluster.map(m => `
                <div style="padding: 6px 0; border-bottom: 1px solid #eee;">
                  <div style="font-weight: 600; font-size: 13px; color: #374151;">
                    ${m.data.pizzeria.name}
                  </div>
                  <div style="font-size: 11px; color: #6b7280;">
                    📍 ${m.data.cityName}
                  </div>
                </div>
              `).join('')}
            </div>
            <p style="margin: 10px 0 0 0; font-size: 11px; color: #9ca3af; text-align: center;">
              Zoom in to see individual markers
            </p>
          </div>
        `;

        clusterMarker.bindPopup(clusterPopupContent);

        // Zoom in on cluster click
        clusterMarker.on('click', () => {
          if (mapRef.current) {
            mapRef.current.setView([centerLat, centerLng], Math.min(currentZoom + 2, 18), {
              animate: true
            });
          }
        });

        clusterMarker.addTo(mapRef.current!);
        clusterMarkersRef.current.push(clusterMarker);

        bounds.push([centerLat, centerLng]);
      }
    });

    // Fit bounds only when data changes, not when zooming
    if (bounds.length > 0 && mapRef.current && shouldFitBoundsRef.current) {
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
  }, [isLeafletReady, cityData, selectedCity, bookmarks, zoomLevel, viewportBounds]);

  // Track when data changes vs zoom changes
  useEffect(() => {
    shouldFitBoundsRef.current = true;
  }, [cityData, selectedCity]);

  useEffect(() => {
    shouldFitBoundsRef.current = false;
  }, [zoomLevel]);

  // Re-cluster on zoom change and update viewport
  useEffect(() => {
    if (!mapRef.current || !isLeafletReady) return;

    const updateViewport = () => {
      if (mapRef.current) {
        setZoomLevel(mapRef.current.getZoom());
        setViewportBounds(mapRef.current.getBounds());
      }
    };

    // Set initial zoom and viewport
    updateViewport();

    // Update on zoom and move
    mapRef.current.on('zoomend', updateViewport);
    mapRef.current.on('moveend', updateViewport);

    return () => {
      if (mapRef.current) {
        mapRef.current.off('zoomend', updateViewport);
        mapRef.current.off('moveend', updateViewport);
      }
    };
  }, [isLeafletReady]);

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

    // Check if marker exists (in viewport)
    const marker = markersMapRef.current.get(selectedLocation);
    if (marker) {
      const latlng = marker.getLatLng();
      mapRef.current.setView(latlng, 15, {
        animate: true,
        duration: 0.5
      });
      marker.openPopup();
    } else {
      // Marker not in viewport - need to parse location from key and move there
      // Format: cityName-pizzeriaName-locationIndex
      const parts = selectedLocation.split('-');
      const locationIndex = parseInt(parts[parts.length - 1]);
      const pizzeriaName = parts.slice(1, -1).join('-');
      const cityName = parts[0];

      // Find the location in data
      const cityInfo = cityData?.[cityName];
      if (cityInfo) {
        const pizzeria = cityInfo.pizzerias.find(p => p.name === pizzeriaName);
        if (pizzeria && pizzeria.locations[locationIndex]) {
          const location = pizzeria.locations[locationIndex];
          mapRef.current.setView([location.lat, location.lng], 15, {
            animate: true,
            duration: 0.5
          });

          // Wait for viewport to update and marker to be created, then open popup
          setTimeout(() => {
            const newMarker = markersMapRef.current.get(selectedLocation);
            if (newMarker) {
              newMarker.openPopup();
            }
          }, 600); // Wait for animation + re-render
        }
      }
    }
  }, [selectedLocation, cityData]);

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

    const tileOptions: Record<string, unknown> = {
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
      awards?: Award[];
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
            markerKey: `${cityName}-${pizzeria.name}-${idx}`,
            awards: pizzeria.awards
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
