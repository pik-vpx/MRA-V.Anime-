# AGENTS.md - MRA Anime Edition

## Build Commands
- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint (25 pre-existing errors, mostly `any` types)

## Tech Stack
React 19, TypeScript, Vite, Tailwind CSS 4, Framer Motion, Electron

## Known Issues (Pre-existing)
- 25 lint errors (mostly `@typescript-eslint/no-explicit-any`)
- Settings.tsx: `loadDevices` used before declared (React hook order)
- api.ts: `romajiTitle` scope issue at line 359 (fixed in this session)

## Critical: AnimeThemes Image Fetching
In `src/lib/api.ts`, `fetchAnimeThemesImage()` uses a 2-step approach:
1. `?q=${animeName}` - General search gets first result's slug
2. `filter[slug]=${slug}&include=images` - Reliable slug-based image lookup

This replaced the broken `filter[name]=` exact-match which failed ~46% of the time.

## Architecture
- `src/App.tsx` - Main React UI (457 lines)
- `src/lib/api.ts` - Shazam + Anime matching + Lyrics APIs
- `src/lib/audio.ts` - Mic/desktop audio recording
- `src/components/Settings.tsx` - Settings page
- `electron/` - Electron main + preload scripts