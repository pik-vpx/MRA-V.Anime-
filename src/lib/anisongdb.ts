/**
 * AnisongDB integration — multi-pass anime song search.
 * Searches by title/artist with exact and partial matching.
 */

import { logger } from '../utils/logger';
import { normalizeTitle, fuzzyMatch, levenshtein } from './text-utils';
import { textToRomaji } from './romaji';

export interface AnisongDBResult {
  songName: string;
  songArtist: string;
  animeENName: string;
  animeJPName?: string;
  songType: string;
  animeImage?: string;
}

/** Low-level AnisongDB API call. */
export async function searchAnisongDB(body: object): Promise<AnisongDBResult[]> {
  const res = await fetch('https://anisongdb.com/api/search_request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`AnisongDB API error: ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : (data?.value || []);
}

interface SearchConfig {
  title: string;
  useArtistFilter: boolean;
  artist: string;
}

function buildSearchBody(
  config: SearchConfig,
  partial: boolean,
  titleOverride?: string,
): object {
  const songFilter = {
    search: titleOverride || config.title,
    partial_match: partial,
  };

  if (config.useArtistFilter) {
    return {
      and_logic: true,
      ignore_duplicate: true,
      opening_filter: true,
      ending_filter: true,
      insert_filter: true,
      song_name_search_filter: songFilter,
      artist_search_filter: { search: config.artist, partial_match: partial },
    };
  }

  return {
    and_logic: false,
    ignore_duplicate: true,
    opening_filter: true,
    ending_filter: true,
    insert_filter: true,
    song_name_search_filter: songFilter,
  };
}

/**
 * Multi-pass search on AnisongDB.
 * Passes: exact → romaji exact → partial → romaji partial → title-only → romaji title-only → romaji prefix
 */
export async function multiPassSearch(
  config: SearchConfig,
): Promise<AnisongDBResult[]> {
  let results: AnisongDBResult[] = [];

  // Pass 1: Exact title (+ exact artist if available)
  results = await searchAnisongDB(buildSearchBody(config, false));
  logger.log(
    `Pass 1 (exact title${config.useArtistFilter ? ' + exact artist' : ' only'}):`,
    results.length,
    'results',
  );
  if (results.length > 0) return results;

  // Pass 1.5: Romaji exact
  const romajiTitle = await textToRomaji(config.title);
  if (romajiTitle) {
    results = await searchAnisongDB(buildSearchBody(config, false, romajiTitle));
    logger.log(
      `Pass 1.5 (Romaji title${config.useArtistFilter ? ' + exact artist' : ' only'}):`,
      results.length,
      'results',
    );
    if (results.length > 0) return results;
  }

  // Pass 2: Partial title
  results = await searchAnisongDB(buildSearchBody(config, true));
  logger.log(
    `Pass 2 (partial title${config.useArtistFilter ? ' + partial artist' : ' only'}):`,
    results.length,
    'results',
  );
  if (results.length > 0) return results;

  // Pass 2.5: Romaji partial
  if (romajiTitle) {
    results = await searchAnisongDB(buildSearchBody(config, true, romajiTitle));
    logger.log(
      `Pass 2.5 (Romaji partial${config.useArtistFilter ? ' + partial artist' : ' only'}):`,
      results.length,
      'results',
    );
    if (results.length > 0) return results;
  }

  // Pass 3: Partial title only (drop artist filter)
  if (config.useArtistFilter) {
    const titleOnly = { ...config, useArtistFilter: false };
    results = await searchAnisongDB(buildSearchBody(titleOnly, true));
    logger.log('Pass 3 (partial title only):', results.length, 'results');
    if (results.length > 0) return results;
  }

  // Pass 3.5: Romaji partial title only
  if (romajiTitle) {
    results = await searchAnisongDB(
      buildSearchBody({ ...config, useArtistFilter: false }, true, romajiTitle),
    );
    logger.log('Pass 3.5 (Romaji partial title ONLY):', results.length, 'results');
    if (results.length > 0) return results;
  }

  // Pass 3.7: Romaji prefix (first 2 words)
  if (romajiTitle && romajiTitle.includes(' ')) {
    const parts = romajiTitle.split(' ');
    if (parts.length > 2) {
      const prefix = parts.slice(0, 2).join(' ');
      results = await searchAnisongDB({
        and_logic: false,
        ignore_duplicate: true,
        song_name_search_filter: { search: prefix, partial_match: true },
      });
      logger.log(`Pass 3.7 (Romaji prefix "${prefix}"):`, results.length, 'results');
    }
  }

  return results;
}

/** Scores and ranks AnisongDB results by title/artist match quality. */
export function rankResults(
  results: AnisongDBResult[],
  title: string,
  artist: string,
): AnisongDBResult {
  const titleLower = title.toLowerCase().replace(/\s+/g, ' ').trim();

  if (!artist || artist.length === 0) {
    const scored = results.map((r) => {
      const songTitle = (r.songName || '').toLowerCase();
      let score = 0;
      if (songTitle === titleLower) score = 200;
      else if (songTitle.includes(titleLower) || titleLower.includes(songTitle)) score = 50;
      return { entry: r, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].entry;
  }

  const artistLower = artist.toLowerCase().replace(/\s+/g, ' ').trim();

  const scored = results.map((r) => {
    const songArtist = (r.songArtist || '').toLowerCase();
    const songTitle = (r.songName || '').toLowerCase();

    let score = songTitle === titleLower ? 200 : 0;

    if (songArtist === artistLower) score += 150;
    else if (songArtist.includes(artistLower) || artistLower.includes(songArtist)) score += 50;
    else {
      const artistWords = artistLower.split(' ');
      const songWords = songArtist.split(' ');
      const matches = artistWords.filter(
        (w: string) =>
          w.length > 2 && songWords.some((sw: string) => sw.includes(w) || w.includes(sw)),
      );
      score += matches.length * 25;
    }

    return { entry: r, score };
  });

  const hasArtistMatch = scored.some((s) => s.score > 150);
  if (!hasArtistMatch) {
    scored.forEach((s) => {
      const songTitle = (s.entry.songName || '').toLowerCase();
      if (songTitle === titleLower) s.score += 200;
      else if (songTitle.includes(titleLower) || titleLower.includes(songTitle)) s.score += 50;
    });
  }

  scored.sort((a, b) => b.score - a.score);

  logger.log('Top 3 matches:');
  scored.slice(0, 3).forEach((s, i) => {
    logger.log(
      `  ${i + 1}. "${s.entry.songName}" by "${s.entry.songArtist}" -> ${s.entry.animeENName} (score: ${s.score})`,
    );
  });

  return scored[0].entry;
}

/** Checks if an AnisongDB result matches a given anime name. */
export function matchesAnime(entry: AnisongDBResult, animeName: string): boolean {
  const normalizedAnime = normalizeTitle(animeName);
  const entryAnime = normalizeTitle(entry.animeENName || entry.animeJPName || '');
  return !!(normalizedAnime && entryAnime && normalizedAnime === entryAnime);
}

/** Re-searches AnisongDB with an official title from AnimeThemes and matches against a known anime. */
export async function crossReferenceWithAnimeThemes(
  atSongTitle: string,
  animeName: string,
  animeSlug: string,
  originalTitle: string,
  skipImage: boolean,
  fetchImage: (name: string) => Promise<string | null>,
): Promise<{ title: string; type: string; url: string; imageUrl: string } | null> {
  // Try exact match
  let retryResults: AnisongDBResult[] = [];
  try {
    retryResults = await searchAnisongDB({
      and_logic: false,
      ignore_duplicate: true,
      opening_filter: true,
      ending_filter: true,
      insert_filter: true,
      song_name_search_filter: { search: atSongTitle, partial_match: false },
    });
  } catch {
    /* ignore API errors; fallback will be used */
  }

  const matchingAnimeResults = retryResults.filter((r) => matchesAnime(r, animeName));
  const bestAnisong = matchingAnimeResults.length > 0 ? matchingAnimeResults[0] : retryResults[0];

  if (bestAnisong) {
    const distance = levenshtein(normalizeTitle(atSongTitle), normalizeTitle(originalTitle));
    if (distance <= 6) {
      logger.log('Using AnisongDB entry aligned with AnimeThemes anime');
      const imageUrl = skipImage
        ? ''
        : bestAnisong.animeImage || (await fetchImage(animeName)) || '';
      return {
        title: bestAnisong.animeJPName || bestAnisong.animeENName || animeName,
        type: bestAnisong.songType || 'Best match',
        url: `https://animethemes.moe/anime/${animeSlug}`,
        imageUrl,
      };
    }
    logger.log('Exact title match low similarity, skipping');
  }

  // Fuzzy fallback
  logger.log('Exact match failed, trying fuzzy match:', atSongTitle);
  try {
    const fuzzyCandidates = await searchAnisongDB({
      and_logic: false,
      ignore_duplicate: true,
      opening_filter: true,
      ending_filter: true,
      insert_filter: true,
      song_name_search_filter: { search: atSongTitle, partial_match: true },
    });
    if (fuzzyCandidates.length > 0) {
      const matched = fuzzyMatch(fuzzyCandidates, atSongTitle);
      if (matched) {
        const fuzzyDist = levenshtein(normalizeTitle(atSongTitle), normalizeTitle(matched.songName || ''));
        if (fuzzyDist <= 8) {
          logger.log('Fuzzy match success');
          const imgUrl = skipImage
            ? ''
            : matched.animeImage ||
              (await fetchImage(matched.animeENName || matched.animeJPName || animeName)) ||
              '';
          return {
            title: matched.animeJPName || matched.animeENName || animeName,
            type: matched.songType || 'Best match',
            url: `https://animethemes.moe/anime/${animeSlug}`,
            imageUrl: imgUrl,
          };
        }
      }
    }
  } catch (e) {
    logger.warn('Fuzzy match fallback failed:', e);
  }

  return null;
}
