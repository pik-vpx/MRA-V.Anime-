const SHAZAM_API_KEY = 'fa9c751102msh171cea5ecf9d4dep14432bjsnc25fdafbbeab';

export interface TrackData {
  title: string;
  artist: string;
  album: string;
  genre: string;
  releaseDate: string;
  cover: string;
  spotify: string;
  appleMusic: string;
  lyrics: string;
}

export interface AnimeData {
  title: string;
  type: string; // e.g. "OP 1", "ED 2", "Insert Song"
  url: string;
  imageUrl: string;
  overview?: string; // Description from Google AI fallback
}

interface ShazamMeta {
  title: string;
  text: string;
}

interface ShazamProvider {
  type: string;
  actions?: Array<{ uri: string }>;
}

interface ShazamSection {
  type: string;
  text?: string[];
}

// 1. RapidAPI Shazam Integration
// Shazam requires raw PCM: 44100 Hz, 16-bit signed LE, mono
async function convertToRawPCM(audioBlob: Blob): Promise<ArrayBuffer> {
  const audioCtx = new AudioContext({ sampleRate: 44100 });
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // Mix down to mono
  const monoData = audioBuffer.getChannelData(0);

  // Take at most 5 seconds
  const maxSamples = Math.min(monoData.length, 44100 * 5);

  // Convert float32 [-1, 1] to int16 PCM
  const pcmBuffer = new ArrayBuffer(maxSamples * 2);
  const pcmView = new DataView(pcmBuffer);
  for (let i = 0; i < maxSamples; i++) {
    let sample = monoData[i];
    sample = Math.max(-1, Math.min(1, sample));
    pcmView.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true); // little-endian
  }

  await audioCtx.close();
  return pcmBuffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function identifyTrack(audioBlob: Blob, _signal?: AbortSignal): Promise<TrackData | null> {
  try {
    console.log('[MRA] Starting audio identification, blob size:', audioBlob.size, 'type:', audioBlob.type);

    // Convert to raw PCM 44100Hz 16-bit mono
    const pcmBuffer = await convertToRawPCM(audioBlob);
    console.log('[MRA] PCM buffer size:', pcmBuffer.byteLength);

    // Convert to base64
    const base64Audio = arrayBufferToBase64(pcmBuffer);
    console.log('[MRA] Base64 length:', base64Audio.length);

    const res = await fetch('https://shazam.p.rapidapi.com/songs/v2/detect?timezone=America%2FChicago&locale=en-US', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        'X-RapidAPI-Key': SHAZAM_API_KEY,
        'X-RapidAPI-Host': 'shazam.p.rapidapi.com'
      },
      body: base64Audio
    });

    const data = await res.json();
    console.log('[MRA] Shazam response:', JSON.stringify(data).slice(0, 500));

    if (data && data.track) {
      const metadata = data.track.sections?.[0]?.metadata || [];
      const findMeta = (key: string) => metadata.find((m: ShazamMeta) => m.title === key)?.text || '';

      return {
        title: data.track.title,
        artist: data.track.subtitle,
        album: findMeta('Album') || 'Unknown Album',
        genre: data.track.genres?.primary || findMeta('Genre') || 'Unknown',
        releaseDate: findMeta('Released') || findMeta('Year') || 'Unknown',
        cover: data.track.images?.coverarthq || data.track.images?.coverart || '',
        spotify: data.track.hub?.providers?.find((p: ShazamProvider) => p.type === 'SPOTIFY')?.actions?.[0]?.uri || '#',
        appleMusic: data.track.url || '#',
        lyrics: data.track.sections?.find((s: ShazamSection) => s.type === 'LYRICS')?.text?.join('\n') || 'Lyrics not found.'
      };
    }

    // Log why it failed
    if (data && data.matches && data.matches.length === 0) {
      console.warn('[MRA] Shazam returned no matches for this audio snippet.');
    }

    return null;
  } catch (error) {
    console.error("[MRA] Shazam Error:", error);
    return null;
  }
}

// 2. Anime Theme Matcher
// Strategy: 3-pass search on AnisongDB for accuracy, fallback to Jikan
interface AnisongDBResult {
  songName: string;
  songArtist: string;
  animeENName: string;
  animeJPName?: string;
  songType: string;
  animeImage?: string;
}

async function searchAnisongDB(body: object): Promise<AnisongDBResult[]> {
  const res = await fetch('https://anisongdb.com/api/search_request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`AnisongDB API error: ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Fetches high-quality anime cover art from AnimeThemes.moe
 * Uses 2-step approach: general search to find best match, then slug-based image lookup
 * Tries multiple name variations (English, Romaji, Japanese) for better matching
 */
async function fetchAnimeThemesImage(animeName: string): Promise<string | null> {
  if (!animeName) return null;

  // Try multiple name variations
  const nameVariations = [animeName];

  // If the name looks like English (no Japanese chars), try to get romaji
  if (!/[\u3040-\u30ff\u3400-\u4dbf]/.test(animeName)) {
    try {
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ja&dt=q&q=${encodeURIComponent(animeName)}`);
      const data = await res.json();
      if (data?.[0]?.[0]?.[0]) {
        nameVariations.push(data[0][0][0]); // Add Japanese name
      }
    } catch {
      // Ignore translation errors
    }
  }

  for (const name of nameVariations) {
    try {
      const query = encodeURIComponent(name);

      // Step 1: General search (?q=) to get multiple results
      const searchRes = await fetch(`https://api.animethemes.moe/anime?q=${query}`);
      if (!searchRes.ok) continue;

      const searchData = await searchRes.json();
      const results = searchData.anime;
      if (!results || results.length === 0) continue;

      // Step 2: Find best match by comparing names
      const normalizedSearch = name.toLowerCase().replace(/\s+/g, ' ').trim();

      let bestMatch = results[0];

      for (const anime of results) {
        const animeNameLower = (anime.name || '').toLowerCase();

        // Exact match
        if (animeNameLower === normalizedSearch) {
          bestMatch = anime;
          break;
        }
        // Contains the search term and is a primary title
        if (animeNameLower.includes(normalizedSearch) && !animeNameLower.includes(':')) {
          bestMatch = anime;
          break;
        }
      }

      if (!bestMatch?.slug) continue;

      // Step 3: Get images using slug (reliable)
      const imgRes = await fetch(`https://api.animethemes.moe/anime?filter[slug]=${bestMatch.slug}&include=images`);
      if (!imgRes.ok) continue;

      const imgData = await imgRes.json();
      const animeWithImages = imgData.anime?.[0];
      if (animeWithImages?.images?.length > 0) {
        const large = animeWithImages.images.find((i: { facet: string; link: string }) => i.facet === 'Large Cover');
        return large ? large.link : animeWithImages.images[0].link;
      }
    } catch (e) {
      console.warn('[MRA] Failed to fetch image from AnimeThemes:', e);
    }
  }

  return null;
}

function cleanQueryTerm(str: string): string {
  if (!str) return '';
  return str
    // Remove (feat. Laco) or [feat. Laco] cleanly by matching everything inside the brackets
    .replace(/[([][^)\]]*(?:feat\.|ft\.|featuring|cv:)[^)\]]*[)\]]/gi, '')
    // Remove - feat. Laco (no brackets)
    .replace(/-\s*(?:feat\.|ft\.|featuring|cv:).*/gi, '')
    // Remove (TV Size) or [TV Version] cleanly
    .replace(/[([][^)\]]*(?:tv\s*size|tv\s*version)[^)\]]*[)\]]/gi, '')
    // Remove (Acoustic Version), (Acoustic), etc
    .replace(/[([][^)\]]*(?:acoustic|karaoke|remix|cover|piano|ballad|version)[^)\]]*[)\]]/gi, '')
    // Remove multiple spaces left behind
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Translates Japanese text to Romaji using Google Translate's free API.
 * This is crucial because Shazam often returns strict Kanji (e.g., "灯火")
 * while AnisongDB stores names in Romaji (e.g., "Tomoshibi").
 */
async function textToRomaji(text: string): Promise<string | null> {
  // Check if string has any Japanese characters. If not, return as-is.
  if (!/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) return null;

  try {
    // Regex to split by Japanese character blocks vs everything else
    // This allows us to translate Japanese words but KEEP English words exactly as they are.
    const segments = text.split(/([\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+)/);
    const convertedSegments = await Promise.all(segments.map(async (seg) => {
      // If segment contains Japanese, translate it
      if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(seg)) {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=rm&q=${encodeURIComponent(seg)}`);
        const data = await res.json();
        if (data && data[0] && data[0][0] && data[0][0][3]) {
          const romaji = data[0][0][3];
          // Normalize macrons
          const macronMap: { [key: string]: string } = {
            'ā': 'aa', 'ē': 'ee', 'ī': 'ii', 'ō': 'ou', 'ū': 'uu',
            'Ā': 'Aa', 'Ē': 'Ee', 'Ī': 'Ii', 'Ō': 'Ou', 'Ū': 'Uu'
          };
          return romaji.replace(/[āēīōūĀĒĪŌŪ]/g, (match: string) => macronMap[match] || match).replace(/~/g, '');
        }
        return seg;
      }
      // If Latin/English, return as-is
      return seg;
    }));

    const finalRomaji = convertedSegments.join(' ').replace(/\s+/g, ' ').trim();
    console.log(`[MRA] Mixed-Script Translation: "${text}" -> "${finalRomaji}"`);
    return finalRomaji;
  } catch (err) {
    console.warn("[MRA] Multi-segment translation failed:", err);
  }
  return null;
}

export async function findAnimeForTrack(rawTitle: string, rawArtist: string, source: 'animethemes' | 'google' = 'animethemes'): Promise<AnimeData[]> {
  const title = cleanQueryTerm(rawTitle);
  const artist = cleanQueryTerm(rawArtist);

  console.log(`[MRA] Finding anime for: "${title}" by "${artist}" (source: ${source})`);

  // Use Google AI if selected
  if (source === 'google') {
    return findAnimeFromGoogle(title, artist);
  }

  let results: AnisongDBResult[] = [];
  try {
    // ── Pass 1: Exact match on both song title AND artist ──
    results = await searchAnisongDB({
      and_logic: true,
      ignore_duplicate: true,
      opening_filter: true,
      ending_filter: true,
      insert_filter: true,
      song_name_search_filter: { search: title, partial_match: false },
      artist_search_filter: { search: artist, partial_match: false }
    });
    console.log('[MRA] Pass 1 (exact title + exact artist):', results.length, 'results');

    // ── Pass 1.5 (Romaji Fallback): If Japanese text, translate to Romaji and try Pass 1 again ──
    const romajiTitle = await textToRomaji(title);
    if (results.length === 0 && romajiTitle) {
      results = await searchAnisongDB({
        and_logic: true,
        ignore_duplicate: true,
        song_name_search_filter: { search: romajiTitle, partial_match: false },
        artist_search_filter: { search: artist, partial_match: false }
      });
      console.log('[MRA] Pass 1.5 (Romaji translated title + exact artist):', results.length, 'results');
    }

    // ── Pass 2: Partial song title AND partial artist ──
    if (results.length === 0) {
      results = await searchAnisongDB({
        and_logic: true,
        ignore_duplicate: true,
        opening_filter: true,
        ending_filter: true,
        insert_filter: true,
        song_name_search_filter: { search: title, partial_match: true },
        artist_search_filter: { search: artist, partial_match: true }
      });
      console.log('[MRA] Pass 2 (partial title + partial artist):', results.length, 'results');
    }

    // ── Pass 2.5 (Romaji Fallback) ──
    if (results.length === 0 && romajiTitle) {
      results = await searchAnisongDB({
        and_logic: true,
        ignore_duplicate: true,
        opening_filter: true,
        ending_filter: true,
        insert_filter: true,
        song_name_search_filter: { search: romajiTitle, partial_match: true },
        artist_search_filter: { search: artist, partial_match: true }
      });
      console.log('[MRA] Pass 2.5 (Romaji translated title + partial artist):', results.length, 'results');
    }

    // ── Pass 3: Partial song title only ──
    if (results.length === 0) {
      results = await searchAnisongDB({
        and_logic: false,
        ignore_duplicate: true,
        opening_filter: true,
        ending_filter: true,
        insert_filter: true,
        song_name_search_filter: { search: title, partial_match: true }
      });
      console.log('[MRA] Pass 3 (partial title only):', results.length, 'results');
    }

    // ── Pass 3.5 (Romaji Fallback) ──
    if (results.length === 0 && romajiTitle) {
      results = await searchAnisongDB({
        and_logic: false,
        ignore_duplicate: true,
        opening_filter: true,
        ending_filter: true,
        insert_filter: true,
        song_name_search_filter: { search: romajiTitle, partial_match: true }
      });
      console.log('[MRA] Pass 3.5 (Romaji partial title ONLY):', results.length, 'results');
    }

    // ── Pass 3.7 (Romaji Prefix) ──
    if (results.length === 0 && romajiTitle && romajiTitle.includes(' ')) {
      const parts = romajiTitle.split(' ');
      if (parts.length > 2) {
        const prefix = parts.slice(0, 2).join(' ');
        results = await searchAnisongDB({
          and_logic: false,
          ignore_duplicate: true,
          song_name_search_filter: { search: prefix, partial_match: true }
        });
        console.log(`[MRA] Pass 3.7 (Romaji prefix "${prefix}"):`, results.length, 'results');
      }
    }
  } catch (err) {
    console.error('[MRA] AnisongDB failure (API may be down):', err instanceof Error ? err.message : String(err));
    // Move on to fallback
  }

  // Pick the best match from results
  if (results.length > 0) {
    const titleLower = title.toLowerCase().replace(/\s+/g, ' ').trim();

    // Filter and rank by artist similarity if artist is provided
    let bestEntry = results[0];
    if (artist && artist.length > 0) {
      const artistLower = artist.toLowerCase().replace(/\s+/g, ' ').trim();

      // Score each result by artist match quality
      const scored = results.map((r: AnisongDBResult) => {
        const songArtist = (r.songArtist || '').toLowerCase();
        const songTitle = (r.songName || '').toLowerCase();

        // Start with title exact match bonus (200 points - higher priority for anime songs)
        let score = songTitle === titleLower ? 200 : 0;

        // Exact artist match = 150 points (only if exact match)
        if (songArtist === artistLower) score += 150;
        // Artist contains search term or vice versa = 50 points
        else if (songArtist.includes(artistLower) || artistLower.includes(songArtist)) score += 50;
        // Partial word match = 25 points
        else {
          const artistWords = artistLower.split(' ');
          const songWords = songArtist.split(' ');
          const matches = artistWords.filter((w: string) => w.length > 2 && songWords.some((sw: string) => sw.includes(w) || w.includes(sw)));
          score += matches.length * 25;
        }

        return { entry: r, score };
      });

      // Check if ANY result has artist match
      const hasArtistMatch = scored.some(s => s.score > 150); // >150 means has artist points

      // If no artist matches any result, prioritize exact title match
      if (!hasArtistMatch) {
        scored.forEach(s => {
          const songTitle = (s.entry.songName || '').toLowerCase();
          // Exact title match gets huge bonus, partial gets smaller
          if (songTitle === titleLower) s.score += 200;
          else if (songTitle.includes(titleLower) || titleLower.includes(songTitle)) s.score += 50;
        });
      }

      // Sort by score descending
      scored.sort((a, b) => b.score - a.score);

      // Log top 3 for debugging
      console.log('[MRA] Top 3 matches:');
      scored.slice(0, 3).forEach((s, i) => {
        console.log(`  ${i + 1}. "${s.entry.songName}" by "${s.entry.songArtist}" -> ${s.entry.animeENName} (score: ${s.score})`);
      });

      bestEntry = scored[0].entry;
    } else {
      // No artist provided, but still prioritize exact title match
      const titleLower = title.toLowerCase().replace(/\s+/g, ' ').trim();
      const scored = results.map((r: any) => {
        const songTitle = (r.songName || '').toLowerCase();
        let score = 0;
        // Exact title match gets huge bonus
        if (songTitle === titleLower) score = 200;
        // Partial title match
        else if (songTitle.includes(titleLower) || titleLower.includes(songTitle)) score = 50;
        return { entry: r, score };
      });
      scored.sort((a, b) => b.score - a.score);
      bestEntry = scored[0].entry;
    }

    console.log('[MRA] Best AnisongDB match:', bestEntry.songName, '->', bestEntry.animeJPName || bestEntry.animeENName);

    let imageUrl = bestEntry.animeImage || '';

    // IMAGE FALLBACK: If AnisongDB result has no image, try fetching from AnimeThemes
    if (!imageUrl) {
      console.log('[MRA] AnisongDB missing image, trying AnimeThemes for cover...');
      const animeName = bestEntry.animeENName || bestEntry.animeJPName;
      imageUrl = animeName ? (await fetchAnimeThemesImage(animeName) ?? '') : '';
    }

    return [{
      title: bestEntry.animeJPName || bestEntry.animeENName || 'Unknown',
      type: bestEntry.songType || 'Theme',
      url: '',
      imageUrl: imageUrl
    }];
  }

  // ── Fallback: AnimeThemes API ──
  console.log('[MRA] AnisongDB found nothing, trying AnimeThemes API fallback...');

  // Compute romajiTitle before fallback (needed there)
  const fallbackRomajiTitle = await textToRomaji(title);

  try {
    let atSongs: any[] = [];

    // First try original title
    const query = encodeURIComponent(title);
    const res = await fetch(`https://api.animethemes.moe/song?q=${query}&include=animethemes.anime`);
    if (res.ok) {
      const data = await res.json();
      atSongs = data.songs || [];
    }

    // If we have romaji title and no match yet, try romaji title
    if (atSongs.length === 0 && fallbackRomajiTitle) {
      const queryRomaji = encodeURIComponent(fallbackRomajiTitle);
      const res2 = await fetch(`https://api.animethemes.moe/song?q=${queryRomaji}&include=animethemes.anime`);
      if (res2.ok) {
        const data2 = await res2.json();
        atSongs = data2.songs || [];
      }
    }

    if (atSongs.length > 0) {
      // Find the first song that actually has an anime attached
      const song = atSongs.find((s: any) => s.animethemes && s.animethemes.length > 0 && s.animethemes[0].anime);
      if (song) {
        const theme = song.animethemes[0];
        const anime = theme.anime;

        // Reuse fetchAnimeThemesImage to get a high‑quality cover
        const imageUrl = await fetchAnimeThemesImage(anime.name) || '';

        return [{
          title: anime.name,
          type: theme.type || 'Possible match',
          url: `https://animethemes.moe/anime/${anime.slug}`,
          imageUrl
        }];
      }
    }
  } catch (error) {
    console.error('[MRA] AnimeThemes API fallback failed:', error);
  }

  // ── Final Fallback: Google AI Search ──
  console.log('[MRA] All primary APIs failed, trying Google AI fallback...');
  try {
    const googleResult = await findAnimeFromGoogle(title, artist);
    if (googleResult.length > 0) {
      console.log('[MRA] Google AI found:', googleResult[0].title);
      return googleResult;
    }
  } catch (error) {
    console.error('[MRA] Google AI fallback failed:', error);
  }

  return [];
}

// 2b. Google AI Overview Fallback (uses Gemini API to identify anime from song info)
async function findAnimeFromGoogle(_title: string, _artist: string): Promise<AnimeData[]> {
  // Try to get from env, fallback to hardcoded for dev
  let apiKey = import.meta?.env?.VITE_GOOGLE_GEMINI_API_KEY;
  
  // Debug: log what's in import.meta.env
  console.log('[MRA] import.meta.env keys:', Object.keys(import.meta?.env || {}));
  console.log('[MRA] VITE_ vars:', Object.keys(import.meta?.env || {}).filter(k => k.startsWith('VITE_')));
  
  // If not found, try hardcoded fallback (for dev testing only)
  if (!apiKey) {
    apiKey = 'AIzaSyDaBJoVU0WjOXiu89kbpATL-EHyNTpDz1k';
    console.log('[MRA] Using fallback API key');
  }

  if (!apiKey) {
    console.warn('[MRA] Google Gemini API key not configured. Set VITE_GOOGLE_GEMINI_API_KEY in .env');
    return [];
  }

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?alt=json&key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `"${_title}" by "${_artist}" is an anime opening/ending theme. Which anime has this as its OP or ED? Answer ONLY: "AnimeName (OP)" or "AnimeName (ED)". No extra text.` }] }]
          })
        }
      );
      if (res.status === 429) {
        const waitTime = (attempt + 1) * 2000;
        console.log(`[MRA] Rate limited, waiting ${waitTime}ms...`);
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }
      if (!res.ok) return [];
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) return [];
      const match = text.match(/(.+?)\s*\(?(OP|ED)\)?/i);
      if (match) {
        return [{
          title: match[1].trim(),
          type: match[2].toUpperCase(),
          url: '',
          imageUrl: ''
        }];
      }
      return [];
    } catch (e) {
      console.warn('[MRA] Google AI attempt failed:', e);
    }
  }
  console.warn('[MRA] Google AI all retries exhausted');
  return [];
}

// 3. Lrclib API Matcher
export async function fetchLyrics(title: string, artist: string): Promise<string> {
  try {
    const url = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
    const res = await fetch(url);
    if (!res.ok) return "Lyrics not found.";
    const data = await res.json();
    if (data && data.length > 0) {
      return data[0].plainLyrics || "Lyrics not found.";
    }
    return "Lyrics not found.";
  } catch {
    return "Could not fetch lyrics.";
  }
}
