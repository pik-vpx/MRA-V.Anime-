/**
 * Hook for fetching anime data with background image lazy-loading.
 * Replaces the duplicated fetch-anime-then-load-images pattern in App.tsx.
 */

import { useState, useCallback, useRef } from 'react';
import { findAnimeForTrack, fetchAnimeThemesImage } from '../lib/api';
import type { AnimeData } from '../lib/api';

export function useAnimeSearch() {
  const [animeLoading, setAnimeLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  /**
   * Fetches anime data for a track with 2-phase loading:
   * 1. Returns anime name/type immediately (skipImage)
   * 2. Background-fetches images and calls onUpdate with enriched data
   */
  const searchAnime = useCallback(
    async (
      title: string,
      artist: string,
      source: 'animethemes' | 'google',
      onUpdate: (animes: AnimeData[]) => void,
      abortSignal?: AbortSignal,
    ) => {
      // Abort previous search
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
      const controller = new AbortController();
      controllerRef.current = controller;

      setAnimeLoading(true);

      try {
        // Phase 1: Get anime data without images (instant)
        const animeDataArray = await findAnimeForTrack(title, artist, source, { skipImage: true });

        if (abortSignal?.aborted || controller.signal.aborted) return;

        if (animeDataArray.length > 0) {
          // Show anime card immediately (no image yet)
          onUpdate(animeDataArray);

          // Phase 2: Fetch images in background
          const withImages = await Promise.all(
            animeDataArray.map(async (anime) => {
              if (!anime.imageUrl && anime.title && anime.title !== 'Unknown') {
                const img = await fetchAnimeThemesImage(anime.title);
                return { ...anime, imageUrl: img || '' };
              }
              return anime;
            }),
          );

          if (!abortSignal?.aborted && !controller.signal.aborted) {
            onUpdate(withImages);
          }
        }
      } finally {
        if (!abortSignal?.aborted && !controller.signal.aborted) {
          setAnimeLoading(false);
        }
      }
    },
    [],
  );

  const cancelSearch = useCallback(() => {
    controllerRef.current?.abort();
    setAnimeLoading(false);
  }, []);

  return {
    animeLoading,
    searchAnime,
    cancelSearch,
  };
}
