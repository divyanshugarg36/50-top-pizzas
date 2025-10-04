#!/usr/bin/env python3
"""
Progress tracking for city scraping
Manages which cities have been scraped and which are pending
"""

import json
import os
from datetime import datetime
from .config import PROGRESS_FILE, DATA_DIR


def load_progress():
    """Load progress from JSON file"""
    if os.path.exists(PROGRESS_FILE):
        try:
            with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠ Could not load progress file: {e}")
            return initialize_progress()
    return initialize_progress()


def initialize_progress():
    """Initialize empty progress structure"""
    return {
        "version": "1.0",
        "last_updated": None,
        "cities": {},
        "stats": {
            "total_cities": 0,
            "scraped_cities": 0,
            "pending_cities": 0,
            "total_pizzerias": 0,
            "total_locations": 0
        }
    }


def save_progress(progress):
    """Save progress to JSON file"""
    os.makedirs(DATA_DIR, exist_ok=True)
    progress["last_updated"] = datetime.now().isoformat()

    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(progress, f, indent=2, ensure_ascii=False)


def mark_city_scraped(progress, city_name, pizzeria_count, location_count):
    """Mark a city as scraped with stats"""
    progress["cities"][city_name] = {
        "status": "scraped",
        "scraped_at": datetime.now().isoformat(),
        "pizzeria_count": pizzeria_count,
        "location_count": location_count
    }
    update_stats(progress)
    save_progress(progress)


def mark_city_pending(progress, city_name):
    """Mark a city as pending"""
    if city_name not in progress["cities"]:
        progress["cities"][city_name] = {
            "status": "pending",
            "scraped_at": None,
            "pizzeria_count": 0,
            "location_count": 0
        }
    update_stats(progress)


def update_stats(progress):
    """Recalculate statistics"""
    scraped = sum(1 for c in progress["cities"].values() if c["status"] == "scraped")
    pending = sum(1 for c in progress["cities"].values() if c["status"] == "pending")
    total_pizzerias = sum(c["pizzeria_count"] for c in progress["cities"].values())
    total_locations = sum(c["location_count"] for c in progress["cities"].values())

    progress["stats"] = {
        "total_cities": len(progress["cities"]),
        "scraped_cities": scraped,
        "pending_cities": pending,
        "total_pizzerias": total_pizzerias,
        "total_locations": total_locations
    }


def reset_progress():
    """Reset all progress (for re-scraping)"""
    progress = initialize_progress()
    save_progress(progress)
    return progress


def sync_progress_with_data(progress, data_by_city):
    """Sync progress file with actual scraped data"""
    for city_name, city_data in data_by_city.items():
        pizzeria_count = len(city_data.get('pizzerias', []))
        location_count = sum(
            len(p.get('locations', []))
            for p in city_data.get('pizzerias', [])
        )

        if city_name not in progress["cities"] or progress["cities"][city_name]["status"] != "scraped":
            progress["cities"][city_name] = {
                "status": "scraped",
                "scraped_at": datetime.now().isoformat(),
                "pizzeria_count": pizzeria_count,
                "location_count": location_count
            }

    update_stats(progress)
    save_progress(progress)
    return progress


def get_pending_cities(progress, all_cities):
    """Get list of cities that haven't been scraped yet"""
    scraped_city_names = {
        name for name, data in progress["cities"].items()
        if data["status"] == "scraped"
    }

    pending = [
        city for city in all_cities
        if city['name'] not in scraped_city_names
    ]

    return pending
