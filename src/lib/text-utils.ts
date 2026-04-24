/**
 * Pure text utilities for query cleaning, normalization, and fuzzy matching.
 * No API calls — only string transformations.
 */

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
    // Remove (Acoustic Version), (Acoustic), etc
    .replace(/[([]\s*[^)\]]*(?:acoustic|karaoke|remix|cover|piano|ballad|version)[^)\]]*[)\]]/gi, '')
    // Remove version/performance suffixes in brackets
    .replace(/[([]?\s*(?:\d{4}\s*remaster|remastered|single\s*version|full\s*version|short\s*version|album|edit|radio\s*edit)[^)\]]*[)\]]/gi, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lowercase + strip punctuation for comparison. */
export function normalizeTitle(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
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

/** Finds the best match from candidates by Levenshtein distance. */
export function fuzzyMatch<T extends { songName: string }>(
  candidates: T[],
  targetTitle: string,
  threshold = 5,
): T | null {
  const normalizedTarget = normalizeTitle(targetTitle);
  let bestMatch: T | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeTitle(candidate.songName);
    const distance = levenshtein(normalizedTarget, normalizedCandidate);
    if (distance < bestDistance && distance <= threshold) {
      bestDistance = distance;
      bestMatch = candidate;
    }
  }
  if (bestMatch) {
    console.log(`[MRA] Fuzzy match found: "${bestMatch.songName}" (distance: ${bestDistance})`);
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
