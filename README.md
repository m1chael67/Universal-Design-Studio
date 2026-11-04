# Universal Design Studio

React + Vite + Mapbox GL JS site planner for accurately scaled event tent placement on satellite maps.

## Local development

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

## Appwrite Sites deployment

- Framework: React
- Root directory: `./`
- Install: `npm install`
- Build: `npm run build`
- Output directory: `./dist`
- Fallback: `index.html`

## Current capabilities

- Satellite imagery and address search using the user's Mapbox public token
- Distance measurement in feet
- Dimensionally scaled tent footprints, rotation, movement and clearance outline
- Autosaving the current project in browser storage, JSON export/import

Appwrite sign-in and cloud project storage, photo editing, interior furniture plans, and 3D are planned but **not yet implemented**. Verify aerial imagery, dimensions and site conditions in person. Do not rely on preliminary layouts for permits or anchoring engineering.
