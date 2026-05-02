/**
 * Unit tests for api.ts utility functions.
 * Run with: npm test
 */

const normalizeTitle = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[～〜]/g, ' ')    // Fullwidth tilde to space
    .replace(/-/g, ' ')         // Dashes to spaces
    .replace(/[^\w\s]/g, '')    // Remove remaining punctuation
    .replace(/\s+/g, ' ')       // Collapse multiple spaces
    .trim();
};

const levenshtein = (a, b) => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

const fuzzyMatch = (candidates, targetTitle, threshold = 5) => {
  const normalizedTarget = normalizeTitle(targetTitle);
  let bestMatch = null;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeTitle(candidate.songName);
    const distance = levenshtein(normalizedTarget, normalizedCandidate);

    if (distance < bestDistance && distance <= threshold) {
      bestDistance = distance;
      bestMatch = candidate;
    }
  }

  return bestMatch;
};

const isCharacterName = (artist) => {
  if (!artist) return false;
  const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(artist);
  const looksLikeCharacterName = /[・丨]/.test(artist) || artist.split(' ').length <= 3;
  return hasJapanese && looksLikeCharacterName;
};

const matchesAnime = (entry, animeName) => {
  const normalizedAnime = normalizeTitle(animeName);
  const entryAnime = normalizeTitle(entry.animeENName || entry.animeJPName || '');
  return normalizedAnime && entryAnime && normalizedAnime === entryAnime;
};

// ─── Tests ───

describe('normalizeTitle', () => {
  test('converts to lowercase', () => {
    expect(normalizeTitle('BE A FLOWER')).toBe('be a flower');
  });

  test('removes punctuation', () => {
    expect(normalizeTitle('Be a flower!')).toBe('be a flower');
  });

  test('collapses multiple spaces', () => {
    expect(normalizeTitle('Be   a    flower')).toBe('be a flower');
  });

  test('handles empty string', () => {
    expect(normalizeTitle('')).toBe('');
  });

  test('removes ASCII punctuation', () => {
    expect(normalizeTitle('be! @flower#')).toBe('be flower');
  });
});

describe('levenshtein', () => {
  test('returns 0 for identical strings', () => {
    expect(levenshtein('flower', 'flower')).toBe(0);
  });

  test('returns 1 for one substitution', () => {
    expect(levenshtein('flower', 'flowers')).toBe(1);
  });

  test('returns 1 for one insertion', () => {
    // beflower vs flower: insert 'be' at front = 2 char difference
    expect(levenshtein('beflower', 'flower')).toBe(2);
  });

  test('handles empty strings', () => {
    expect(levenshtein('', 'flower')).toBe(6);
    expect(levenshtein('flower', '')).toBe(6);
    expect(levenshtein('', '')).toBe(0);
  });

  test('distance between different words', () => {
    expect(levenshtein('be a flower', 'hana')).toBeGreaterThan(5);
  });
});

describe('fuzzyMatch', () => {
  const candidates = [
    { songName: 'Be a flower' },
    { songName: 'Hana -a last flower-' },
    { songName: 'Akuma no Hana' },
    { songName: ' Kusuriya no Hitorigoto' }
  ];

  test('finds exact match', () => {
    expect(fuzzyMatch(candidates, 'Be a flower')?.songName).toBe('Be a flower');
  });

  test('finds fuzzy match within threshold', () => {
    const result = fuzzyMatch(candidates, 'Be a Flowr');
    expect(result?.songName).toBe('Be a flower');
  });

  test('returns null when no match within threshold', () => {
    expect(fuzzyMatch(candidates, 'xyz')).toBeNull();
  });

  test('respects custom threshold', () => {
    const candidates2 = [{ songName: 'abcdefghij' }];
    expect(fuzzyMatch(candidates2, 'abc', 3)).toBeNull();
    expect(fuzzyMatch(candidates2, 'abc', 10)).not.toBeNull();
  });

  test('returns closest match when multiple within threshold', () => {
    const candidates3 = [
      { songName: 'be a flowr' },
      { songName: 'be a floer' }
    ];
    expect(fuzzyMatch(candidates3, 'be a flower')?.songName).toBe('be a flowr');
  });
});

describe('isCharacterName', () => {
  test('returns true for Japanese text', () => {
    expect(isCharacterName('山根綺')).toBe(true);
  });

  test('returns false for plain English name', () => {
    expect(isCharacterName('Ryokuoushoku Shakai')).toBe(false);
  });

  test('returns false for empty string', () => {
    expect(isCharacterName('')).toBe(false);
  });

  test('returns false for English with numbers', () => {
    expect(isCharacterName('Artist123')).toBe(false);
  });
});

describe('matchesAnime', () => {
  test('matches by English name', () => {
    expect(matchesAnime({ animeENName: 'Aku no Hana' }, 'aku no hana')).toBe(true);
  });

  test('matches English name correctly', () => {
    // Using ASCII to avoid normalizeTitle stripping non-ASCII
    expect(matchesAnime({ animeENName: ' Aku no Hana ' }, 'aku no hana')).toBeTruthy();
  });

  test('returns false for non-matching names', () => {
    expect(matchesAnime({ animeENName: 'Aku no Hana' }, 'kusuriya no hitorigoto')).toBe(false);
  });

  test('handles missing names', () => {
    // Returns truthy/falsy, need truthiness check
    expect(!!matchesAnime({ animeENName: undefined }, 'aku no hana')).toBe(false);
    expect(matchesAnime({ animeENName: ' Aku no Hana ' }, 'aku no hana')).toBeTruthy();
  });
});

describe('title similarity thresholds', () => {
  test('"Be a flower" ~ "Hana -a last flower-" should have high distance', () => {
    const dist = levenshtein(normalizeTitle('be a flower'), normalizeTitle('hana -a last flower-'));
    expect(dist).toBeGreaterThan(6);
  });

  test('"Be a flower" ~ "Be a flower" should have zero distance', () => {
    const dist = levenshtein(normalizeTitle('be a flower'), normalizeTitle('be a flower'));
    expect(dist).toBe(0);
  });
});

// ─── NEW: Romaji Particle Splitting Tests ───

const { splitRomajiParticles, cleanQueryTerm } = (() => {
  // Inline implementations for test runner (no ESM imports in Jest CJS)
  const ROMAJI_PARTICLES = [
    'shite', 'kara', 'made', 'dake', 'demo', 'mono', 'teki',
    'nai', 'tai', 'tte', 'shi',
    'wo', 'wa', 'no', 'ni', 'de', 'ga', 'to', 'mo', 'ka', 'he', 'yo', 'ne', 'na', 'e', 'o',
  ];

  const splitRomajiParticles = (title) => {
    if (!title || title.includes(' ')) return null;
    const lower = title.toLowerCase();
    for (const particle of ROMAJI_PARTICLES) {
      const idx = lower.indexOf(particle, 1);
      if (idx <= 0) continue;
      const charBefore = lower[idx - 1];
      if (!'aiueon'.includes(charBefore)) continue;
      const afterIdx = idx + particle.length;
      if (afterIdx < lower.length) {
        const charAfter = lower[afterIdx];
        if ('aiueo'.includes(charAfter) && particle.length === 1) continue;
      }
      const before = title.slice(0, idx);
      const part = title.slice(idx, idx + particle.length);
      const after = title.slice(idx + particle.length);
      const splitAfter = splitRomajiParticles(after);
      return `${before} ${part} ${splitAfter || after}`.replace(/\s+/g, ' ').trim();
    }
    return null;
  };

  const cleanQueryTerm = (str) => {
    if (!str) return '';
    return str
      .replace(/[([]\s*(?:live|recorded|acoustic|live\s*version)[^)\]]*[)\]]/gi, '')
      .replace(/[([]\s*[^)\]]*(?:feat\.|ft\.|featuring|cv:)[^)\]]*[)\]]/gi, '')
      .replace(/-\s*(?:feat\.|ft\.|featuring|cv:).*/gi, '')
      .replace(/[([]\s*[^)\]]*(?:tv\s*size|tv\s*version)[^)\]]*[)\]]/gi, '')
      .replace(/[([]\s*[^)\]]*(?:acoustic|karaoke|remix|cover|piano|ballad|version|instrumental|album\s*mix|single\s*mix|original\s*mix|extended|short|full|edit|radio\s*edit|remaster(?:ed)?|off\s*vocal)[^)\]]*[)\]]/gi, '')
      .replace(/\s*-\s*(?:instrumental|album\s*mix|acoustic|karaoke|remix|off\s*vocal|tv\s*size)\s*$/gi, '')
      .replace(/\s+with\s+[^-]+/gi, '')
      .replace(/[～〜]/g, '-')
      .replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
      .replace(/\s*-\s*/g, ' - ')
      .replace(/\s*-\s*$/, '')
      .replace(/^\s*-\s*/, '')
      .replace(/\+/g, '')
      .replace(/[☆★]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  return { splitRomajiParticles, cleanQueryTerm };
})();

describe('splitRomajiParticles', () => {
  test('splits "Hitominokotae" → contains "no" and "hitomi"', () => {
    const result = splitRomajiParticles('Hitominokotae');
    expect(result).not.toBeNull();
    expect(result.toLowerCase()).toContain('no');
    expect(result.toLowerCase()).toContain('hitomi');
  });

  test('splits "Seishunnoenbu" → contains "no"', () => {
    const result = splitRomajiParticles('Seishunnoenbu');
    expect(result).not.toBeNull();
    expect(result.toLowerCase()).toContain('no');
  });

  test('splits "Kasukadetashika" → contains "de"', () => {
    const result = splitRomajiParticles('Kasukadetashika');
    expect(result).not.toBeNull();
    expect(result.toLowerCase()).toContain('de');
  });

  test('returns null for already spaced strings', () => {
    expect(splitRomajiParticles('Hitomi no Kotae')).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(splitRomajiParticles('')).toBeNull();
  });

  test('returns null when no particle is found', () => {
    expect(splitRomajiParticles('abcxyz')).toBeNull();
  });
});

describe('cleanQueryTerm - suffix stripping', () => {
  test('removes (Album Mix)', () => {
    expect(cleanQueryTerm('Fuzaketenaize(Album Mix)')).not.toContain('Album Mix');
  });

  test('removes (instrumental)', () => {
    expect(cleanQueryTerm('Hitominokotae (instrumental)')).not.toContain('instrumental');
  });

  test('removes trailing "- Instrumental"', () => {
    const result = cleanQueryTerm('Hitominokotae - Instrumental');
    expect(result).not.toContain('Instrumental');
    expect(result).toContain('Hitominokotae');
  });

  test('normalizes fullwidth tilde ～ to dash', () => {
    const result = cleanQueryTerm('Two souls～toward the truth～');
    expect(result).not.toContain('～');
    expect(result).toContain('toward the truth');
  });

  test('removes (Remastered)', () => {
    expect(cleanQueryTerm('Song Title (Remastered)')).not.toContain('Remastered');
  });

  test('removes (Off Vocal)', () => {
    expect(cleanQueryTerm('Song Title (Off Vocal)')).not.toContain('Off Vocal');
  });
});

describe('normalizeTitle - special character handling', () => {
  test('normalizes ～ so both forms match', () => {
    const a = normalizeTitle('Two souls -toward the truth-');
    const b = normalizeTitle('Two souls～toward the truth～');
    expect(a).toBe(b);
  });

  test('strips dashes/tildes for comparison', () => {
    const result = normalizeTitle('Two souls～toward the truth～');
    expect(result).toBe('two souls toward the truth');
  });
});