#!/usr/bin/env python3
"""
Command-line interface for the scraper
"""

import argparse
import json
import os
from .scraper import scrape_cities, get_all_cities, auto_scrape_cities
from .config import DATA_DIR
from . import progress as progress_module


def main():
    parser = argparse.ArgumentParser(
        description='Scrape pizzeria data from 50toppizza.it'
    )

    parser.add_argument(
        'cities',
        nargs='*',
        help='City names to scrape (e.g., Roma Naples Milan). Use "all" to scrape all cities.'
    )

    parser.add_argument(
        '--list-cities',
        action='store_true',
        help='List all available cities and exit'
    )

    parser.add_argument(
        '--fetch-cities',
        action='store_true',
        help='Fetch and save the list of all cities'
    )

    parser.add_argument(
        '--auto-scrape',
        action='store_true',
        help='Automatically scrape all pending cities one by one (can be interrupted with Ctrl+C)'
    )

    parser.add_argument(
        '--progress',
        action='store_true',
        help='Show scraping progress statistics'
    )

    parser.add_argument(
        '--reset',
        action='store_true',
        help='Reset scraping progress (use this to re-scrape everything)'
    )

    parser.add_argument(
        '--sync',
        action='store_true',
        help='Sync progress file with existing scraped data'
    )

    args = parser.parse_args()

    # Handle --reset command
    if args.reset:
        confirm = input("⚠️  This will reset all scraping progress. Are you sure? (yes/no): ")
        if confirm.lower() == 'yes':
            progress_module.reset_progress()
            print("✅ Progress has been reset. You can now re-scrape all cities.")
        else:
            print("❌ Reset cancelled.")
        return

    # Handle --progress command
    if args.progress:
        progress = progress_module.load_progress()
        print("\n50 Top Pizza - Scraping Progress")
        print("="*60)
        print(f"Scraped cities:  {progress['stats']['scraped_cities']}")
        print(f"Pending cities:  {progress['stats']['pending_cities']}")
        print(f"Total cities:    {progress['stats']['total_cities']}")
        print(f"Total pizzerias: {progress['stats']['total_pizzerias']}")
        print(f"Total locations: {progress['stats']['total_locations']}")

        if progress['last_updated']:
            print(f"\nLast updated: {progress['last_updated']}")

        # Show some scraped cities
        scraped = [name for name, data in progress['cities'].items() if data['status'] == 'scraped']
        if scraped:
            print(f"\nRecent scraped cities ({min(10, len(scraped))}):")
            for city in scraped[:10]:
                city_data = progress['cities'][city]
                print(f"  - {city}: {city_data['pizzeria_count']} pizzerias, {city_data['location_count']} locations")
        print("="*60)
        return

    # Handle --sync command
    if args.sync:
        print("Syncing progress with existing data...")
        existing_file = f'{DATA_DIR}/pizzeria_by_city.json'
        if os.path.exists(existing_file):
            with open(existing_file, 'r', encoding='utf-8') as f:
                data_by_city = json.load(f)
            progress = progress_module.load_progress()
            progress = progress_module.sync_progress_with_data(progress, data_by_city)
            print(f"✅ Synced {progress['stats']['scraped_cities']} cities")
        else:
            print("⚠️  No existing data found to sync")
        return

    # Handle --auto-scrape command
    if args.auto_scrape:
        auto_scrape_cities()
        return

    # Handle --list-cities command
    if args.list_cities:
        cities = get_all_cities()
        print(f"\n{len(cities)} cities available:\n")
        for city in cities[:20]:
            print(f"  - {city['name']}")
        if len(cities) > 20:
            print(f"  ... and {len(cities) - 20} more")
        return

    # Handle --fetch-cities command
    if args.fetch_cities:
        print("Fetching all cities from website...")
        cities = get_all_cities()

        os.makedirs(DATA_DIR, exist_ok=True)

        with open(f'{DATA_DIR}/all_cities.json', 'w', encoding='utf-8') as f:
            json.dump(cities, f, indent=2, ensure_ascii=False)

        print(f'✓ Saved {len(cities)} cities to {DATA_DIR}/all_cities.json')
        return

    # Handle city scraping
    if not args.cities:
        parser.print_help()
        print("\nExamples:")
        print("  python -m scraping.cli Roma Naples")
        print("  python -m scraping.cli all")
        print("  python -m scraping.cli --list-cities")
        print("  python -m scraping.cli --fetch-cities")
        print("  python -m scraping.cli --auto-scrape")
        print("  python -m scraping.cli --progress")
        print("  python -m scraping.cli --reset")
        print("  python -m scraping.cli --sync")
        return

    # Parse cities argument
    cities_to_scrape = 'all' if 'all' in args.cities else args.cities

    # Run scraper
    print("50 Top Pizza - Scraper")
    print("="*60)
    scrape_cities(cities_to_scrape)


if __name__ == "__main__":
    main()
