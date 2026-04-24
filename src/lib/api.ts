/**
 * API Orchestration Layer — thin wrapper that re-exports domain modules
 * and provides the main `findAnimeForTrack` orchestrator.
 *
 * All imports from the consumer's perspective remain unchanged:
 *   import { identifyTrack, findAnimeForTrack, fetchLyrics, fetchAnimeThemesImage } from './lib/api';
 */

import { logger } from '../utils/logger';
import { cleanQueryTerm } from './text-utils';
import { isCharacterName } from './text-utils';
import { multiPassSearch, rankResults, crossReferenceWithAnimeThemes } from './anisongdb';
import { fetchAnimeThemesImage, searchAnimeThemesBySong } from './animethemes';
import { findAnimeFromGoogle } from './gemini';

// ── Re-exports (backward-compatible public API) ──
export { identifyTrack } from './shazam';
export type { TrackData } from './shazam';
export { fetchAnimeThemesImage } from './animethemes';
export type { AnimeData } from './animethemes';
export { fetchLyrics } from './lyrics';

/**
 * Main orchestrator: finds anime data for a given track.
 * Search chain: AnisongDB → AnimeThemes → Google Gemini AI
 */
export async function findAnimeForTrack(
  rawTitle: string,
  rawArtist: string,
  source: 'animethemes' | 'google' = 'animethemes',
  options?: { skipImage?: boolean },
): Promise<{ title: string; type: string; url: string; imageUrl: string }[]> {
  const title = cleanQueryTerm(rawTitle);
  const artist = cleanQueryTerm(rawArtist);
  const isCharacter = isCharacterName(artist);
  const skipImage = options?.skipImage ?? false;

  logger.log(`Finding anime for: "${title}" by "${artist}" (source: ${source})`);
  if (isCharacter) {
    logger.log('Detected character name in artist field - will search primarily by title');
  }

  // Direct Google AI path
  if (source === 'google') {
    return findAnimeFromGoogle(title, artist);
  }

  const useArtistFilter = !isCharacter && artist.length > 0;

  // ── Stage 1: AnisongDB Multi-Pass Search ──
  let results: Awaited<ReturnType<typeof multiPassSearch>> = [];
  try {
    results = await multiPassSearch({ title, useArtistFilter, artist });
  } catch (err) {
    logger.error('AnisongDB failure (API may be down):', err instanceof Error ? err.message : String(err));
  }

  if (results.length > 0) {
    const bestEntry = rankResults(results, title, artist);
    logger.log('Best AnisongDB match:', bestEntry.songName, '->', bestEntry.animeJPName || bestEntry.animeENName);

    let imageUrl = bestEntry.animeImage || '';
    if (!skipImage && !imageUrl) {
      logger.log('AnisongDB missing image, trying AnimeThemes for cover...');
      const animeName = bestEntry.animeENName || bestEntry.animeJPName;
      imageUrl = animeName ? (await fetchAnimeThemesImage(animeName) ?? '') : '';
    }

    return [{
      title: bestEntry.animeJPName || bestEntry.animeENName || 'Unknown',
      type: bestEntry.songType || 'Theme',
      url: '',
      imageUrl,
    }];
  }

  // ── Stage 2: AnimeThemes Song-Based Fallback ──
  logger.log('AnisongDB found nothing, trying AnimeThemes API fallback...');
  try {
    const atResult = await searchAnimeThemesBySong(title, skipImage);
    if (atResult) {
      const extended = atResult as typeof atResult & {
        _atSongTitle?: string;
        _animeSlug: string;
        _animeName: string;
      };

      // If AnimeThemes found a different song title, cross-reference with AnisongDB
      if (extended._atSongTitle && extended._atSongTitle !== title) {
        logger.log('AnimeThemes found song, re-searching AnisongDB with official title:', extended._atSongTitle);
        const crossRef = await crossReferenceWithAnimeThemes(
          extended._atSongTitle,
          extended._animeName,
          extended._animeSlug,
          title,
          skipImage,
          fetchAnimeThemesImage,
        );
        if (crossRef) return [crossRef];
      }

      // Return the AnimeThemes result directly
      return [{
        title: atResult.title,
        type: atResult.type,
        url: atResult.url,
        imageUrl: atResult.imageUrl,
      }];
    }
  } catch (error) {
    logger.error('AnimeThemes API fallback failed:', error);
  }

  // ── Stage 3: Google Gemini AI Fallback ──
  logger.log('All primary APIs failed, trying Google AI fallback...');
  try {
    const googleResult = await findAnimeFromGoogle(title, artist);
    if (googleResult.length > 0) {
      logger.log('Google AI found:', googleResult[0].title);
      return googleResult;
    }
  } catch (error) {
    logger.error('Google AI fallback failed:', error);
  }

  return [];
}
