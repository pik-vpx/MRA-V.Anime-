import { useState, useCallback } from 'react';
import { findAnimeForTrack, AnimeData } from '../lib/api';

export function useAnimeFallback() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchAnime = useCallback(async (title: string, artist: string, source: 'animethemes' | 'google' = 'animethemes') => {
    setLoading(true);
    setError(null);
    try {
      const results = await findAnimeForTrack(title, artist, source);
      return results;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setError(message);
      return [] as AnimeData[];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    searchAnime,
  };
}