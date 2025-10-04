#!/usr/bin/env python3
"""
Main scraper for 50 Top Pizza website
Scrapes pizzeria data city by city using WordPress search
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re
from urllib.parse import urljoin
import os

from .config import BASE_URL, HEADERS, RATE_LIMIT, DATA_DIR, PUBLIC_DATA_DIR


def get_all_cities():
    """Fetch all cities from the dropdown"""
    print("Fetching city list...")
    search_url = f"{BASE_URL}/cerca/"
    response = requests.get(search_url, headers=HEADERS)
    soup = BeautifulSoup(response.content, 'html.parser')

    city_select = soup.find('select', id='comuneSelect2')
    if not city_select:
        print("City dropdown not found!")
        return []

    cities = []
    for option in city_select.find_all('option'):
        city_name = option.text.strip()
        city_value = option.get('value', '')
        if city_name and city_value:
            cities.append({
                'name': city_name,
                'value': city_value
            })

    print(f"Found {len(cities)} cities")
    return cities


def search_city(city_name):
    """
    Search for pizzerias in a city using WordPress search
    """
    print(f"\n  Searching for: {city_name}")

    # Use WordPress search
    search_url = f"{BASE_URL}/?s={city_name}"

    try:
        response = requests.get(search_url, headers=HEADERS, timeout=30)
        soup = BeautifulSoup(response.content, 'html.parser')

        # Find all referenza links (pizzeria pages)
        pizzerias = []
        links = soup.find_all('a', href=re.compile(r'/referenza/[^/]+/?'))

        seen_urls = set()
        for link in links:
            href = link.get('href')
            url = urljoin(BASE_URL, href)

            if url in seen_urls:
                continue
            seen_urls.add(url)

            # Try to get pizzeria name from link or nearby elements
            name = None

            # Check img alt text
            img = link.find('img')
            if img and img.get('alt'):
                name = img.get('alt').strip()

            # Check link text
            if not name:
                text = link.get_text(strip=True)
                if text and len(text) > 2:
                    name = text

            # Extract from URL as fallback
            if not name:
                slug = href.split('/referenza/')[-1].strip('/')
                name = slug.replace('-', ' ').title()

            # Clean name: remove city suffix if present
            if name:
                # Remove city name from end if present
                if name.endswith(city_name):
                    name = name[:-len(city_name)].strip()
                # Also handle Roma/Rome variations
                elif city_name == 'Roma' and name.endswith('Rome'):
                    name = name[:-4].strip()

                pizzerias.append({
                    'name': name,
                    'url': url
                })

        print(f"    Found {len(pizzerias)} pizzerias")
        return pizzerias

    except Exception as e:
        print(f"    Error: {e}")
        return []


def extract_pizzeria_details(pizzeria_url):
    """Extract all location details from a pizzeria page"""
    try:
        response = requests.get(pizzeria_url, headers=HEADERS, timeout=30)
        soup = BeautifulSoup(response.content, 'html.parser')

        result = {
            'locations': []
        }

        # Find all Google Maps links
        maps_links = soup.find_all('a', href=re.compile(r'google\.com/maps/dir'))

        for maps_link in maps_links:
            location = {
                'address': None,
                'lat': None,
                'lng': None,
            }

            # Extract coordinates
            href = maps_link.get('href', '')
            coords_match = re.search(r'destination=(-?\d+\.\d+),(-?\d+\.\d+)', href)
            if coords_match:
                location['lat'] = float(coords_match.group(1))
                location['lng'] = float(coords_match.group(2))

            # Extract address from nearby text
            parent = maps_link.parent
            if parent:
                text = parent.get_text(separator=' ', strip=True)
                # Look for address patterns
                address_patterns = [
                    r'(?:Via|Piazza|Viale|Corso|Street|Avenue|Road|Rue|Calle|Straße)[^,\n]+(?:,\s*[\d\w\s]+)?',
                    r'indirizzo:\s*([^,\n]+(?:,\s*[^,\n]+)?)',
                ]

                for pattern in address_patterns:
                    address_match = re.search(pattern, text, re.I)
                    if address_match:
                        location['address'] = address_match.group(0).strip()
                        break

                # Fallback: use parent text if short enough
                if not location['address'] and len(text) < 200:
                    location['address'] = text

            if location['lat'] and location['lng']:
                result['locations'].append(location)

        return result

    except Exception as e:
        print(f"      Error: {e}")
        return None


def save_data(data_by_city):
    """Save to JSON and GeoJSON"""
    # Ensure data directories exist
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)

    # Save city-organized data
    output_path = f'{DATA_DIR}/pizzeria_by_city.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data_by_city, f, indent=2, ensure_ascii=False)

    # Also save to public folder
    public_path = f'{PUBLIC_DATA_DIR}/pizzeria_by_city.json'
    with open(public_path, 'w', encoding='utf-8') as f:
        json.dump(data_by_city, f, indent=2, ensure_ascii=False)

    # Create GeoJSON
    geojson = {
        "type": "FeatureCollection",
        "features": []
    }

    for city_name, city_data in data_by_city.items():
        for pizzeria in city_data['pizzerias']:
            for location_idx, location in enumerate(pizzeria['locations']):
                if location['lat'] and location['lng']:
                    feature = {
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": [location['lng'], location['lat']]
                        },
                        "properties": {
                            "city": city_name,
                            "pizzeria_name": pizzeria['name'],
                            "address": location['address'],
                            "url": pizzeria['url'],
                            "location_index": location_idx,
                            "total_locations": len(pizzeria['locations'])
                        }
                    }
                    geojson['features'].append(feature)

    # Save GeoJSON to both locations
    with open(f'{DATA_DIR}/pizzeria_locations.geojson', 'w', encoding='utf-8') as f:
        json.dump(geojson, f, indent=2, ensure_ascii=False)

    with open(f'{PUBLIC_DATA_DIR}/pizzeria_locations.geojson', 'w', encoding='utf-8') as f:
        json.dump(geojson, f, indent=2, ensure_ascii=False)


def scrape_cities(cities_to_scrape):
    """
    Main scraping function

    Args:
        cities_to_scrape: List of city names or 'all'
    """

    # Get all cities
    all_cities = get_all_cities()

    # Filter if needed
    if cities_to_scrape != 'all':
        all_cities = [c for c in all_cities if c['name'] in cities_to_scrape]

    print(f"\nScraping {len(all_cities)} cities")
    print("="*60)

    # Load existing data to merge with new data
    data_by_city = {}
    existing_file = f'{DATA_DIR}/pizzeria_by_city.json'
    if os.path.exists(existing_file):
        try:
            with open(existing_file, 'r', encoding='utf-8') as f:
                data_by_city = json.load(f)
            print(f"\n✓ Loaded existing data: {len(data_by_city)} cities")
        except Exception as e:
            print(f"\n⚠ Could not load existing data: {e}")
    else:
        print("\n✓ Starting fresh (no existing data found)")

    for i, city in enumerate(all_cities):
        city_name = city['name']
        print(f"\n[{i+1}/{len(all_cities)}] {city_name}")

        # Search for pizzerias
        pizzerias = search_city(city_name)

        if not pizzerias:
            print(f"    No pizzerias found, skipping")
            continue

        city_data = {'pizzerias': []}

        # Get details for each pizzeria
        for j, pizzeria in enumerate(pizzerias):
            print(f"    [{j+1}/{len(pizzerias)}] {pizzeria['name']}...")

            details = extract_pizzeria_details(pizzeria['url'])

            if details and details['locations']:
                pizzeria_data = {
                    'name': pizzeria['name'],
                    'url': pizzeria['url'],
                    'locations': details['locations']
                }
                city_data['pizzerias'].append(pizzeria_data)
                print(f"        {len(details['locations'])} location(s)")

            time.sleep(RATE_LIMIT)

        if city_data['pizzerias']:
            data_by_city[city_name] = city_data

            # Save after each city
            save_data(data_by_city)
            print(f"    ✓ Saved {len(city_data['pizzerias'])} pizzerias")

        time.sleep(RATE_LIMIT)

    # Final summary
    print(f"\n{'='*60}")
    print(f"Complete!")
    print(f"Cities with data: {len(data_by_city)}")

    total_pizzerias = sum(len(city['pizzerias']) for city in data_by_city.values())
    total_locations = sum(
        len(p['locations'])
        for city in data_by_city.values()
        for p in city['pizzerias']
    )

    print(f"Total pizzerias: {total_pizzerias}")
    print(f"Total locations: {total_locations}")
    print(f"{'='*60}")
