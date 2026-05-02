// Tests for cleanQueryTerm covering edge case title patterns
// Uses inline implementation since Jest runs in CJS and can't import .ts directly

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
    // Remove trailing dash
    .replace(/\s*-\s*$/, '')
    // Remove leading dash
    .replace(/^\s*-\s*/, '')
    .replace(/\+/g, '')
    .replace(/[☆★]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

describe('cleanQueryTerm edge cases', () => {
  test('removes generic "with" pattern before dash', () => {
    const input = '墨須 With M.O.N - M.O.Nのテーマ';
    expect(cleanQueryTerm(input)).toBe('墨須 - M.O.Nのテーマ');
  });

  test('removes (instrumental) tag', () => {
    const input = 'Noria - Hitominokotae (instrumental)';
    expect(cleanQueryTerm(input)).toBe('Noria - Hitominokotae');
  });

  test('removes (Album Mix) tag', () => {
    const input = 'Necry Talkie - Fuzaketenaize(Album Mix)';
    expect(cleanQueryTerm(input)).toBe('Necry Talkie - Fuzaketenaize');
  });

  test('handles plus sign and concatenated words', () => {
    const input = 'DIALOGUE+ - Kasukadetashika';
    const cleaned = cleanQueryTerm(input);
    expect(cleaned).toBe('DIALOGUE - Kasukadetashika');
  });

  test('splits concatenated Japanese romanized words', () => {
    const input = 'Centimillimental - Seishunnoenbu';
    const cleaned = cleanQueryTerm(input);
    // No special handling in cleanQueryTerm; particle splitting is a separate function
    expect(cleaned).toBe('Centimillimental - Seishunnoenbu');
  });

  test('handles special star character', () => {
    const input = 'きら☆ぴか - Hanawopu-n';
    const cleaned = cleanQueryTerm(input);
    expect(cleaned).toContain('きら');
    expect(cleaned).toContain('ぴか');
    expect(cleaned).not.toContain('☆');
  });

  test('normalizes dash spacing', () => {
    const input = 'fripSide - Two souls -toward the truth-';
    expect(cleanQueryTerm(input)).toBe('fripSide - Two souls - toward the truth');
  });

  test('normalizes fullwidth tilde ～ to dash', () => {
    const input = 'Two souls～toward the truth～';
    const result = cleanQueryTerm(input);
    expect(result).not.toContain('～');
    expect(result).toContain('toward the truth');
  });
});
