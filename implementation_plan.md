# Fix: AnisongDB Returns Anime Name but UI Waits for Image

## Problem

When AnisongDB successfully finds the anime name, the UI doesn't show the anime card until `fetchAnimeThemesImage()` completes. This function is **slow** because it performs:

1. A Google Translate API call to get name variations (~500ms)
2. An AnimeThemes general search request (~500ms-1s)
3. An AnimeThemes slug-based image lookup (~500ms-1s)

**Total delay: ~1.5-3 seconds** before the user sees the anime name, even though the name is already known.

## Root Cause Analysis

The `App.tsx` already has a 2-phase approach in the **primary path** (lines 119-137):
1. Call `findAnimeForTrack()` with `{ skipImage: true }` → show anime card immediately
2. Then fetch images separately and update the card

**However**, the `skipImage` option is only respected in **one code path** in `findAnimeForTrack()` (line 626). There are **three fallback paths** in `api.ts` that still block on `fetchAnimeThemesImage()` before returning:

| Code Path | Line | Blocks on Image? |
|-----------|------|-------------------|
| Primary AnisongDB match | 626-633 | ✅ Respects `skipImage` |
| AnimeThemes → AnisongDB re-search | 721 | ❌ **Always blocks** |
| AnimeThemes → AnisongDB fuzzy match | 749 | ❌ **Always blocks** |
| AnimeThemes direct fallback | 764 | ❌ **Always blocks** |

## Proposed Changes

### API Layer (`src/lib/api.ts`)

#### [MODIFY] [api.ts](file:///a:/MRA%20clone%20for%20anime/src/lib/api.ts)

Apply the `skipImage` option to **all** code paths that call `fetchAnimeThemesImage()`:

**Line 721** — AnimeThemes → AnisongDB re-search path:
```diff
-              const imageUrl = bestAnisong.animeImage || (await fetchAnimeThemesImage(anime.name)) || '';
+              const imageUrl = options?.skipImage ? '' : (bestAnisong.animeImage || (await fetchAnimeThemesImage(anime.name)) || '');
```

**Line 749** — AnimeThemes → fuzzy match path:
```diff
-                  const imgUrl = matched.animeImage || (await fetchAnimeThemesImage(matched.animeENName || matched.animeJPName || anime.name)) || '';
+                  const imgUrl = options?.skipImage ? '' : (matched.animeImage || (await fetchAnimeThemesImage(matched.animeENName || matched.animeJPName || anime.name)) || '');
```

**Line 764** — AnimeThemes direct fallback:
```diff
-        const imageUrl = await fetchAnimeThemesImage(anime.name) || '';
+        const imageUrl = options?.skipImage ? '' : (await fetchAnimeThemesImage(anime.name) || '');
```

These are **3 one-line changes** in a single file. The `App.tsx` already handles the 2-phase display correctly — it just needs the API to actually skip images when asked.

> [!NOTE]
> The primary AnisongDB path (line 626) already works correctly with `skipImage`. This fix extends that behavior to the 3 fallback paths.

## Verification Plan

### Manual Testing
1. Run `npm run dev`
2. Identify a song that uses one of the fallback paths (e.g. a song that AnisongDB finds but has no image)
3. Verify: anime card appears **immediately** with the disc placeholder icon
4. Verify: image loads in ~1-3 seconds and replaces the placeholder without flickering

### Console Logging
- Check for `[MRA] AnisongDB missing image, trying AnimeThemes for cover...` appearing **after** the anime card is already visible on screen
