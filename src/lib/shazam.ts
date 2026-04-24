/**
 * Shazam audio fingerprinting via RapidAPI.
 * Converts audio to raw PCM, sends to Shazam, parses track data.
 */

import { logger } from '../utils/logger';

const SHAZAM_API_KEY = 'fa9c751102msh171cea5ecf9d4dep14432bjsnc25fdafbbeab';

const identifyCache = new Map<string, TrackData | null>();
const MAX_CACHE_SIZE = 50;

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

function getAudioHash(blob: Blob): string {
  return `${blob.size}-${blob.type}`;
}

/** Converts an audio Blob to raw PCM: 44100 Hz, 16-bit signed LE, mono. */
async function convertToRawPCM(audioBlob: Blob): Promise<ArrayBuffer> {
  const audioCtx = new AudioContext({ sampleRate: 44100 });
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const monoData = audioBuffer.getChannelData(0);
  const maxSamples = Math.min(monoData.length, 44100 * 5);

  const pcmBuffer = new ArrayBuffer(maxSamples * 2);
  const pcmView = new Int16Array(pcmBuffer);
  for (let i = 0; i < maxSamples; i++) {
    const sample = Math.max(-1, Math.min(1, monoData[i]));
    pcmView[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
  }

  await audioCtx.close();
  return pcmBuffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) {
    const chunk = bytes.subarray(i, i + 32768);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

function addToCache(key: string, value: TrackData | null): void {
  if (identifyCache.size >= MAX_CACHE_SIZE) {
    const firstKey = identifyCache.keys().next().value;
    if (firstKey) identifyCache.delete(firstKey);
  }
  identifyCache.set(key, value);
}

/** Identifies a track from an audio Blob via Shazam API. */
export async function identifyTrack(audioBlob: Blob): Promise<TrackData | null> {
  try {
    const cacheKey = getAudioHash(audioBlob);
    const cached = identifyCache.get(cacheKey);
    if (cached !== undefined) {
      logger.log('Cache hit for identifyTrack');
      return cached;
    }

    logger.log('Starting audio identification, blob size:', audioBlob.size, 'type:', audioBlob.type);

    const pcmBuffer = await convertToRawPCM(audioBlob);
    const base64Audio = arrayBufferToBase64(pcmBuffer);

    const res = await fetch(
      'https://shazam.p.rapidapi.com/songs/v2/detect?timezone=America%2FChicago&locale=en-US',
      {
        method: 'POST',
        headers: {
          'content-type': 'text/plain',
          'X-RapidAPI-Key': SHAZAM_API_KEY,
          'X-RapidAPI-Host': 'shazam.p.rapidapi.com',
        },
        body: base64Audio,
      },
    );

    const data = await res.json();

    if (data?.track) {
      const metadata = data.track.sections?.[0]?.metadata || [];
      const findMeta = (key: string) =>
        metadata.find((m: ShazamMeta) => m.title === key)?.text || '';

      const trackResult: TrackData = {
        title: data.track.title,
        artist: data.track.subtitle,
        album: findMeta('Album') || 'Unknown Album',
        genre: data.track.genres?.primary || findMeta('Genre') || 'Unknown',
        releaseDate: findMeta('Released') || findMeta('Year') || 'Unknown',
        cover: data.track.images?.coverarthq || data.track.images?.coverart || '',
        spotify:
          data.track.hub?.providers?.find((p: ShazamProvider) => p.type === 'SPOTIFY')
            ?.actions?.[0]?.uri || '#',
        appleMusic: data.track.url || '#',
        lyrics:
          data.track.sections
            ?.find((s: ShazamSection) => s.type === 'LYRICS')
            ?.text?.join('\n') || 'Lyrics not found.',
      };

      addToCache(cacheKey, trackResult);
      return trackResult;
    }

    if (data?.matches?.length === 0) {
      logger.warn('Shazam returned no matches for this audio snippet.');
    }

    addToCache(cacheKey, null);
    return null;
  } catch (error) {
    logger.error('Shazam Error:', error);
    return null;
  }
}
