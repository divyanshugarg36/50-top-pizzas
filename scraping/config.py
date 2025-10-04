"""
Configuration for 50 Top Pizza scraper
"""

# Base URL for the website
BASE_URL = "https://www.50toppizza.it"

# HTTP Headers for requests
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; PizzeriaMapBot/1.0; Educational/Research Purpose)',
}

# Rate limiting (seconds between requests)
RATE_LIMIT = 0.5

# Data output path (single source of truth for Next.js)
DATA_DIR = 'public/data'
