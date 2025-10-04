# Scraped Cities Tracking

This file tracks which cities have been scraped from 50 Top Pizza.

## Statistics
- **Total cities available:** 591
- **Cities scraped:** 16
- **Total pizzerias:** 148
- **Total locations:** 212
- **Progress:** 2.7%

## Scraped Cities

### Europe
- ✅ Amsterdam (Netherlands) - 4 pizzerias
- ✅ Barcelona (Spain) - 5 pizzerias
- ✅ Berlin (Germany) - 7 pizzerias
- ✅ Florence (Italy) - 1 pizzeria
- ✅ Lisbon (Portugal) - 6 pizzerias
- ✅ London (UK) - 12 pizzerias
- ✅ Madrid (Spain) - 9 pizzerias
- ✅ Mannheim (Germany) - 3 pizzerias
- ✅ Paris (France) - 16 pizzerias
- ✅ Roma (Italy) - 32 pizzerias

### Italy
- ✅ Bologna - 5 pizzerias
- ✅ Florence (Firenze) - 1 pizzeria
- ✅ Roma - 32 pizzerias

### North America
- ✅ Chicago (USA) - 7 pizzerias
- ✅ Los Angeles (USA) - 2 pizzerias
- ✅ Miami (USA) - 4 pizzerias
- ✅ New York (USA) - 20 pizzerias
- ✅ San Francisco (USA) - 5 pizzerias

## To Scrape

### Priority - Major Cities

#### Europe
- [ ] Vienna (Austria)
- [ ] Brussels (Belgium)
- [ ] Copenhagen (Denmark)

#### Italy (High Pizza Density)
- [ ] Naples (Napoli) - **Priority**
- [ ] Milan (Milano) - **Priority**
- [ ] Venice (Venezia)
- [ ] Turin (Torino)
- [ ] Verona
- [ ] Palermo

#### North America
- [ ] Toronto (Canada)
- [ ] Mexico City (Mexico)
- [ ] Montreal (Canada)
- [ ] Boston (USA)
- [ ] Seattle (USA)
- [ ] Portland (USA)

#### Asia
- [ ] Tokyo
- [ ] Seoul
- [ ] Hong Kong
- [ ] Singapore
- [ ] Bangkok

#### South America
- [ ] Buenos Aires
- [ ] São Paulo
- [ ] Rio de Janeiro

#### Oceania
- [ ] Sydney
- [ ] Melbourne

## Last Updated
2025-01-04 21:00 UTC

## How to Scrape More Cities

```bash
# Activate virtual environment
source venv/bin/activate

# Scrape specific cities
python -m scraping.cli "Naples" "Milan" "Venice"

# List all available cities
python -m scraping.cli --list-cities
```
