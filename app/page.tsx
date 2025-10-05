'use client';

import { useEffect, useState } from 'react';
import Select from 'react-select';
import {FullMap } from './components/FullMap';
import { getBookmarks, toggleBookmark, isBookmarked, type BookmarkedLocation } from './utils/bookmarks';
import { useLocalState } from './hooks/useLocalState';
import { SettingsIcon, CloseIcon, SearchIcon, ChevronRightIcon, ChevronDownIcon, MenuIcon, NavigationIcon, BookmarkIcon, CheckCircleIcon } from './icons';

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

interface CityData {
  pizzerias: Pizzeria[];
}

interface City {
  name: string;
  value: string;
}

export default function Home() {
  const [cityData, setCityData] = useState<Record<string, CityData>>({});
  const [allCities, setAllCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useLocalState<string>('50toppizza_selected_city', '');
  const [selectedPizzeria, setSelectedPizzeria] = useState<string | null>(null);
  const [expandedPizzeria, setExpandedPizzeria] = useState<string | null>(null);
  const [stats, setStats] = useState<string>('Loading data...');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : true
  );
  const [activeTab, setActiveTab] = useState<'all' | 'nearest' | 'bookmarks'>('all');
  const [nearestPizzerias, setNearestPizzerias] = useState<Array<{
    name: string;
    city: string;
    distance: number;
    location: Location;
    url: string;
    markerKey: string;
  }>>([]);
  const [autoTriggerLocation, setAutoTriggerLocation] = useState(false);
  const [maxDistance, setMaxDistance] = useState(30); // km
  const [searchQuery, setSearchQuery] = useState('');
  const [bookmarks, setBookmarks] = useState<BookmarkedLocation[]>([]);
  const [mapStyle, setMapStyle] = useLocalState<'default' | 'light' | 'dark' | 'satellite'>('50toppizza_map_style', 'default');
  const [showSettings, setShowSettings] = useState(false);

  // Load data and check for location permissions
  useEffect(() => {
    Promise.all([
      fetch('/data/pizzeria_by_city.json').then(r => r.json()),
      fetch('/data/all_cities.json').then(r => r.json()).catch(() => null)
    ])
      .then(([scrapedData, cities]) => {
        setCityData(scrapedData);
        setAllCities(cities || Object.keys(scrapedData).map(name => ({ name, value: name })));

        // Check if we already have location permission
        if ('geolocation' in navigator && 'permissions' in navigator) {
          navigator.permissions.query({ name: 'geolocation' }).then((result) => {
            if (result.state === 'granted') {
              // We have permission, trigger auto location in map
              setAutoTriggerLocation(true);
            }
          });
        }
      })
      .catch(error => {
        console.error('Error loading data:', error);
        setStats('Error loading data');
      });
  }, []);

  // Load bookmarks from localStorage
  useEffect(() => {
    setBookmarks(getBookmarks());
  }, []);

  // Listen for bookmark toggle events from map
  useEffect(() => {
    const handleToggleBookmark = (event: CustomEvent) => {
      const { pizzeriaName, city, locationIndex, address, lat, lng, url } = event.detail;
      const result = toggleBookmark({
        pizzeriaName,
        city,
        locationIndex,
        address,
        lat,
        lng,
        url
      });
      setBookmarks(result.bookmarks);
    };

    window.addEventListener('toggleBookmark', handleToggleBookmark as EventListener);
    return () => {
      window.removeEventListener('toggleBookmark', handleToggleBookmark as EventListener);
    };
  }, []);

  // Update stats
  useEffect(() => {
    if (Object.keys(cityData).length === 0) return;

    if (selectedCity && cityData[selectedCity]) {
      const cityInfo = cityData[selectedCity];
      const locationCount = cityInfo.pizzerias.reduce((sum, p) => sum + p.locations.length, 0);
      setStats(`${cityInfo.pizzerias.length} pizzerias, ${locationCount} locations`);
    } else {
      const cities = Object.keys(cityData).length;
      const pizzerias = Object.values(cityData).reduce((sum, city) => sum + city.pizzerias.length, 0);
      const locations = Object.values(cityData).reduce(
        (sum, city) => sum + city.pizzerias.reduce((s, p) => s + p.locations.length, 0),
        0
      );
      setStats(`${cities} cities, ${pizzerias} pizzerias, ${locations} locations`);
    }
  }, [cityData, selectedCity]);

  const handleCityChange = (city: string) => {
    setSelectedCity(city);
    setSelectedPizzeria(null);
    setExpandedPizzeria(null);
  };

  const handlePizzeriaClick = (pizzeria: Pizzeria, cityName: string) => {
    // If single location, select it directly
    if (pizzeria.locations.length === 1) {
      setSelectedPizzeria(`${cityName}-${pizzeria.name}-0`);
      setExpandedPizzeria(null);
    } else {
      // If multiple locations, toggle expansion
      const key = `${cityName}-${pizzeria.name}`;
      setExpandedPizzeria(expandedPizzeria === key ? null : key);
    }
  };

  const handleLocationClick = (pizzeria: Pizzeria, cityName: string, locationIndex: number) => {
    setSelectedPizzeria(`${cityName}-${pizzeria.name}-${locationIndex}`);
  };

  const handleBookmarkToggle = (pizzeriaName: string, city: string, locationIndex: number, location: Location, url: string) => {
    const result = toggleBookmark({
      pizzeriaName,
      city,
      locationIndex,
      address: location.address,
      lat: location.lat,
      lng: location.lng,
      url
    });
    setBookmarks(result.bookmarks);
  };

  const renderPizzeriaList = () => {
    if (selectedCity && !cityData[selectedCity]) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-500">
          <p className="text-lg mb-2">📍 {selectedCity}</p>
          <p>This city hasn&apos;t been scraped yet.</p>
          <p className="mt-4 text-sm text-gray-400">
            Run the scraper with this city to collect data.
          </p>
        </div>
      );
    }

    const citiesToDisplay = selectedCity && cityData[selectedCity]
      ? { [selectedCity]: cityData[selectedCity] }
      : cityData;

    // Filter by search query
    const filteredData = Object.entries(citiesToDisplay).reduce((acc, [cityName, cityInfo]) => {
      const filteredPizzerias = cityInfo.pizzerias.filter(pizzeria =>
        pizzeria.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cityName.toLowerCase().includes(searchQuery.toLowerCase())
      );

      if (filteredPizzerias.length > 0) {
        acc[cityName] = { pizzerias: filteredPizzerias };
      }
      return acc;
    }, {} as Record<string, CityData>);

    if (searchQuery && Object.keys(filteredData).length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-500">
          <p className="text-lg mb-2">🔍 No results found</p>
          <p className="text-sm">Try a different search term</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {Object.entries(filteredData).map(([cityName, cityInfo]) =>
          cityInfo.pizzerias.map((pizzeria) => {
            const pizzeriaKey = `${cityName}-${pizzeria.name}`;
            const isExpanded = expandedPizzeria === pizzeriaKey;
            const hasMultipleLocations = pizzeria.locations.length > 1;

            return (
              <div
                key={pizzeriaKey}
                className={`bg-white border rounded-lg overflow-hidden transition-all ${
                  selectedPizzeria?.startsWith(pizzeriaKey) ? 'border-red-600 shadow-lg' : 'border-gray-200'
                }`}
              >
                {/* Main Card */}
                <div
                  onClick={() => handlePizzeriaClick(pizzeria, cityName)}
                  className={`p-4 cursor-pointer transition-all hover:bg-gray-50 ${
                    selectedPizzeria?.startsWith(pizzeriaKey) && !hasMultipleLocations ? 'bg-red-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-red-600 font-semibold text-base mb-2">
                        {pizzeria.name}
                      </h3>
                      <div className="flex gap-2 mb-2">
                        <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                          {cityName}
                        </span>
                        <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                          {pizzeria.locations.length} location{pizzeria.locations.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      {/* Show address for single location */}
                      {!hasMultipleLocations && pizzeria.locations[0] && (
                        <>
                          <p className="text-xs text-gray-600 mt-2">
                            📍 {pizzeria.locations[0].address || 'Location 1'}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${pizzeria.locations[0].lat},${pizzeria.locations[0].lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              <NavigationIcon className="w-3 h-3" />
                              Navigate
                            </a>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBookmarkToggle(pizzeria.name, cityName, 0, pizzeria.locations[0], pizzeria.url);
                              }}
                              className={`inline-flex items-center gap-1 text-xs font-medium transition-colors ${
                                isBookmarked(pizzeria.name, cityName, 0)
                                  ? 'text-yellow-600 hover:text-yellow-700'
                                  : 'text-gray-400 hover:text-yellow-600'
                              }`}
                              title={isBookmarked(pizzeria.name, cityName, 0) ? 'Remove bookmark' : 'Add bookmark'}
                            >
                              <BookmarkIcon className="w-4 h-4" filled={isBookmarked(pizzeria.name, cityName, 0)} />
                              {isBookmarked(pizzeria.name, cityName, 0) ? 'Saved' : 'Save'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    {/* Expand/Collapse icon for multiple locations */}
                    {hasMultipleLocations && (
                      <div className="ml-2 text-gray-400">
                        <ChevronDownIcon className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Expandable Location List */}
                {hasMultipleLocations && isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    {pizzeria.locations.map((location, idx) => {
                      const locationKey = `${pizzeriaKey}-${idx}`;
                      const isSelected = selectedPizzeria === locationKey;

                      return (
                        <div
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLocationClick(pizzeria, cityName, idx);
                          }}
                          className={`p-3 cursor-pointer transition-all hover:bg-gray-100 border-b border-gray-200 last:border-b-0 ${
                            isSelected ? 'bg-red-50 border-l-4 border-l-red-600' : ''
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-red-600 font-semibold text-xs mt-0.5">
                              #{idx + 1}
                            </span>
                            <div className="flex-1">
                              <p className="text-xs text-gray-700 leading-relaxed">
                                📍 {location.address || `Location ${idx + 1}`}
                              </p>
                              {location.lat && location.lng && (
                                <>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1">
                                    <a
                                      href={`https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                      <NavigationIcon className="w-3 h-3" />
                                      Navigate
                                    </a>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleBookmarkToggle(pizzeria.name, cityName, idx, location, pizzeria.url);
                                      }}
                                      className={`inline-flex items-center gap-1 text-xs font-medium transition-colors ${
                                        isBookmarked(pizzeria.name, cityName, idx)
                                          ? 'text-yellow-600 hover:text-yellow-700'
                                          : 'text-gray-400 hover:text-yellow-600'
                                      }`}
                                      title={isBookmarked(pizzeria.name, cityName, idx) ? 'Remove bookmark' : 'Add bookmark'}
                                    >
                                      <BookmarkIcon className="w-4 h-4" filled={isBookmarked(pizzeria.name, cityName, idx)} />
                                      {isBookmarked(pizzeria.name, cityName, idx) ? 'Saved' : 'Save'}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                            {isSelected && (
                              <span className="text-red-600">
                                <CheckCircleIcon className="w-4 h-4" />
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  const renderNearestList = () => {
    if (nearestPizzerias.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-500">
          <p className="text-lg mb-2">📍 No location set</p>
          <p>Click the location button on the map to find nearest pizzerias.</p>
        </div>
      );
    }

    // Filter by distance and search query
    const filteredPizzerias = nearestPizzerias.filter(p =>
      p.distance <= maxDistance &&
      (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       p.city.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
      <>
        {/* Distance Filter */}
        <div className="mb-4 pb-4 border-b border-gray-200">
          <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase">
            Max Distance: {maxDistance} km
          </label>
          <input
            type="range"
            min="5"
            max="100"
            step="5"
            value={maxDistance}
            onChange={(e) => setMaxDistance(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>5 km</span>
            <span>100 km</span>
          </div>
        </div>

        {/* Results count */}
        <div className="mb-3 text-sm text-gray-600">
          {filteredPizzerias.length} pizzeria{filteredPizzerias.length !== 1 ? 's' : ''} within {maxDistance} km
        </div>

        {/* List */}
        <div className="space-y-2">
          {filteredPizzerias.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              <p>No pizzerias found within {maxDistance} km.</p>
              <p className="text-sm mt-2">Try increasing the distance range.</p>
            </div>
          ) : (
            filteredPizzerias.map((pizzeria, index) => {
          const isSelected = selectedPizzeria === pizzeria.markerKey;

          return (
            <div
              key={pizzeria.markerKey}
              onClick={() => setSelectedPizzeria(pizzeria.markerKey)}
              className={`bg-white border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md ${
                isSelected ? 'border-red-600 shadow-lg bg-red-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Rank Badge */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                  index === 0 ? 'bg-yellow-400' :
                  index === 1 ? 'bg-gray-300' :
                  index === 2 ? 'bg-orange-400' :
                  'bg-gray-400'
                }`}>
                  {index + 1}
                </div>

                {/* Pizzeria Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-red-600 font-semibold text-sm mb-1 truncate">
                    {pizzeria.name}
                  </h3>
                  <div className="flex gap-2 flex-wrap mb-1">
                    <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded">
                      📍 {pizzeria.city}
                    </span>
                    <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded font-semibold">
                      {pizzeria.distance.toFixed(1)} km
                    </span>
                  </div>
                  {pizzeria.location.address && (
                    <p className="text-xs text-gray-500 truncate">
                      {pizzeria.location.address}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${pizzeria.location.lat},${pizzeria.location.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <NavigationIcon className="w-3 h-3" />
                      Navigate
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const locationIndex = parseInt(pizzeria.markerKey.split('-').pop() || '0');
                        handleBookmarkToggle(pizzeria.name, pizzeria.city, locationIndex, pizzeria.location, pizzeria.url);
                      }}
                      className={`inline-flex items-center gap-1 text-xs font-medium transition-colors ${
                        (() => {
                          const locationIndex = parseInt(pizzeria.markerKey.split('-').pop() || '0');
                          return isBookmarked(pizzeria.name, pizzeria.city, locationIndex)
                            ? 'text-yellow-600 hover:text-yellow-700'
                            : 'text-gray-400 hover:text-yellow-600';
                        })()
                      }`}
                      title={(() => {
                        const locationIndex = parseInt(pizzeria.markerKey.split('-').pop() || '0');
                        return isBookmarked(pizzeria.name, pizzeria.city, locationIndex) ? 'Remove bookmark' : 'Add bookmark';
                      })()}
                    >
                      <BookmarkIcon className="w-4 h-4" filled={(() => {
                        const locationIndex = parseInt(pizzeria.markerKey.split('-').pop() || '0');
                        return isBookmarked(pizzeria.name, pizzeria.city, locationIndex);
                      })()} />
                      {(() => {
                        const locationIndex = parseInt(pizzeria.markerKey.split('-').pop() || '0');
                        return isBookmarked(pizzeria.name, pizzeria.city, locationIndex) ? 'Saved' : 'Save';
                      })()}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })
          )}
        </div>
      </>
    );
  };

  const renderBookmarksList = () => {
    // Filter by search query
    const filteredBookmarks = bookmarks.filter(b =>
      b.pizzeriaName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.city.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (filteredBookmarks.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-500">
          <p className="text-lg mb-2">🔖 No bookmarks yet</p>
          <p className="text-sm">Save your favorite pizzerias to see them here.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {filteredBookmarks.map((bookmark) => {
          const markerKey = `${bookmark.city}-${bookmark.pizzeriaName}-${bookmark.locationIndex}`;
          const isSelected = selectedPizzeria === markerKey;

          return (
            <div
              key={`${bookmark.pizzeriaName}-${bookmark.city}-${bookmark.locationIndex}`}
              onClick={() => setSelectedPizzeria(markerKey)}
              className={`bg-white border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                isSelected ? 'border-red-600 shadow-lg bg-red-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-red-600 font-semibold text-base mb-2">
                    {bookmark.pizzeriaName}
                  </h3>
                  <div className="flex gap-2 mb-2">
                    <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                      {bookmark.city}
                    </span>
                    <span className="inline-block bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded">
                      ⭐ Bookmarked
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    📍 {bookmark.address || `Location ${bookmark.locationIndex + 1}`}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${bookmark.lat},${bookmark.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <NavigationIcon className="w-3 h-3" />
                      Navigate
                    </a>
                    <a
                      href={bookmark.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium"
                    >
                      More info →
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBookmarkToggle(bookmark.pizzeriaName, bookmark.city, bookmark.locationIndex, { address: bookmark.address, lat: bookmark.lat, lng: bookmark.lng }, bookmark.url);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-yellow-600 hover:text-yellow-700 font-medium"
                      title="Remove bookmark"
                    >
                      <BookmarkIcon className="w-4 h-4" filled={true} />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-screen fixed inset-0 md:static overflow-hidden">
      {/* Sidebar */}
      <div className={`bg-white flex flex-col border-r border-gray-200 transition-all duration-300 ${
        sidebarCollapsed ? 'hidden md:w-0' : 'h-screen md:h-full w-full md:w-96'
      }`}>
        {!sidebarCollapsed && (
          <>
            {/* Header */}
            <div className="bg-red-600 text-white p-3 md:p-5 relative">
              <h1 className="text-xl md:text-2xl font-bold mb-1">🍕 50 Top Pizza</h1>
              <p className="text-xs md:text-sm opacity-90 pr-8">Explore the world&apos;s best pizzerias</p>
              <button
                onClick={() => setShowSettings(true)}
                className="absolute top-1/2 -translate-y-1/2 right-3 md:right-5 p-2 hover:bg-red-700 rounded-full transition-colors"
                title="Settings"
              >
                <SettingsIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 px-2 md:px-4 py-3 text-xs md:text-sm font-semibold transition-all ${
                  activeTab === 'all'
                    ? 'bg-white text-red-600 border-b-2 border-red-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <span className="hidden sm:inline">All Pizzerias</span>
                <span className="sm:hidden">All</span>
              </button>
              <button
                onClick={() => setActiveTab('nearest')}
                className={`flex-1 px-2 md:px-4 py-3 text-xs md:text-sm font-semibold transition-all ${
                  activeTab === 'nearest'
                    ? 'bg-white text-red-600 border-b-2 border-red-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <span className="hidden sm:inline">Nearest</span>
                <span className="sm:hidden">Near</span> ({nearestPizzerias.length})
              </button>
              {bookmarks.length > 0 && (
                <button
                  onClick={() => setActiveTab('bookmarks')}
                  className={`flex-1 px-2 md:px-4 py-3 text-xs md:text-sm font-semibold transition-all ${
                    activeTab === 'bookmarks'
                      ? 'bg-white text-red-600 border-b-2 border-red-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <span className="hidden sm:inline">Bookmarks</span>
                  <span className="sm:hidden">Saved</span> ({bookmarks.length})
                </button>
              )}
            </div>

            {/* Search Bar */}
            <div className="p-3 md:p-4 bg-gray-50 border-b border-gray-200">
              <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase">
                Search Pizzerias
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or city..."
                  className="w-full px-3 py-2 pr-8 text-sm text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent placeholder:text-gray-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                )}
                {!searchQuery && (
                  <SearchIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                )}
              </div>
            </div>

            {/* City Selector - Only show for "All" tab */}
            {activeTab === 'all' && (
              <div className="p-3 md:p-4 bg-gray-50 border-b border-gray-200">
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase">
                  Select City
                </label>
                <Select
                  value={selectedCity ? { value: selectedCity, label: selectedCity } : null}
                  onChange={(option) => handleCityChange(option?.value || '')}
                  options={[
                    { value: '', label: 'All Cities' },
                    ...allCities.sort((a, b) => a.name.localeCompare(b.name)).map((city) => {
                      const isScraped = cityData[city.name];
                      return {
                        value: city.name,
                        label: `${city.name} ${isScraped ? `(${cityData[city.name].pizzerias.length})` : '(Not scraped)'}`,
                      };
                    })
                  ]}
                  isClearable
                  placeholder="Search cities..."
                  className="text-sm"
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: '38px',
                      borderColor: '#d1d5db',
                      '&:hover': { borderColor: '#9ca3af' }
                    }),
                    option: (base, state) => ({
                      ...base,
                      fontSize: '14px',
                      cursor: 'pointer',
                      color: '#1f2937',
                      backgroundColor: state.isSelected ? '#dc2626' : state.isFocused ? '#fee2e2' : 'white'
                    }),
                    singleValue: (base) => ({
                      ...base,
                      color: '#1f2937'
                    }),
                    input: (base) => ({
                      ...base,
                      color: '#1f2937'
                    })
                  }}
                />
              </div>
            )}

            {/* Stats */}
            <div className="p-2 md:p-4 bg-gray-50 border-b border-gray-200 text-xs md:text-sm text-gray-600">
              {stats}
            </div>

            {/* Content - Conditional based on active tab */}
            <div className="flex-1 overflow-y-auto p-2 md:p-4">
              {activeTab === 'all' ? renderPizzeriaList() : activeTab === 'nearest' ? renderNearestList() : renderBookmarksList()}
            </div>
          </>
        )}
      </div>

      {/* Collapse/Expand Button - Desktop only, mobile uses full screen toggle */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 bg-red-600 text-white p-2 rounded-r-md shadow-lg hover:bg-red-700 transition-all z-[1000]"
        style={{ left: sidebarCollapsed ? '0' : '384px' }}
      >
        <ChevronRightIcon className={`w-5 h-5 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
      </button>

      {/* Mobile Toggle Button - Bottom of screen */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="md:hidden fixed bottom-4 right-4 bg-red-600 text-white p-4 rounded-full shadow-lg hover:bg-red-700 transition-all z-[9999]"
      >
        {sidebarCollapsed ? (
          <MenuIcon className="w-6 h-6" />
        ) : (
          <CloseIcon className="w-6 h-6" />
        )}
      </button>

      {/* Map */}
      <FullMap
        cityData={cityData}
        selectedCity={selectedCity}
        selectedLocation={selectedPizzeria}
        autoTriggerLocation={autoTriggerLocation}
        maxDistance={maxDistance}
        bookmarks={bookmarks}
        mapStyle={mapStyle}
        onNearestPizzeriasUpdate={(pizzerias) => {
          setNearestPizzerias(pizzerias);
        }}
      />

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 flex items-center justify-center z-[10000] p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-red-600 text-white p-4 rounded-t-lg flex items-center justify-between">
              <h2 className="text-lg font-bold">⚙️ Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-red-700 rounded-full transition-colors"
              >
                <CloseIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Map Style Setting */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Map Style
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setMapStyle('default')}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      mapStyle === 'default'
                        ? 'border-red-600 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-3xl">🗺️</span>
                    <span className={`text-sm font-medium ${
                      mapStyle === 'default' ? 'text-red-600' : 'text-gray-700'
                    }`}>Default</span>
                  </button>
                  <button
                    onClick={() => setMapStyle('light')}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      mapStyle === 'light'
                        ? 'border-red-600 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-3xl">☀️</span>
                    <span className={`text-sm font-medium ${
                      mapStyle === 'light' ? 'text-red-600' : 'text-gray-700'
                    }`}>Light</span>
                  </button>
                  <button
                    onClick={() => setMapStyle('dark')}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      mapStyle === 'dark'
                        ? 'border-red-600 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-3xl">🌙</span>
                    <span className={`text-sm font-medium ${
                      mapStyle === 'dark' ? 'text-red-600' : 'text-gray-700'
                    }`}>Dark</span>
                  </button>
                  <button
                    onClick={() => setMapStyle('satellite')}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      mapStyle === 'satellite'
                        ? 'border-red-600 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-3xl">🛰️</span>
                    <span className={`text-sm font-medium ${
                      mapStyle === 'satellite' ? 'text-red-600' : 'text-gray-700'
                    }`}>Satellite</span>
                  </button>
                </div>
              </div>

              {/* App Info */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">About</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Explore the world&apos;s best pizzerias from 50 Top Pizza. Find nearby locations, save your favorites, and discover top-rated pizza spots worldwide.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Data source: <a href="https://www.50toppizza.it/" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">50toppizza.it</a>
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 rounded-b-lg border-t border-gray-200">
              <button
                onClick={() => setShowSettings(false)}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
