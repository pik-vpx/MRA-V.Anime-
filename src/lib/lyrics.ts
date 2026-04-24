/**
 * Lyrics fetching via Lrclib API.
 */

/** Fetches plain lyrics for a given track title and artist. */
export async function fetchLyrics(title: string, artist: string): Promise<string> {
  try {
    const url = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
    const res = await fetch(url);
    if (!res.ok) return 'Lyrics not found.';
    const data = await res.json();
    if (data?.length > 0) {
      return data[0].plainLyrics || 'Lyrics not found.';
    }
    return 'Lyrics not found.';
  } catch {
    return 'Could not fetch lyrics.';
  }
}
