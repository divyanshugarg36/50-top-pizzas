'use client';

import { useEffect, useState } from 'react';
import Select from 'react-select';
import {FullMap } from './components/FullMap';

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
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedPizzeria, setSelectedPizzeria] = useState<string | null>(null);
  const [expandedPizzeria, setExpandedPizzeria] = useState<string | null>(null);
  const [stats, setStats] = useState<string>('Loading data...');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'nearest'>('all');
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

    return (
      <div className="space-y-3">
        {Object.entries(citiesToDisplay).map(([cityName, cityInfo]) =>
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
                        <p className="text-xs text-gray-600 mt-2">
                          📍 {pizzeria.locations[0].address || 'Location 1'}
                        </p>
                      )}
                    </div>
                    {/* Expand/Collapse icon for multiple locations */}
                    {hasMultipleLocations && (
                      <div className="ml-2 text-gray-400">
                        <svg
                          className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
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
                                <p className="text-xs text-gray-400 mt-1">
                                  {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                                </p>
                              )}
                            </div>
                            {isSelected && (
                              <span className="text-red-600">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
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

    const filteredPizzerias = nearestPizzerias.filter(p => p.distance <= maxDistance);

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

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className={`bg-white flex flex-col border-r border-gray-200 transition-all duration-300 ${
        sidebarCollapsed ? 'w-0' : 'w-96'
      }`}>
        {!sidebarCollapsed && (
          <>
            {/* Header */}
            <div className="bg-red-600 text-white p-5">
              <h1 className="text-2xl font-bold mb-1">🍕 50 Top Pizza</h1>
              <p className="text-sm opacity-90">Explore the world&apos;s best pizzerias</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 px-4 py-3 text-sm font-semibold transition-all ${
                  activeTab === 'all'
                    ? 'bg-white text-red-600 border-b-2 border-red-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                All Pizzerias
              </button>
              <button
                onClick={() => setActiveTab('nearest')}
                className={`flex-1 px-4 py-3 text-sm font-semibold transition-all ${
                  activeTab === 'nearest'
                    ? 'bg-white text-red-600 border-b-2 border-red-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Nearest ({nearestPizzerias.length})
              </button>
            </div>

            {/* City Selector - Only show for "All" tab */}
            {activeTab === 'all' && (
              <div className="p-4 bg-gray-50 border-b border-gray-200">
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
            <div className="p-4 bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
              {stats}
            </div>

            {/* Content - Conditional based on active tab */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'all' ? renderPizzeriaList() : renderNearestList()}
            </div>
          </>
        )}
      </div>

      {/* Collapse/Expand Button */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="absolute left-0 top-1/2 -translate-y-1/2 bg-red-600 text-white p-2 rounded-r-md shadow-lg hover:bg-red-700 transition-all z-[1000]"
        style={{ left: sidebarCollapsed ? '0' : '384px' }}
      >
        <svg
          className={`w-5 h-5 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Map */}
      <FullMap
        cityData={cityData}
        selectedCity={selectedCity}
        selectedLocation={selectedPizzeria}
        autoTriggerLocation={autoTriggerLocation}
        maxDistance={maxDistance}
        onNearestPizzeriasUpdate={(pizzerias) => {
          setNearestPizzerias(pizzerias);
        }}
      />
    </div>
  );
}
