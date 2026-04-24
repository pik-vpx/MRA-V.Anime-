# MRA Anime - TODO

## Completed (April 22, 2026)

### Song Search Logic Fixes

- [x] **Character name detection**: `isCharacterName()` skips artist filter when Japanese names detected
- [x] **AnisongDB wrapper fix**: Extract `data.value` from `{ value: [...], Count: N }` wrapper
- [x] **Title normalization**: `normalizeTitle()` for consistent fuzzy comparison
- [x] **Levenshtein distance**: `levenshtein()` for fuzzy matching
- [x] **Fuzzy match helper**: `fuzzyMatch()` with configurable threshold
- [x] **AnimeThemes fallback**: Enhanced with title similarity checks
  - Exact normalized match → partial inclusion (dist ≤4) → fuzzy (threshold 5)
- [x] **Anime name alignment**: `matchesAnime()` filters AnisongDB results to match AnimeThemes anime
- [x] **Title similarity verification**: Levenshtein distance ≤6 for exact match acceptance

### Performance Optimizations (Previous Session)

- [x] **convertToRawPCM**: Int16Array instead of DataView (~3x faster)
- [x] **arrayBufferToBase64**: 32KB chunks instead of 8KB
- [x] **Identification cache**: In-memory cache (max 50 entries)
- [x] **Profiling timers**: console.time/timeEnd around key operations

### Unit Tests

- [x] 25 tests passing for `normalizeTitle`, `levenshtein`, `fuzzyMatch`, `isCharacterName`, `matchesAnime`
- [x] Tests cover edge cases and title similarity thresholds

## Build Status

- ✅ TypeScript builds without errors
- ✅ All tests pass

## Known Edge Cases

- "Be a flower" → "Aku no Hana" is not correctly it should be kusuriya no hitorigoto
- Title similarity verification prevents wrong anime return (distance checks)

## Remaining Tasks

- [ ] Integration test with live audio (manual verification)
- [ ] Update README with new flow description