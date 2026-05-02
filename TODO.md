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

- [x] Integration test with live audio (manual verification)
- [x] Update README with new flow description
- [ ] issue of name from song title 墨須 With M.O.N - M.O.Nのテーマ but on database song name and artist is Hey! Smith!!  • Smith with M.O.N : need to check this 
- [x] song name like Noria - Hitominokotae (instrumental) but pattern like on all website database is Hitomi no Kotae → **Fixed: `splitRomajiParticles()` + `cleanQueryTerm()` strips `(instrumental)`**
- [x] song name like DIALOGUE+ - Kasukadetashika but pattern like on all website database is Kasuka de tashika → **Fixed: `splitRomajiParticles()` inserts spaces at particle boundaries**
- [x] Necry Talkie - Fuzaketenaize(Album Mix) delete (Album Mix) from song name → **Fixed: `cleanQueryTerm()` now strips `(Album Mix)`**
- [x] きら☆ぴか - Hanawopu-n but in database song name is Hana o Puun → **Fixed: `splitRomajiParticles()` handles `wo` particle**
- [x] fripSide - Two souls -toward the truth- but in database song name is Two souls～toward the truth～ → **Fixed: `normalizeTitle()` normalizes both `～` and `-` to spaces**
- [x] Centimillimental - Seishunnoenbu but in database song name is Seishun no Enbu → **Fixed: `splitRomajiParticles()` allows `n` (ん) as particle boundary**

