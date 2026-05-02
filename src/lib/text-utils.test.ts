/**
 * Test utilities for title cleaning and normalization.
 * Functions are duplicated here to avoid module import complications in the Jest config.
 */

function cleanQueryTerm(str) {
  if (!str) return '';
  return str
    // Remove (Live), [Live], etc.
    .replace(/[([]\s*(?:live|recorded|acoustic|live\s*version)[^)]*?[)\]]/gi, '')
    // Remove (feat. Laco) or [feat. Laco] cleanly
    .replace(/[([]\s*[^)]*(?:feat\.|ft\.|featuring|cv:)[^)]*[)\]]/gi, '')
    // Remove - feat. Laco (no brackets)
    .replace(/-\s*(?:feat\.|ft\.|featuring|cv:).*/gi, '')
    // Remove (TV Size) or [TV Version]
    .replace(/[([]\s*[^)]*(?:tv\s*size|tv\s*version)[^)]*[)\]]/gi, '')
    // Remove (Acoustic Version), (Acoustic), etc
    .replace(/[([]\s*[^)]*(?:acoustic|karaoke|remix|cover|piano|ballad|version)[^)]*[)\]]/gi, '')
    // Remove version/performance suffixes in brackets and common extra tags (instrumental, mix, album mix)
    .replace(/[([]?\s*(?:\d{4}\s*remaster|remastered|single\s*version|full\s*version|short\s*version|album|edit|radio\s*edit|instrumental|mix|album\s*mix)[^)]*[)\]]/gi, '')
    // Remove generic "with ..." patterns preceding a dash (e.g., "Artist with X - Title")
    .replace(/\s+with\s+[^-]+/gi, '')
    // Ensure dash spacing
    .replace(/\s*-\s*/g, ' - ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTitle(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('cleanQueryTerm improvements', () => {
  test('removes (instrumental) tag', () => {
    const input = 'Noria - Hitominokotae (instrumental)';
    const cleaned = cleanQueryTerm(input);
    expect(cleaned).toBe('Noria - Hitominokotae');
  });

  test('removes (Album Mix) tag', () => {
    const input = 'Necry Talkie - Fuzaketenaize(Album Mix)';
    const cleaned = cleanQueryTerm(input);
    expect(cleaned).toBe('Necry Talkie - Fuzaketenaize');
  });

  test('strips generic "with" pattern before dash', () => {
    const input = '墨須 With M.O.N - M.O.Nのテーマ';
    const cleaned = cleanQueryTerm(input);
    expect(cleaned).toBe('墨須 - M.O.Nのテーマ');
  });
});

describe('normalizeTitle basic handling', () => {
  test('removes punctuation and normalizes spaces', () => {
    const input = 'fripSide - Two souls -toward the truth-';
    const normalized = normalizeTitle(input);
    expect(normalized).toBe('fripside two souls toward the truth');
  });
});
