# MRA Anime Edition - Running Instructions

## Quick Start

### Option 1: Run Built EXE (Easiest)
```
release\win-unpacked\MRA Anime Edition.exe
```
Double-click to run the portable executable.

---

## Development Mode

### Prerequisites
- Node.js 18+
- npm 9+

### Install Dependencies
```bash
npm install
```

### Run Web Dev Server (Browser)
```bash
npm run dev
```
Then open: http://localhost:5173

### Run Electron App (Desktop)
```bash
npm run electron:dev
```
This opens the Electron window with:
- Vite dev server on http://localhost:5173
- Hot reload enabled

### Debug Electron
After running `npm run electron:dev`:
1. Open Chrome and go to: http://localhost:9222
2. Or press F12 in the Electron window for DevTools

---

## Build EXE

### Build for Production
```bash
npm run electron:build
```
Output: `release\win-unpacked\MRA Anime Edition.exe`

---

## Features

- 🎵 **Song Identification** - Identify songs via microphone or desktop audio
- 🎬 **Anime Matching** - Auto-detect anime from song title/artist
- 🖼️ **Cover Art** - Fetch anime images from AnimeThemes
- 📝 **Lyrics** - Display lyrics when available
- ⚡ **Fast Response** - Optimized matching algorithm
- 🎨 **Modern UI** - Beautiful dark theme with animations

---

## Keyboard Shortcuts (when app is in background)

- **Ctrl+Shift+M** - Toggle microphone listening
- **Ctrl+Shift+D** - Toggle desktop audio listening

---

## Troubleshooting

### Port 5173 already in use
```bash
# Kill existing process
npx kill-port 5173
npm run dev
```

### Electron won't start
```bash
# Clear cache and rebuild
rm -rf node_modules/.vite
npm run electron:dev
```

### Code signing error during build (Windows)
This is normal - the EXE is still created successfully in `release\win-unpacked/`

---

## Project Structure

```
MRA Anime/
├── src/
│   ├── App.tsx           # Main UI
│   ├── lib/
│   │   ├── api.ts        # Song matching API
│   │   └── audio.ts      # Audio recording
│   └── components/
│       └── Settings.tsx  # Settings page
├── electron/
│   ├── main.cjs          # Electron main process
│   └── preload.cjs       # IPC bridge
├── release/
│   └── win-unpacked/
│       └── MRA Anime Edition.exe  # Built app
└── package.json
```

---

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS 4
- Framer Motion
- Electron 41

---

## Credits

- Shazam API for song identification
- AnisongDB for anime matching
- AnimeThemes.moe for cover art
- Lrclib.net for lyrics
# MRA-V.Anime-