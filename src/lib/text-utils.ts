/**
 * Pure text utilities for query cleaning, normalization, and fuzzy matching.
 * No API calls — only string transformations.
 */

import { logger } from '../utils/logger';

/**
 * Common Japanese particles and word boundaries in Romaji.
 * These get concatenated by Shazam (e.g., "Hitominokotae")
 * but databases store them with spaces (e.g., "Hitomi no Kotae").
 *
 * Order matters — longer particles first to avoid partial matches.
 */
const ROMAJI_PARTICLES = [
  'shite', 'kara', 'made', 'dake', 'demo', 'mono', 'teki',
  'nai', 'tai', 'tte', 'shi',
  'wo', 'wa', 'no', 'ni', 'de', 'ga', 'to', 'mo', 'ka', 'he', 'yo', 'ne', 'na', 'e', 'o',
];

/**
 * Splits concatenated Romaji into spaced words by inserting spaces around
 * common Japanese particles. Handles cases like:
 *   "Hitominokotae" → "Hitomi no Kotae"
 *   "Seishunnoenbu" → "Seishun no Enbu"
 *   "Kasukadetashika" → "Kasuka de tashika"
 *   "Hanawopu-n" → "Hana wo Pu-n"  (close to "Hana o Puun")
 *
 * Returns null if no splitting was possible.
 */
export function splitRomajiParticles(title: string): string | null {
  if (!title || title.includes(' ')) return null; // Already has spaces

  const lower = title.toLowerCase();

  // Try each particle and find the best split
  for (const particle of ROMAJI_PARTICLES) {
    const idx = lower.indexOf(particle, 1); // Skip first char
    if (idx <= 0) continue;

    // Validate: the character before the particle should be a vowel or 'n' (ん in Romaji)
    const charBefore = lower[idx - 1];
    if (!'aiueon'.includes(charBefore)) continue;

    // Validate: the character after the particle should start a new syllable or be end-of-string
    const afterIdx = idx + particle.length;
    if (afterIdx < lower.length) {
      const charAfter = lower[afterIdx];
      // Must be a consonant (start of new syllable) or uppercase in original
      if ('aiueo'.includes(charAfter) && particle.length === 1) continue; // Single-char particle touching a vowel is ambiguous
    }

    // Split here
    const before = title.slice(0, idx);
    const part = title.slice(idx, idx + particle.length);
    const after = title.slice(idx + particle.length);

    // Recursively try to split the remaining part
    const splitAfter = splitRomajiParticles(after);
    const result = `${before} ${part} ${splitAfter || after}`.replace(/\s+/g, ' ').trim();

    logger.log(`Romaji particle split: "${title}" → "${result}"`);
    return result;
  }

  return null;
}

/** Strips noise from track titles/artists before querying APIs. */
export function cleanQueryTerm(str: string): string {
  if (!str) return '';
  return str
    // Remove (Live), [Live], etc.
    .replace(/[([]\s*(?:live|recorded|acoustic|live\s*version)[^)\]]*[)\]]/gi, '')
    // Remove (feat. Laco) or [feat. Laco] cleanly
    .replace(/[([]\s*[^)\]]*(?:feat\.|ft\.|featuring|cv:)[^)\]]*[)\]]/gi, '')
    // Remove - feat. Laco (no brackets)
    .replace(/-\s*(?:feat\.|ft\.|featuring|cv:).*/gi, '')
    // Remove (TV Size) or [TV Version]
    .replace(/[([]\s*[^)\]]*(?:tv\s*size|tv\s*version)[^)\]]*[)\]]/gi, '')
    // Remove (Acoustic Version), (Acoustic), (Album Mix), (Instrumental), etc.
    .replace(/[([]\s*[^)\]]*(?:acoustic|karaoke|remix|cover|piano|ballad|version|instrumental|album\s*mix|single\s*mix|original\s*mix|extended|short|full|edit|radio\s*edit|remaster(?:ed)?|off\s*vocal)[^)\]]*[)\]]/gi, '')
    // Remove version/performance suffixes WITHOUT brackets (e.g., "Title - Instrumental")
    .replace(/\s*-\s*(?:instrumental|album\s*mix|acoustic|karaoke|remix|off\s*vocal|tv\s*size)\s*$/gi, '')
    // Remove generic "with ..." patterns preceding a dash (e.g., "Artist with X - Title")
    .replace(/\s+with\s+[^-]+/gi, '')
    // Normalize fullwidth tilde ～ and wave dash 〜 to regular dash
    .replace(/[～〜]/g, '-')
    // Normalize fullwidth characters to ASCII
    .replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    // Ensure dash spacing
    .replace(/\s*-\s*/g, ' - ')
    // Remove trailing dash
    .replace(/\s*-\s*$/, '')
    // Remove leading dash
    .replace(/^\s*-\s*/, '')
    // Remove plus signs
    .replace(/\+/g, '')
    // Remove star symbols (☆, ★)
    .replace(/[☆★]/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lowercase + strip punctuation for comparison. */
export function normalizeTitle(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    // Normalize fullwidth tilde ～ and wave dash 〜 to space (so they act as word boundaries)
    .replace(/[～〜]/g, ' ')
    // Replace dashes with spaces (so 'Two souls -toward' matches 'Two souls～toward')
    .replace(/-/g, ' ')
    // Strip remaining non-word, non-space characters
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Standard Levenshtein edit distance. */
export function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Enhanced fuzzy matching that also tries particle-split variants.
 * Finds the best match from candidates by Levenshtein distance.
 */
export function fuzzyMatch<T extends { songName: string }>(
  candidates: T[],
  targetTitle: string,
  threshold = 5,
): T | null {
  const normalizedTarget = normalizeTitle(targetTitle);
  // Also try the particle-split version of the target
  const splitTarget = splitRomajiParticles(targetTitle);
  const normalizedSplitTarget = splitTarget ? normalizeTitle(splitTarget) : null;

  let bestMatch: T | null = null;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeTitle(candidate.songName);

    // Compare against original target
    let distance = levenshtein(normalizedTarget, normalizedCandidate);

    // Also compare against particle-split target and use whichever is better
    if (normalizedSplitTarget) {
      const splitDistance = levenshtein(normalizedSplitTarget, normalizedCandidate);
      distance = Math.min(distance, splitDistance);
    }

    // Also try splitting the candidate name
    const candidateSplit = splitRomajiParticles(candidate.songName);
    if (candidateSplit) {
      const normalizedCandidateSplit = normalizeTitle(candidateSplit);
      const splitDist = levenshtein(normalizedTarget, normalizedCandidateSplit);
      distance = Math.min(distance, splitDist);
      if (normalizedSplitTarget) {
        distance = Math.min(distance, levenshtein(normalizedSplitTarget, normalizedCandidateSplit));
      }
    }

    if (distance < bestDistance && distance <= threshold) {
      bestDistance = distance;
      bestMatch = candidate;
    }
  }
  if (bestMatch) {
    logger.log(`Fuzzy match found: "${bestMatch.songName}" (distance: ${bestDistance})`);
  }
  return bestMatch;
}

/** Detects if an artist name is likely a Japanese character name (not a band). */
export function isCharacterName(artist: string): boolean {
  if (!artist) return false;
  const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(artist);
  const looksLikeCharacterName = /[・丨]/.test(artist) || artist.split(' ').length <= 3;
  return hasJapanese && looksLikeCharacterName;
}
