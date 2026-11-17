# StyleSync — Your Personal AI Fashion Assistant

StyleSync is a local-first digital wardrobe and AI styling desktop application built with **React, TypeScript, Express, SQLite (`better-sqlite3`), Google Gemma (`@google/genai`), and Open-Meteo**.

## Architecture

- **Frontend (`src/`)**: React 19 + TypeScript + Tailwind CSS v4 across 7 modules:
  1. **Dashboard**: Real SQLite metrics, daily look suggestion, live Open-Meteo weather summary, recently uploaded and most-worn garments, and quick actions.
  2. **My Wardrobe**: Multi-file local image upload (`JPG, PNG, JPEG, WEBP`), category tabs, search, season filter, sorting, inline edit, delete, favourite, and mark-worn tracking.
  3. **AI Studio (Combined Module)**:
     - **Clothing Recognition**: Gemma vision garment analysis into editable fields with manual entry fallback.
     - **Outfit Recommendation**: Occasion-driven outfit generation referencing only existing SQLite item IDs (validated server-side), with deterministic local style-engine fallback if Gemma is unavailable.
     - **Fashion Chat**: Wardrobe-grounded styling assistant referencing actual owned garments.
  4. **Weather Assistant**: Open-Meteo city search, 5-day forecast, and weather-matched wardrobe styling.
  5. **Favourites**: Persistent favourite garments and saved outfits.
  6. **Wear & Calendar**: Most-worn / least-worn analytics, chronological wear history, and an interactive monthly outfit calendar.
  7. **Settings**: Profile, fashion preferences, configurable Google Gemma model ID (`gemma-4-26b-a4b-it` default), preferred weather city, and local storage telemetry.
- **Backend (`server.ts`, `server/`)**: Express API server with SQLite persistence (`data/stylesync.db`) and local garment image storage (`data/uploads/`).
- **Desktop Wrapper (`electron/`)**: Pre-configured Electron entry point storing user data in `app.getPath('userData')` via `STYLESYNC_DATA_DIR`.

## Local Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set your server-side API key in `.env`:
   ```bash
   GEMINI_API_KEY="your_api_key_here"
   ```
3. Run the full-stack development server (port 3000):
   ```bash
   npm run dev
   ```
4. Build the frontend bundle:
   ```bash
   npm run build
   ```

## Packaging & Running as a Desktop Software Application (Windows `.exe`, macOS `.dmg`, Linux `.AppImage`)

1. Build both the frontend bundle (`dist/`) and bundled backend server (`dist-server/server.cjs`):
   ```bash
   npm run build:desktop
   ```
2. Install Electron and `electron-builder` locally when packaging native desktop installers:
   ```bash
   npm install -D electron electron-builder
   ```
3. Launch StyleSync as a desktop application locally:
   ```bash
   npm run desktop
   ```
4. Build platform installers (`release/`):
   ```bash
   npm run desktop:win   # Windows NSIS installer (.exe) + portable
   npm run desktop:mac   # macOS DMG (.dmg) + zip
   npm run desktop:linux # Linux AppImage
   ```
5. Alternatively, click **Install Desktop App** directly in Chromium/Chrome/Edge to install StyleSync as a standalone desktop window.

