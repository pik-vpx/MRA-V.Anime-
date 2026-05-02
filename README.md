# MRA Anime Edition

🎵 **Music Recognition App** that identifies anime songs and matches them to their source anime — powered by Shazam, AnisongDB, AnimeThemes.

## Features

- 🎵 **Song Identification** — Identify songs via microphone, desktop audio, or file upload
- 🎬 **Anime Matching** — Multi-pass search across AnisongDB + AnimeThemes with Romaji translation
- 🖼️ **Cover Art** — High-quality anime images from AnimeThemes.moe (lazy-loaded for instant UI)
- 📝 **Lyrics** — Real-time lyrics from Lrclib
- 🤖 **AI Fallback** — Disabled (Google Gemini not functional)
- ⚡ **Instant Results** — Anime name shown immediately; cover art loads in the background
- 🎨 **Modern UI** — Dark theme with Framer Motion animations
- ⌨️ **Global Hotkeys** — Trigger from anywhere with customizable shortcuts

---

## Quick Start

### Run Built EXE (Easiest)
```
release\win-unpacked\MRA Anime Edition.exe
```

### Development Mode

**Prerequisites:** Node.js 18+, npm 9+

```bash
npm install
npm run dev            # Web dev server → http://localhost:5173
npm run electron:dev   # Electron desktop app with hot reload
```

### Build for Production
```bash
npm run electron:build
```
Output: `release\win-unpacked\MRA Anime Edition.exe`

---

## How It Works

> **Note:** Recent updates improve title handling by stripping extra tags (e.g., "(Instrumental)", "(Album Mix)") and generic "with ..." patterns, and enhance fuzzy matching thresholds for better AnimeThemes fallback.

```
Audio Input → Shazam API → Track Identified
                              ↓
                   AnisongDB Multi-Pass Search
                   (exact → romaji → partial → fuzzy)
                              ↓
              ┌───── Found? ──────┐
              ↓                   ↓
         AnisongDB Result    AnimeThemes Song Search
              ↓                   ↓
         Rank & Score        Cross-Reference w/ AnisongDB
              ↓                   ↓
              └───── Merge ───────┘
                       ↓
               No AI fallback (Gemini disabled)
                       ↓
               UI: Anime Card + Cover Art (lazy)
```

## Updated Flow

The orchestrator now includes additional cleaning steps:
- Removes "(Instrumental)", "(Album Mix)", and other version tags.
- Strips generic "with <text>" patterns before a dash.
- Fuzzy matching thresholds have been tuned to handle spacing variations and missing characters.

These changes improve handling of titles such as:
- `Noria - Hitominokotae (instrumental)` → matches `Hitomi no Kotae`
- `fripSide - Two souls -toward the truth-` → matches `Two souls～toward the truth～`
- `Centimillimental - Seishunnoenbu` → matches `Seishun no Enbu`
- `Necry Talkie - Fuzaketenaize(Album Mix)` → correctly stripped `(Album Mix)`
- `きら☆ぴか - Hanawopu-n` → special characters normalized.


### Matching Algorithm
1. **Exact title + artist** match via AnisongDB
2. **Romaji translation** of Japanese titles (Google Translate API)
3. **Partial/fuzzy matching** with Levenshtein distance thresholds
4. **Cross-referencing** AnimeThemes results back to AnisongDB for alignment
5. **No AI fallback** – Gemini disabled

---

## Project Structure

```
src/
├── App.tsx                    # Main UI component
├── types.ts                   # Shared types (AppSettings, ElectronAPI)
├── lib/
│   ├── api.ts                 # Orchestrator (AnisongDB → AnimeThemes)
│   ├── shazam.ts              # Audio fingerprinting via Shazam API
│   ├── anisongdb.ts           # Multi-pass anime song database search
│   ├── animethemes.ts         # Cover art & song-based anime lookup
│   ├── romaji.ts              # Japanese → Romaji translation
│   ├── gemini.ts              # Google Gemini AI fallback (disabled)
│   ├── lyrics.ts              # Lrclib lyrics fetching
│   ├── text-utils.ts          # Query cleaning, normalization, fuzzy matching
│   └── audio.ts               # Mic/desktop audio recording
├── hooks/
│   ├── useAnimeSearch.ts      # 2-phase anime search (instant name → lazy image)
│   └── useSettings.ts         # Settings persistence hook
├── components/
│   └── Settings.tsx           # Settings page
└── utils/
    └── logger.ts              # Environment-aware logging

electron/
├── main.cjs                   # Electron main process
└── preload.cjs                # IPC bridge
```

---

## Environment Variables

Create a `.env` file with:

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_GOOGLE_GEMINI_API_KEY` | Google Gemini API key (currently not used) | Optional |

```bash
VITE_GOOGLE_GEMINI_API_KEY=your-api-key-here
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+M` | Toggle microphone listening |
| `Ctrl+Shift+D` | Toggle desktop audio listening |

Shortcuts are customizable in Settings.

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19 | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 8 | Dev server & bundler |
| Tailwind CSS | 4 | Styling |
| Framer Motion | — | Animations |
| Electron | 41 | Desktop app shell |

---

## API Dependencies

| API | Purpose | Auth |
|-----|---------|------|
| [Shazam (RapidAPI)](https://rapidapi.com/apidojo/api/shazam) | Audio fingerprinting | API key (built-in) |
| [AnisongDB](https://anisongdb.com) | Anime song database | None |
| [AnimeThemes.moe](https://api.animethemes.moe) | Cover art & song lookup | None |
| [Google Translate](https://translate.googleapis.com) | Romaji translation | None |
| [Google Gemini](https://ai.google.dev) | AI fallback (disabled) | API key (optional) |
| [Lrclib](https://lrclib.net) | Lyrics | None |

---

## Troubleshooting

### Port 5173 already in use
```bash
npx kill-port 5173
npm run dev
```

### Electron won't start
```bash
rm -rf node_modules/.vite
npm run electron:dev
```

### Code signing error during build (Windows)
This is expected — the unsigned EXE is still created in `release\win-unpacked\`.

---

## Credits

- [Shazam API](https://rapidapi.com/apidojo/api/shazam) for audio fingerprinting
- [AnisongDB](https://anisongdb.com) for anime song database
- [AnimeThemes.moe](https://animethemes.moe) for cover art
- [Lrclib.net](https://lrclib.net) for lyrics
- [Google Gemini](https://ai.google.dev) for AI fallback