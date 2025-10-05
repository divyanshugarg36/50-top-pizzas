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
import signal
import sys

from .config import BASE_URL, HEADERS, RATE_LIMIT, DATA_DIR
from . import progress as progress_module


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
            'locations': [],
            'awards': []
        }

        # Extract awards (e.g., "3° 50 Top World Artisan Pizza Chains 2024" or "50 Top Pizza Europa 2025")
        # Look for text patterns that match award rankings
        # Remove navigation, footer, and other non-content areas to avoid false matches
        for element in soup.find_all(['nav', 'footer', 'header']):
            element.decompose()

        # Also remove common navigation classes
        for element in soup.find_all(class_=lambda x: x and any(term in str(x).lower() for term in ['menu', 'nav', 'footer', 'header', 'sidebar'])):
            element.decompose()

        text_content = soup.get_text()

        # Patterns with rankings
        ranked_patterns = [
            r'(\d+)°\s+([^\n]+(?:Top|Award|Prize)[^\n]+\d{4})',  # Matches "3° 50 Top World... 2024"
            r'(\d+)°\s+([^\n]+(?:Top|Award|Prize)[^\n]+)',       # Without year
        ]

        # Patterns without rankings (just awards/recognitions)
        unranked_patterns = [
            r'(50\s+Top\s+Pizza[^\n]+\d{4}(?:\s*-[^\n]+)?)',     # "50 Top Pizza Europa 2025 - Excellent Pizzerias"
            r'(50\s+Top\s+[^\n]+\d{4}(?:\s*-[^\n]+)?)',          # "50 Top World... 2024 - Special mention"
        ]

        seen_awards = set()
        seen_award_names = set()  # Track award names to avoid ranked/unranked duplicates

        # Extract ranked awards (priority over unranked)
        for pattern in ranked_patterns:
            matches = re.finditer(pattern, text_content, re.I)
            for match in matches:
                rank = match.group(1)
                award_name = match.group(2).strip()
                # Clean up the award name (remove extra whitespace)
                award_name = ' '.join(award_name.split())
                award_name_normalized = award_name.lower()

                # Deduplicate awards
                award_key = (int(rank), award_name)
                if award_key not in seen_awards:
                    seen_awards.add(award_key)
                    seen_award_names.add(award_name_normalized)
                    result['awards'].append({
                        'rank': int(rank),
                        'name': award_name
                    })

        # Extract unranked awards (only if not already found as ranked)
        for pattern in unranked_patterns:
            matches = re.finditer(pattern, text_content, re.I)
            for match in matches:
                award_name = match.group(1).strip()
                # Clean up the award name (remove extra whitespace)
                award_name = ' '.join(award_name.split())
                award_name_normalized = award_name.lower()

                # Skip if we already have this award (ranked or unranked)
                if award_name_normalized in seen_award_names:
                    continue

                # Deduplicate awards (use None for rank)
                award_key = (None, award_name)
                if award_key not in seen_awards:
                    seen_awards.add(award_key)
                    seen_award_names.add(award_name_normalized)
                    result['awards'].append({
                        'rank': None,
                        'name': award_name
                    })

        # Find all Google Maps links (standard format)
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

        # Also extract JavaScript map data (for pages with embedded maps)
        scripts = soup.find_all('script')
        for script in scripts:
            script_text = script.string
            if script_text and ('lat:' in script_text or 'lng:' in script_text):
                # Find all lat/lng/address groups in JavaScript
                js_locations = re.finditer(
                    r'lat:\s*(-?\d+\.\d+),\s*lng:\s*(-?\d+\.\d+),\s*address:\s*["\']([^"\']+)["\']',
                    script_text,
                    re.MULTILINE
                )

                for match in js_locations:
                    location = {
                        'lat': float(match.group(1)),
                        'lng': float(match.group(2)),
                        'address': match.group(3)
                    }
                    result['locations'].append(location)

        # Deduplicate locations by coordinates (same lat/lng = same place)
        seen_coords = set()
        unique_locations = []
        for location in result['locations']:
            coord_key = (location['lat'], location['lng'])
            if coord_key not in seen_coords:
                seen_coords.add(coord_key)
                unique_locations.append(location)

        result['locations'] = unique_locations

        return result

    except Exception as e:
        print(f"      Error: {e}")
        return None


def save_data(data_by_city):
    """Save to JSON and GeoJSON"""
    # Ensure data directory exists
    os.makedirs(DATA_DIR, exist_ok=True)

    # Save city-organized data
    output_path = f'{DATA_DIR}/pizzeria_by_city.json'
    with open(output_path, 'w', encoding='utf-8') as f:
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
                            "total_locations": len(pizzeria['locations']),
                            "awards": pizzeria.get('awards', [])
                        }
                    }
                    geojson['features'].append(feature)

    # Save GeoJSON
    with open(f'{DATA_DIR}/pizzeria_locations.geojson', 'w', encoding='utf-8') as f:
        json.dump(geojson, f, indent=2, ensure_ascii=False)


def scrape_cities(cities_to_scrape, progress=None):
    """
    Main scraping function

    Args:
        cities_to_scrape: List of city names or 'all'
        progress: Optional progress object (used for auto-scraping)
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

    # Load or initialize progress
    if progress is None:
        progress = progress_module.load_progress()

    # Global deduplication tracker: track (pizzeria_name, lat, lng) across all cities
    global_location_tracker = {}  # key: (pizzeria_name, lat, lng) -> value: city_name (first occurrence)

    # Build tracker from existing data
    for city_name, city_data in data_by_city.items():
        for pizzeria in city_data.get('pizzerias', []):
            pizzeria_name = pizzeria['name']
            for location in pizzeria.get('locations', []):
                lat = location.get('lat')
                lng = location.get('lng')
                if lat and lng:
                    location_key = (pizzeria_name, lat, lng)
                    if location_key not in global_location_tracker:
                        global_location_tracker[location_key] = city_name

    duplicates_skipped = 0

    for i, city in enumerate(all_cities):
        city_name = city['name']
        print(f"\n[{i+1}/{len(all_cities)}] {city_name}")

        # Search for pizzerias
        pizzerias = search_city(city_name)

        if not pizzerias:
            print(f"    No pizzerias found, skipping")
            progress_module.mark_city_scraped(progress, city_name, 0, 0)
            continue

        city_data = {'pizzerias': []}

        # Get details for each pizzeria
        for j, pizzeria in enumerate(pizzerias):
            print(f"    [{j+1}/{len(pizzerias)}] {pizzeria['name']}...")

            details = extract_pizzeria_details(pizzeria['url'])

            if details:
                # Filter out duplicate locations using global tracker
                unique_locations = []
                for location in details['locations']:
                    lat = location.get('lat')
                    lng = location.get('lng')
                    if lat and lng:
                        location_key = (pizzeria['name'], lat, lng)

                        # Check if this location already exists in another city
                        if location_key in global_location_tracker:
                            existing_city = global_location_tracker[location_key]
                            if existing_city != city_name:
                                # Duplicate found - skip it
                                duplicates_skipped += 1
                                print(f"        ⚠ Skipping duplicate location (already in {existing_city})")
                                continue
                        else:
                            # New location - track it
                            global_location_tracker[location_key] = city_name

                        unique_locations.append(location)

                pizzeria_data = {
                    'name': pizzeria['name'],
                    'url': pizzeria['url'],
                    'locations': unique_locations,
                    'awards': details.get('awards', [])
                }

                # Only add pizzeria if it has locations OR awards (keep award-only pizzerias)
                if unique_locations or details.get('awards'):
                    city_data['pizzerias'].append(pizzeria_data)

                    # Show info
                    location_info = f"{len(unique_locations)} location(s)" if unique_locations else "no locations"
                    awards_info = f", {len(details['awards'])} award(s)" if details.get('awards') else ""
                    print(f"        {location_info}{awards_info}")

            time.sleep(RATE_LIMIT)

        if city_data['pizzerias']:
            data_by_city[city_name] = city_data

            # Save after each city
            save_data(data_by_city)

            # Update progress
            pizzeria_count = len(city_data['pizzerias'])
            location_count = sum(len(p['locations']) for p in city_data['pizzerias'])
            progress_module.mark_city_scraped(progress, city_name, pizzeria_count, location_count)

            print(f"    ✓ Saved {pizzeria_count} pizzerias")

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
    if duplicates_skipped > 0:
        print(f"Duplicates skipped: {duplicates_skipped}")
    print(f"{'='*60}")


def auto_scrape_cities():
    """
    Auto-scrape all pending cities one by one
    Saves progress after each city so it can be interrupted safely
    """
    print("Starting auto-scrape mode...")
    print("Press Ctrl+C to stop (progress will be saved)\n")

    # Setup signal handler for graceful shutdown
    interrupted = {'flag': False}

    def signal_handler(sig, frame):
        print("\n\n🛑 Interrupted by user. Saving progress...")
        interrupted['flag'] = True

    signal.signal(signal.SIGINT, signal_handler)

    # Load progress and get all cities
    progress = progress_module.load_progress()
    all_cities = get_all_cities()

    # Mark all cities as known (pending if not scraped)
    for city in all_cities:
        progress_module.mark_city_pending(progress, city['name'])

    # Save progress after marking all cities
    progress_module.save_progress(progress)

    # Get pending cities
    pending_cities = progress_module.get_pending_cities(progress, all_cities)

    if not pending_cities:
        print("✅ All cities have been scraped!")
        print(f"Total: {progress['stats']['scraped_cities']} cities")
        return

    print(f"Found {len(pending_cities)} cities to scrape")
    print(f"Already scraped: {progress['stats']['scraped_cities']}")
    print("="*60)

    # Load existing data
    data_by_city = {}
    existing_file = f'{DATA_DIR}/pizzeria_by_city.json'
    if os.path.exists(existing_file):
        with open(existing_file, 'r', encoding='utf-8') as f:
            data_by_city = json.load(f)

    # Global deduplication tracker: track (pizzeria_name, lat, lng) across all cities
    global_location_tracker = {}  # key: (pizzeria_name, lat, lng) -> value: city_name (first occurrence)

    # Build tracker from existing data
    for city_name, city_data in data_by_city.items():
        for pizzeria in city_data.get('pizzerias', []):
            pizzeria_name = pizzeria['name']
            for location in pizzeria.get('locations', []):
                lat = location.get('lat')
                lng = location.get('lng')
                if lat and lng:
                    location_key = (pizzeria_name, lat, lng)
                    if location_key not in global_location_tracker:
                        global_location_tracker[location_key] = city_name

    duplicates_skipped = 0

    # Scrape each pending city
    for i, city in enumerate(pending_cities):
        if interrupted['flag']:
            break

        city_name = city['name']
        print(f"\n[{i+1}/{len(pending_cities)}] {city_name}")

        try:
            # Search for pizzerias
            pizzerias = search_city(city_name)

            if not pizzerias:
                print(f"    No pizzerias found, skipping")
                progress_module.mark_city_scraped(progress, city_name, 0, 0)
                continue

            city_data = {'pizzerias': []}

            # Get details for each pizzeria
            for j, pizzeria in enumerate(pizzerias):
                if interrupted['flag']:
                    break

                print(f"    [{j+1}/{len(pizzerias)}] {pizzeria['name']}...")

                details = extract_pizzeria_details(pizzeria['url'])

                if details:
                    # Filter out duplicate locations using global tracker
                    unique_locations = []
                    for location in details['locations']:
                        lat = location.get('lat')
                        lng = location.get('lng')
                        if lat and lng:
                            location_key = (pizzeria['name'], lat, lng)

                            # Check if this location already exists in another city
                            if location_key in global_location_tracker:
                                existing_city = global_location_tracker[location_key]
                                if existing_city != city_name:
                                    # Duplicate found - skip it
                                    duplicates_skipped += 1
                                    print(f"        ⚠ Skipping duplicate location (already in {existing_city})")
                                    continue
                            else:
                                # New location - track it
                                global_location_tracker[location_key] = city_name

                            unique_locations.append(location)

                    pizzeria_data = {
                        'name': pizzeria['name'],
                        'url': pizzeria['url'],
                        'locations': unique_locations,
                        'awards': details.get('awards', [])
                    }

                    # Only add pizzeria if it has locations OR awards (keep award-only pizzerias)
                    if unique_locations or details.get('awards'):
                        city_data['pizzerias'].append(pizzeria_data)

                        # Show info
                        location_info = f"{len(unique_locations)} location(s)" if unique_locations else "no locations"
                        awards_info = f", {len(details['awards'])} award(s)" if details.get('awards') else ""
                        print(f"        {location_info}{awards_info}")

                time.sleep(RATE_LIMIT)

            if city_data['pizzerias']:
                data_by_city[city_name] = city_data

                # Save after each city
                save_data(data_by_city)

                # Update progress
                pizzeria_count = len(city_data['pizzerias'])
                location_count = sum(len(p['locations']) for p in city_data['pizzerias'])
                progress_module.mark_city_scraped(progress, city_name, pizzeria_count, location_count)

                print(f"    ✓ Saved {pizzeria_count} pizzerias")

            time.sleep(RATE_LIMIT)

        except Exception as e:
            print(f"    ⚠ Error scraping {city_name}: {e}")
            continue

    # Final summary
    progress = progress_module.load_progress()
    print(f"\n{'='*60}")
    if interrupted['flag']:
        print("Scraping interrupted by user")
    else:
        print("Auto-scraping complete!")

    print(f"\nProgress:")
    print(f"  Scraped cities: {progress['stats']['scraped_cities']}")
    print(f"  Pending cities: {progress['stats']['pending_cities']}")
    print(f"  Total pizzerias: {progress['stats']['total_pizzerias']}")
    print(f"  Total locations: {progress['stats']['total_locations']}")
    if duplicates_skipped > 0:
        print(f"  Duplicates skipped: {duplicates_skipped}")
    print(f"{'='*60}")
