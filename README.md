# Cebu Transport Guide

A mobile-first commuter web atlas for Metro Cebu public transportation.

## Included
- Searchable route book for traditional jeepneys, modern PUVs, MyBus, BEEP/CIBUS, UV Express, provincial buses, and Cebu BRT
- Route detail cards with origins, common waiting areas, drop-off areas, and landmarks
- Interactive Leaflet/OpenStreetMap master map with toggleable transport layers
- Direct-route and one-transfer trip finder
- Major transport hub cards
- Saved routes using localStorage
- Mobile bottom navigation and dark mode
- PWA shell caching for route content; online map tiles still require connectivity unless cached by the browser

## Run locally

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## Railway deployment
This repository is Railway-ready. Railway detects the Node app from `package.json`, installs dependencies, and runs `npm start`. The server listens on Railway's `PORT` environment variable automatically.

Health check endpoint: `/health`

## Data note
Public transport operations can change. The app intentionally distinguishes community route references from official/operator-published information. Map polylines are schematic corridor visualizations, not turn-by-turn GPS traces.
