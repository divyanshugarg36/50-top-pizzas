#!/usr/bin/env python3
"""
Command-line interface for the scraper
"""

import argparse
import json
from .scraper import scrape_cities, get_all_cities
from .config import DATA_DIR, PUBLIC_DATA_DIR


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

    args = parser.parse_args()

    if args.list_cities:
        cities = get_all_cities()
        print(f"\n{len(cities)} cities available:\n")
        for city in cities[:20]:
            print(f"  - {city['name']}")
        if len(cities) > 20:
            print(f"  ... and {len(cities) - 20} more")
        return

    if args.fetch_cities:
        print("Fetching all cities from website...")
        cities = get_all_cities()

        import os
        os.makedirs(DATA_DIR, exist_ok=True)
        os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)

        with open(f'{DATA_DIR}/all_cities.json', 'w', encoding='utf-8') as f:
            json.dump(cities, f, indent=2, ensure_ascii=False)

        with open(f'{PUBLIC_DATA_DIR}/all_cities.json', 'w', encoding='utf-8') as f:
            json.dump(cities, f, indent=2, ensure_ascii=False)

        print(f'✓ Saved {len(cities)} cities to {DATA_DIR}/all_cities.json')
        print(f'✓ Copied to {PUBLIC_DATA_DIR}/all_cities.json')
        return

    if not args.cities:
        parser.print_help()
        print("\nExamples:")
        print("  python -m scraping.cli Roma Naples")
        print("  python -m scraping.cli all")
        print("  python -m scraping.cli --list-cities")
        print("  python -m scraping.cli --fetch-cities")
        return

    # Parse cities argument
    cities_to_scrape = 'all' if 'all' in args.cities else args.cities

    # Run scraper
    print("50 Top Pizza - Scraper")
    print("="*60)
    scrape_cities(cities_to_scrape)


if __name__ == "__main__":
    main()
