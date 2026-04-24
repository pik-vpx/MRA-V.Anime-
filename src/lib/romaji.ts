/**
 * Japanese → Romaji translation via Google Translate's free API.
 * Crucial because Shazam returns Kanji while AnisongDB stores Romaji.
 */

import { logger } from '../utils/logger';

const JAPANESE_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/;
const JAPANESE_BLOCK_REGEX = /([\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+)/;

/**
 * Translates Japanese text to Romaji. Mixed-script strings are handled
 * segment-by-segment — Japanese blocks are translated while Latin text is preserved.
 * Returns null if the input contains no Japanese characters.
 */
export async function textToRomaji(text: string): Promise<string | null> {
  if (!JAPANESE_REGEX.test(text)) return null;

  try {
    const segments = text.split(JAPANESE_BLOCK_REGEX);
    const convertedSegments = await Promise.all(
      segments.map(async (seg) => {
        if (!JAPANESE_REGEX.test(seg)) return seg;

        const res = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=rm&q=${encodeURIComponent(seg)}`,
        );
        const data = await res.json();
        if (data?.[0]?.[0]?.[3]) {
          const romaji: string = data[0][0][3];
          const macronMap: Record<string, string> = {
            'ā': 'aa', 'ē': 'ee', 'ī': 'ii', 'ō': 'ou', 'ū': 'uu',
            'Ā': 'Aa', 'Ē': 'Ee', 'Ī': 'Ii', 'Ō': 'Ou', 'Ū': 'Uu',
          };
          return romaji
            .replace(/[āēīōūĀĒĪŌŪ]/g, (m) => macronMap[m] || m)
            .replace(/~/g, '');
        }
        return seg;
      }),
    );

    const finalRomaji = convertedSegments.join(' ').replace(/\s+/g, ' ').trim();
    logger.log(`Mixed-Script Translation: "${text}" -> "${finalRomaji}"`);
    return finalRomaji;
  } catch (err) {
    logger.warn('Multi-segment translation failed:', err);
  }
  return null;
}
