# 50 Top Pizza Map

Interactive map showcasing the world's best pizzerias from [50 Top Pizza](https://www.50toppizza.it/), built with Next.js and OpenStreetMap.

## ✨ Features

- 🗺️ **OpenStreetMap Integration** - Interactive map with custom markers (no API key required!)
- 🏙️ **City Explorer** - Browse pizzerias by city (591 cities available)
- 📍 **Multiple Locations** - Support for pizzerias with multiple branches
- 🔍 **Search & Filter** - City dropdown with scraped/unscraped status
- 📊 **Live Stats** - Real-time statistics for cities, pizzerias, and locations
- 🎨 **Modern UI** - Built with Next.js 15, TypeScript, and Tailwind CSS

## 📁 Project Structure

```
50TopPizzas/
├── app/              # Next.js app router
│   ├── components/   # React components
│   └── page.tsx      # Main page
├── public/data/      # Scraped pizzeria data (JSON) - single source of truth
├── scraping/         # Python web scraper
│   ├── __init__.py
│   ├── __main__.py
│   ├── cli.py        # Command-line interface
│   ├── config.py     # Configuration
│   └── scraper.py    # Main scraping logic
├── venv/             # Python virtual environment
└── node_modules/     # Node dependencies
```

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd 50TopPizzas
npm install
```

### 2. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🕷️ Scraping Data

Want to add more cities? Use the built-in Python scraper with smart progress tracking!

### Prerequisites

- Python 3.8+
- pip (Python package manager)

### One-Time Setup

```bash
# Create Python virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Usage

**Important:** Always activate the virtual environment first!

```bash
# Activate virtual environment (required for every new terminal session)
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

#### Auto-Scrape All Cities (Recommended ✨)

Automatically scrapes all pending cities one by one. Can be safely interrupted with Ctrl+C - progress is saved after each city!

```bash
python -m scraping.cli --auto-scrape
```

This command:
- ✅ Tracks which cities have been scraped
- ✅ Resumes from where it left off if interrupted
- ✅ Saves progress after each city
- ✅ Shows real-time statistics

#### View Progress

Check how many cities have been scraped:

```bash
python -m scraping.cli --progress
```

#### Scrape Specific Cities

```bash
python -m scraping.cli Roma Naples Milan
```

#### Scrape All Cities (Legacy)

```bash
python -m scraping.cli all
```

#### Reset Progress (Re-scrape Everything)

Use this when the 50 Top Pizza website is updated:

```bash
python -m scraping.cli --reset
```

#### Sync Progress with Existing Data

If you already have scraped data, sync it with the progress tracker:

```bash
python -m scraping.cli --sync
```

#### Other Commands

```bash
# List available cities
python -m scraping.cli --list-cities

# Fetch and save city list
python -m scraping.cli --fetch-cities
```

### Output

Data is automatically saved to `public/data/` (single source of truth):

Files generated:
- `pizzeria_by_city.json` - Pizzerias organized by city
- `pizzeria_locations.geojson` - Geographic data for mapping
- `all_cities.json` - List of all available cities
- `cities_progress.json` - Scraping progress tracker

### Troubleshooting

**Error: `ModuleNotFoundError: No module named 'requests'`**

You forgot to activate the virtual environment! Run:
```bash
source venv/bin/activate
```

**Want to exit the virtual environment?**
```bash
deactivate
```

## 🛠️ Technologies

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
- **Maps:** OpenStreetMap (Leaflet.js)
- **Scraper:** Python 3, BeautifulSoup4, Requests
- **Data Source:** [50 Top Pizza](https://www.50toppizza.it/)

## 📊 Current Dataset

- **16 cities** scraped across Europe, Italy, and North America
- **148 pizzerias** with locations
- **212 total locations** mapped
- **591 cities available** to scrape

### Major Cities Covered
- 🇺🇸 USA: New York, Chicago, Los Angeles, Miami, San Francisco
- 🇬🇧 UK: London
- 🇫🇷 France: Paris
- 🇪🇸 Spain: Barcelona, Madrid
- 🇩🇪 Germany: Berlin, Mannheim
- 🇮🇹 Italy: Roma, Bologna, Florence
- 🇵🇹 Portugal: Lisbon
- 🇳🇱 Netherlands: Amsterdam

## 🚢 Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

The app is ready to deploy to Vercel, Netlify, or any other Next.js hosting platform.

## 📝 Development Scripts

```bash
# Frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Scraper
source venv/bin/activate
python -m scraping.cli --help          # Show all scraper commands
python -m scraping.cli --auto-scrape   # Auto-scrape all pending cities
python -m scraping.cli --progress      # View progress
python -m scraping.cli --reset         # Reset progress
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## ⚖️ Legal & Ethics

- ✅ Respects `robots.txt` (only WordPress JSON API is disallowed)
- ✅ Rate-limited requests (0.5s between requests)
- ✅ Educational/research purpose with proper User-Agent
- ✅ Data is publicly available on 50toppizza.it

## 📄 License

This project is for educational purposes. All pizzeria data belongs to [50 Top Pizza](https://www.50toppizza.it/).

---

Made with ❤️ and 🍕
