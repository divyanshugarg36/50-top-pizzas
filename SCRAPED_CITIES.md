# Scraped Cities Tracking

This file tracks which cities have been scraped from 50 Top Pizza.

## Statistics
- **Total cities available:** 591
- **Cities scraped:** 21
- **Total pizzerias:** 166
- **Total locations:** 235
- **Progress:** 3.6%

## Scraped Cities

### Europe
- ✅ Amsterdam (Netherlands) - 4 pizzerias
- ✅ Barcelona (Spain) - 5 pizzerias
- ✅ Berlin (Germany) - 7 pizzerias
- ✅ Brussels (Belgium) - 3 pizzerias
- ✅ Copenhagen (Denmark) - 1 pizzeria
- ✅ Florence (Italy) - 1 pizzeria
- ✅ Lisbon (Portugal) - 6 pizzerias
- ✅ London (UK) - 12 pizzerias
- ✅ Madrid (Spain) - 9 pizzerias
- ✅ Mannheim (Germany) - 3 pizzerias
- ✅ Paris (France) - 16 pizzerias
- ✅ Roma (Italy) - 32 pizzerias
- ✅ Vienna (Austria) - 6 pizzerias

### Italy
- ✅ Bologna - 5 pizzerias
- ✅ Florence (Firenze) - 1 pizzeria
- ✅ Roma - 32 pizzerias

### North America
- ✅ Chicago (USA) - 7 pizzerias
- ✅ Los Angeles (USA) - 2 pizzerias
- ✅ Mexico City (Mexico) - 1 pizzeria
- ✅ Miami (USA) - 4 pizzerias
- ✅ New York (USA) - 20 pizzerias
- ✅ San Francisco (USA) - 5 pizzerias

### Asia
- ✅ Tokyo (Japan) - 6 pizzerias

## To Scrape

### Priority - Major Cities

#### Europe
- [ ] Prague (Czech Republic)
- [ ] Stockholm (Sweden)
- [ ] Oslo (Norway)

#### Italy (High Pizza Density)
- [ ] Naples (Napoli) - **Priority**
- [ ] Milan (Milano) - **Priority**
- [ ] Venice (Venezia)
- [ ] Turin (Torino)
- [ ] Verona
- [ ] Palermo

#### North America
- [ ] Toronto (Canada)
- [ ] Montreal (Canada)
- [ ] Boston (USA)
- [ ] Seattle (USA)
- [ ] Portland (USA)
- [ ] Philadelphia (USA)

#### Asia
- [ ] Seoul (South Korea)
- [ ] Hong Kong
- [ ] Singapore
- [ ] Bangkok (Thailand)
- [ ] Shanghai (China)

#### South America
- [ ] Buenos Aires
- [ ] São Paulo
- [ ] Rio de Janeiro

#### Oceania
- [ ] Sydney
- [ ] Melbourne

## Last Updated
2025-10-04

## How to Scrape More Cities

```bash
# Activate virtual environment
source venv/bin/activate

# Scrape specific cities
python -m scraping.cli "Naples" "Milan" "Venice"

# List all available cities
python -m scraping.cli --list-cities
```
