/**
 * AnimeThemes.moe integration — cover art fetching and song-based anime lookup.
 */

import { logger } from '../utils/logger';
import { normalizeTitle, levenshtein, fuzzyMatch } from './text-utils';
import { textToRomaji } from './romaji';

export interface AnimeData {
  title: string;
  type: string; // e.g. "OP 1", "ED 2", "Insert Song"
  url: string;
  imageUrl: string;
  overview?: string; // Description from Google AI fallback
}

interface AnimeThemesAnime {
  name: string;
  slug: string;
}

interface AnimeThemesTheme {
  type?: string;
  anime: AnimeThemesAnime;
}

interface AnimeThemesSong {
  id?: number;
  title?: string;
  animethemes?: AnimeThemesTheme[];
}

/**
 * Fetches high-quality anime cover art from AnimeThemes.moe.
 * Uses 2-step approach: general search → slug-based image lookup.
 * Tries multiple name variations (English, Japanese) for better matching.
 */
export async function fetchAnimeThemesImage(animeName: string): Promise<string | null> {
  if (!animeName) return null;

  const nameVariations = [animeName];

  // If no Japanese chars, try translating to Japanese for additional search
  if (!/[\u3040-\u30ff\u3400-\u4dbf]/.test(animeName)) {
    try {
      const res = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ja&dt=q&q=${encodeURIComponent(animeName)}`,
      );
      const data = await res.json();
      if (data?.[0]?.[0]?.[0]) {
        nameVariations.push(data[0][0][0]);
      }
    } catch {
      // Ignore translation errors
    }
  }

  for (const name of nameVariations) {
    try {
      const query = encodeURIComponent(name);

      // Step 1: General search to get candidates
      const searchRes = await fetch(`https://api.animethemes.moe/anime?q=${query}`);
      if (!searchRes.ok) continue;

      const searchData = await searchRes.json();
      const results = searchData.anime;
      if (!results || results.length === 0) continue;

      // Step 2: Find best match
      const normalizedSearch = name.toLowerCase().replace(/\s+/g, ' ').trim();
      let bestMatch = results[0];

      for (const anime of results) {
        const animeNameLower = (anime.name || '').toLowerCase();
        if (animeNameLower === normalizedSearch) {
          bestMatch = anime;
          break;
        }
        if (animeNameLower.includes(normalizedSearch) && !animeNameLower.includes(':')) {
          bestMatch = anime;
          break;
        }
      }

      if (!bestMatch?.slug) continue;

      // Step 3: Get images using slug
      const imgRes = await fetch(
        `https://api.animethemes.moe/anime?filter[slug]=${bestMatch.slug}&include=images`,
      );
      if (!imgRes.ok) continue;

      const imgData = await imgRes.json();
      const animeWithImages = imgData.anime?.[0];
      if (animeWithImages?.images?.length > 0) {
        const large = animeWithImages.images.find(
          (i: { facet: string; link: string }) => i.facet === 'Large Cover',
        );
        return large ? large.link : animeWithImages.images[0].link;
      }
    } catch (e) {
      logger.warn('Failed to fetch image from AnimeThemes:', e);
    }
  }

  return null;
}

/**
 * Song-based fallback search via AnimeThemes API.
 * Searches by song title, matches against known titles, and returns anime data.
 */
export async function searchAnimeThemesBySong(
  title: string,
  skipImage: boolean,
): Promise<AnimeData | null> {
  const fallbackRomajiTitle = await textToRomaji(title);

  let atSongs: AnimeThemesSong[] = [];

  // Search with original title
  const query = encodeURIComponent(title);
  const res = await fetch(`https://api.animethemes.moe/song?q=${query}&include=animethemes.anime`);
  if (res.ok) {
    const data = await res.json();
    atSongs = data.songs || [];
  }

  // Retry with romaji
  if (atSongs.length === 0 && fallbackRomajiTitle) {
    const queryRomaji = encodeURIComponent(fallbackRomajiTitle);
    const res2 = await fetch(
      `https://api.animethemes.moe/song?q=${queryRomaji}&include=animethemes.anime`,
    );
    if (res2.ok) {
      const data2 = await res2.json();
      atSongs = data2.songs || [];
    }
  }

  if (atSongs.length === 0) return null;

  // Match songs by title
  const targetNorm = normalizeTitle(title);

  // 1. Exact normalized match
  let candidateSong = atSongs.find(
    (s) => s.title && normalizeTitle(s.title) === targetNorm,
  );

  // 2. Partial inclusion with distance ≤4
  if (!candidateSong) {
    candidateSong = atSongs.find((s) => {
      if (!s.title) return false;
      const tNorm = normalizeTitle(s.title);
      const dist = levenshtein(tNorm, targetNorm);
      return (tNorm.includes(targetNorm) || targetNorm.includes(tNorm)) && dist <= 4;
    });
  }

  // 3. Fuzzy match (threshold 5)
  if (!candidateSong) {
    const wrapped = atSongs.map((s) => ({ ...s, songName: s.title || '' }));
    const fuzzy = fuzzyMatch(wrapped, title);
    if (fuzzy) candidateSong = fuzzy as unknown as (typeof atSongs)[0];
  }

  if (!candidateSong) {
    logger.warn('No suitable AnimeThemes song found for title:', title);
    return null;
  }

  if (!candidateSong?.animethemes?.[0]?.anime) return null;

  const theme = candidateSong.animethemes[0];
  const anime = theme.anime;
  const atSongTitle = (candidateSong as unknown as { title?: string }).title;

  return {
    title: anime.name,
    type: theme.type || 'Possible match',
    url: `https://animethemes.moe/anime/${anime.slug}`,
    imageUrl: skipImage ? '' : (await fetchAnimeThemesImage(anime.name)) || '',
    _atSongTitle: atSongTitle,
    _animeSlug: anime.slug,
    _animeName: anime.name,
  } as AnimeData & { _atSongTitle?: string; _animeSlug: string; _animeName: string };
}
