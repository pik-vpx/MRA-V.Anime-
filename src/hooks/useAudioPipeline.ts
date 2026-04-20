import { useState, useRef, useCallback } from 'react';
import { recordAudio, setAudioLevelCallback, clearAudioLevelCallback, identifyTrack } from '../lib/audio';
import { findAnimeForTrack } from '../lib/api';

export type ListeningMode = 'mic' | 'desktop';

interface AudioPipelineResult {
  title: string;
  artist: string;
  album: string;
  genre: string;
  releaseDate: string;
  cover: string;
  spotify: string;
  appleMusic: string;
  lyrics: string;
  animes: Array<{
    title: string;
    type: string;
    url: string;
    imageUrl: string;
  }>;
}

export function useAudioPipeline() {
  const [listening, setListening] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [currentDevice, setCurrentDevice] = useState('');
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const listeningRef = useRef(false);

  const startListening = useCallback(async (mode: ListeningMode, durationMs?: number) => {
    if (listeningRef.current) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    listeningRef.current = true;
    setListening(true);
    setCurrentDevice(mode === 'mic' ? 'Microphone' : 'Desktop Audio');

    setAudioLevelCallback((level: number) => {
      setAudioLevel(level);
    });

    try {
      const startTime = Date.now();
      while (listeningRef.current) {
        if (durationMs && Date.now() - startTime >= durationMs) {
          break;
        }

        const audioBlob = await recordAudio(mode, 5000);
        if (!listeningRef.current) break;

        setAnalyzing(true);
        const trackData = await identifyTrack(audioBlob, abortControllerRef.current.signal);
        
        if (!trackData) {
          setAnalyzing(false);
          continue;
        }

        const settingsStr = localStorage.getItem('mra-settings');
        const settings = settingsStr ? JSON.parse(settingsStr) : { animeInfoSource: 'animethemes' };
        
        const animeData = await findAnimeForTrack(
          trackData.title,
          trackData.artist,
          settings.animeInfoSource
        );

        const result: AudioPipelineResult = {
          ...trackData,
          animes: animeData,
        };

        listeningRef.current = false;
        setAnalyzing(false);
        return result;
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        console.log('[useAudioPipeline] Listening aborted');
      } else {
        console.error('[useAudioPipeline] Error:', e instanceof Error ? e.message : String(e));
      }
    } finally {
      listeningRef.current = false;
      setListening(false);
      setAnalyzing(false);
      clearAudioLevelCallback();
    }
  }, []);

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    setListening(false);
    setAnalyzing(false);
    setAudioLevel(0);
    setCurrentDevice('');
    clearAudioLevelCallback();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    listening,
    analyzing,
    audioLevel,
    currentDevice,
    startListening,
    stopListening,
  };
}