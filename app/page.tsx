'use client';

import { useEffect, useState } from 'react';
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

  // Load data
  useEffect(() => {
    Promise.all([
      fetch('/data/pizzeria_by_city.json').then(r => r.json()),
      fetch('/data/all_cities.json').then(r => r.json()).catch(() => null)
    ])
      .then(([scrapedData, cities]) => {
        setCityData(scrapedData);
        setAllCities(cities || Object.keys(scrapedData).map(name => ({ name, value: name })));
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

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-96 bg-white flex flex-col border-r border-gray-200">
        {/* Header */}
        <div className="bg-red-600 text-white p-5">
          <h1 className="text-2xl font-bold mb-1">🍕 50 Top Pizza</h1>
          <p className="text-sm opacity-90">Explore the world&apos;s best pizzerias</p>
        </div>

        {/* City Selector */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase">
            Select City
          </label>
          <select
            value={selectedCity}
            onChange={(e) => handleCityChange(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white cursor-pointer"
          >
            <option value="">All Cities</option>
            {allCities.sort((a, b) => a.name.localeCompare(b.name)).map((city) => {
              const isScraped = cityData[city.name];
              return (
                <option
                  key={city.name}
                  value={city.name}
                  className={!isScraped ? 'text-gray-400' : ''}
                >
                  {city.name} {isScraped ? `(${cityData[city.name].pizzerias.length})` : '(Not scraped)'}
                </option>
              );
            })}
          </select>
        </div>

        {/* Stats */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
          {stats}
        </div>

        {/* Pizzeria List */}
        <div className="flex-1 overflow-y-auto p-4">
          {renderPizzeriaList()}
        </div>
      </div>

      {/* Map */}
      <FullMap
        cityData={cityData}
        selectedCity={selectedCity}
        selectedLocation={selectedPizzeria}
      />
    </div>
  );
}
