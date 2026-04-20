import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Monitor, Play, RefreshCw, Copy, ExternalLink, Disc3, Disc, Settings, Music, Headphones, FolderOpen, Upload, Volume2 } from 'lucide-react';
import { recordAudio, setAudioLevelCallback, clearAudioLevelCallback } from './lib/audio';
import { identifyTrack, findAnimeForTrack, fetchLyrics } from './lib/api';
import type { TrackData, AnimeData } from './lib/api';
import SettingsPage from './components/Settings';

interface ElectronAPI {
  onTriggerListen: (callback: (mode: 'mic' | 'desktop') => void) => void;
  removeTriggerListen?: () => void;
  saveSettings: (settings: AppSettings) => void;
}

type Page = 'home' | 'settings';

interface AppSettings {
  animeInfoSource: 'animethemes' | 'google';
  searchOnOpen: 'dont_search' | 'mic' | 'desktop';
  searchDuration: 'continue' | '10s' | '20s' | '30s';
  minimizeToTray: boolean;
  trayAction: 'minimize' | 'close';
}

function App() {
  const [searchAbortController, setSearchAbortController] = useState<AbortController | null>(null);
  const [animeLoading, setAnimeLoading] = useState(false);
  const [page, setPage] = useState<Page>('home');
  const [listening, setListening] = useState(false);
  const [mode, setMode] = useState<'mic' | 'desktop'>('mic');
  const [analyzing, setAnalyzing] = useState(false);
  type ResultData = TrackData & { animes?: AnimeData[]; lyrics?: string; };

const [result, setResult] = useState<ResultData | null>(null);
  const [dragging, setDragging] = useState(false);
  const [ready, setReady] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [currentDevice, setCurrentDevice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const startListeningRef = useRef<((mode: 'mic' | 'desktop') => void) | null>(null);

  const getSettings = useCallback((): AppSettings => {
    try {
      const saved = localStorage.getItem('mra-settings');
      return saved ? JSON.parse(saved) : {
        animeInfoSource: 'animethemes',
        searchOnOpen: 'dont_search',
        searchDuration: 'continue',
        minimizeToTray: true,
        trayAction: 'minimize'
      };
    } catch {
      return {
        animeInfoSource: 'animethemes',
        searchOnOpen: 'dont_search',
        searchDuration: 'continue',
        minimizeToTray: true,
        trayAction: 'minimize'
      };
    }
  }, []);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !(window as Window & { electronAPI?: ElectronAPI }).electronAPI) return;

    const settings = getSettings();
    if (settings.searchOnOpen !== 'dont_search' && startListeningRef.current) {
      const mode = settings.searchOnOpen as 'mic' | 'desktop';
      const durationMap: Record<string, number> = {
        '10s': 10000,
        '20s': 20000,
        '30s': 30000,
      };
      const duration = durationMap[settings.searchDuration] || null;

      if (duration) {
        setTimeout(() => startListeningRef.current?.(mode), 500);
      } else {
        startListeningRef.current?.(mode);
      }
    }

    (window as Window & { electronAPI?: ElectronAPI }).electronAPI?.onTriggerListen?.((triggerMode: 'mic' | 'desktop') => {
      startListeningRef.current?.(triggerMode);
    });

    return () => {
      (window as Window & { electronAPI?: ElectronAPI }).electronAPI?.removeTriggerListen?.();
    };
  }, [ready, getSettings]);

  // Shared logic: take an audio blob, identify it, find anime + lyrics
  const processAudioBlob = async (audioBlob: Blob) => {
    const settings = getSettings();
    // Abort any previous search
    if (searchAbortController) {
      searchAbortController.abort();
    }
    const controller = new AbortController();
    setSearchAbortController(controller);
    try {
      setAnalyzing(true);
      const trackData = await identifyTrack(audioBlob, controller.signal);
      if (controller.signal.aborted) return;
      if (trackData) {
        // Show song info immediately, without anime/lyrics yet
        setResult({
          ...trackData,
          animes: [],
          lyrics: ''
        });
        
        // FETCH ANIME IN BACKGROUND - show when ready
        setAnimeLoading(true);
        findAnimeForTrack(trackData.title, trackData.artist, settings.animeInfoSource)
          .then(animeDataArray => {
            if (!controller.signal.aborted) {
              setResult(prev => prev ? { ...prev, animes: animeDataArray } : null);
            }
          })
          .finally(() => {
            if (!controller.signal.aborted) setAnimeLoading(false);
          });
        
        // FETCH LYRICS IN BACKGROUND - show when ready (separate from anime)
        fetchLyrics(trackData.title, trackData.artist)
          .then(lyricsData => {
            if (!controller.signal.aborted) {
              const finalLyrics = lyricsData !== "Lyrics not found." ? lyricsData : trackData.lyrics;
              setResult(prev => prev ? { ...prev, lyrics: finalLyrics } : null);
            }
          });
      } else {
        alert("Could not identify the song.");
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        console.log('[MRA] Search aborted');
      } else {
        alert("Error recognizing audio: " + (e instanceof Error ? e.message : String(e)));
      }
    } finally {
      setAnalyzing(false);
      setAnimeLoading(false);
    }
  };

  const listeningRef = useRef(false);

  const stopListening = () => {
    listeningRef.current = false;
    setListening(false);
    setAnalyzing(false);
    setAudioLevel(0);
    setCurrentDevice('');
    clearAudioLevelCallback();
  };

  const startListening = async (listenMode: 'mic' | 'desktop') => {
    // Cancel any ongoing search
    if (searchAbortController) {
      searchAbortController.abort();
    }
    const controller = new AbortController();
    setSearchAbortController(controller);

    if (listeningRef.current) {
      stopListening();
      return;
    }

    const settings = getSettings();
    const durationMs = (() => {
      const durationMap: Record<string, number> = {
        '10s': 10000,
        '20s': 20000,
        '30s': 30000,
      };
      return durationMap[settings.searchDuration];
    })();

    const startTime = Date.now();

    setAudioLevelCallback((level: number) => {
      setAudioLevel(level);
    });

    try {
      setMode(listenMode);
      setListening(true);
      setCurrentDevice(listenMode === 'mic' ? 'Microphone' : 'Desktop Audio');
      listeningRef.current = true;

      // Pipeline: record next chunk while previous is being analyzed
      let pendingIdentify: Promise<TrackData | null> | null = null;

      while (listeningRef.current) {
        // Check if duration limit reached
        if (durationMs && Date.now() - startTime >= durationMs) {
          console.log('[MRA] Duration limit reached, stopping...');
          break;
        }

        // Start recording (this runs for 5 seconds)
        const recordPromise = recordAudio(listenMode, 5000);

        // While recording, check if previous identify finished
        if (pendingIdentify) {
          const trackData = await pendingIdentify;
          pendingIdentify = null;

          if (!listeningRef.current) break;

          if (trackData) {
            // Found a match! Show track immediately
            setListening(false);
            setResult({
              ...trackData,
              animes: [],
              lyrics: ''
            });
            
            // FETCH ANIME IN BACKGROUND
            setAnimeLoading(true);
            const settings = getSettings();
            findAnimeForTrack(trackData.title, trackData.artist, settings.animeInfoSource)
              .then(animeDataArray => {
                if (!controller.signal.aborted) {
                  setResult(prev => prev ? { ...prev, animes: animeDataArray } : null);
                }
              })
              .finally(() => {
                if (!controller.signal.aborted) setAnimeLoading(false);
              });
            listeningRef.current = false;
            return;
          }
          console.log('[MRA] No match on previous chunk, still listening...');
        }

        // Wait for current recording to finish
        const audioBlob = await recordPromise;
        if (!listeningRef.current) break;

        // Fire off identification in background (non-blocking) with abort support
        setAnalyzing(true);
        pendingIdentify = identifyTrack(audioBlob, controller.signal).finally(() => {
          if (listeningRef.current) setAnalyzing(false);
        });
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        console.log('[MRA] Listening aborted');
      } else {
        console.error("Error recognizing audio:", e instanceof Error ? e.message : String(e));
      }
    } finally {
      listeningRef.current = false;
      setListening(false);
      setAnalyzing(false);
    }
  };

  startListeningRef.current = startListening;

  // Cancel current search/listening
  const handleCancel = () => {
    if (searchAbortController) {
      searchAbortController.abort();
      setSearchAbortController(null);
    }
    stopListening();
    setResult(null);
    setAnalyzing(false);
    setAnimeLoading(false);
    setListening(false);
  };

  const handleFileSelect = async (file: File) => {
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/webm', 'audio/aac', 'video/mp4', 'video/webm'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|flac|m4a|webm|aac|mp4)$/i)) {
      alert("Please use an audio file (MP3, WAV, OGG, FLAC, M4A, etc.)");
      return;
    }
    const blob = new Blob([await file.arrayBuffer()], { type: file.type || 'audio/mpeg' });
    await processAudioBlob(blob);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  const reset = () => {
    setResult(null);
    setListening(false);
    setAnalyzing(false);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-white relative">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*,.mp3,.wav,.ogg,.flac,.m4a,.aac"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
          e.target.value = '';
        }}
      />

      {/* ─── Title Bar ─── */}
      <div className="h-10 w-full shrink-0 flex items-center pl-4 pr-32 justify-between border-b border-slate-800/50" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 no-drag">
            <button
              onClick={() => setPage('home')}
              className={`p-2 rounded-lg transition-colors ${page === 'home' ? 'text-white bg-slate-800' : 'text-slate-500 hover:text-white hover:bg-slate-800/50'}`}
              title="Home"
            >
              <Music className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage('home')}
              className="p-2 rounded-lg transition-colors text-slate-500 hover:text-white hover:bg-slate-800/50"
              title="Headphones"
            >
              <Headphones className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage('settings')}
              className={`p-2 rounded-lg transition-colors ${page === 'settings' ? 'text-white bg-slate-800' : 'text-slate-500 hover:text-white hover:bg-slate-800/50'}`}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs font-semibold tracking-widest text-slate-400 flex items-center gap-2 ml-4">
            <Disc3 className="w-4 h-4 text-indigo-400" />
            MRA ANIME
          </div>
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex flex-col items-center relative overflow-hidden">
        {/* Ambient top light */}
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/20 blur-[100px] pointer-events-none" />

        <AnimatePresence mode="wait">
          {page === 'settings' ? (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full h-full"
            >
              <SettingsPage onBack={() => setPage('home')} />
            </motion.div>
          ) : analyzing ? (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center flex-1 w-full"
            >
              <div className="relative flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-24 h-24"
                >
                  <Disc3 className="w-24 h-24 text-indigo-500" />
                </motion.div>
              </div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-8 text-indigo-300 font-medium tracking-wide flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4 animate-spin" />
                ANALYZING AUDIO...
              </motion.p>
              {/* Cancel Button */}
              <button
                onClick={handleCancel}
                className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
              >
                Cancel
              </button>

            </motion.div>
          ) : listening ? (
            <motion.div
              key="listening"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center flex-1 w-full"
            >
              <div className="relative flex items-center justify-center">
                <motion.div
                  animate={{ scale: [1, 1.5, 2], opacity: [0.5, 0, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                  className="absolute w-32 h-32 bg-blue-500/30 rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1.8], opacity: [0.8, 0, 0] }}
                  transition={{ duration: 2, delay: 0.5, repeat: Infinity, ease: "easeOut" }}
                  className="absolute w-32 h-32 bg-indigo-500/30 rounded-full"
                />
                <div className="z-10 w-32 h-32 rounded-full flex items-center justify-center bg-indigo-600 shadow-[0_0_40px_rgba(79,70,229,0.5)]">
                  <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                    <Disc className="w-12 h-12 text-white" />
                  </motion.div>
                </div>
              </div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-12 text-white font-medium tracking-wide"
              >
                LISTENING TO {mode === 'mic' ? 'MICROPHONE' : 'DESKTOP'}...
              </motion.p>
              {/* Cancel Button */}
              <button
                onClick={handleCancel}
                className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
              >
                Cancel
              </button>

            </motion.div>
          ) : !result ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center flex-1 w-full px-6 no-drag"
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
            >
              {/* Drag overlay */}
              {dragging && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 z-50 bg-indigo-950/80 backdrop-blur-md flex flex-col items-center justify-center border-2 border-dashed border-indigo-500 rounded-2xl m-4"
                >
                  <Upload className="w-16 h-16 text-indigo-400 mb-4" />
                  <p className="text-xl font-bold text-indigo-300">Drop audio file here</p>
                  <p className="text-sm text-indigo-400/70 mt-1">MP3, WAV, OGG, FLAC, M4A</p>
                </motion.div>
              )}

              <p className="text-slate-400 font-medium tracking-wide mb-10">
                Click one of the buttons below to search for music
              </p>

              <div className="w-full max-w-md space-y-4">
                {/* Open File */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-900/70 border border-slate-700 rounded-xl text-sm font-medium text-slate-200 hover:bg-slate-800 hover:border-slate-600 hover:text-white transition-all group"
                >
                  <FolderOpen className="w-5 h-5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                  Open a file (or drag & drop)
                </button>

                {/* Listen Microphone */}
                <button
                  onClick={() => startListening('mic')}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-900/70 border border-slate-700 rounded-xl text-sm font-medium text-slate-200 hover:bg-slate-800 hover:border-slate-600 hover:text-white transition-all group"
                >
                  <Mic className="w-5 h-5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                  Listen Microphone
                </button>

                {/* Listen Desktop Audio */}
                <button
                  onClick={() => startListening('desktop')}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-900/70 border border-slate-700 rounded-xl text-sm font-medium text-slate-200 hover:bg-slate-800 hover:border-slate-600 hover:text-white transition-all group"
                >
                  <Monitor className="w-5 h-5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                  Listen Desktop Audio
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col w-full px-6 flex-1 max-h-full overflow-y-auto no-drag pb-6 styled-scrollbar pt-6"
            >
              {/* ─── Track Header ─── */}
              <div className="flex gap-6">
                {/* Album Art */}
                <div className="w-40 shrink-0">
                  <div className="w-40 h-40 rounded-xl overflow-hidden shadow-2xl border border-slate-800 relative group">
                    <img src={result.cover} alt="Album Cover" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm cursor-pointer">
                      <Play className="w-10 h-10 text-white fill-white" />
                    </div>
                  </div>
                  {/* Copy Music Name Button */}
                  <button
                    onClick={() => navigator.clipboard.writeText(`${result.artist} - ${result.title}`)}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300 hover:text-white transition-all active:scale-95"
                    title="Copy the music name and artist"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy music name and artist
                  </button>
                </div>

                {/* Track Details Table */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-3xl font-bold text-white truncate">{result.title}</h2>

                  <table className="mt-4 w-full text-sm">
                    <tbody>
                      <tr>
                        <td className="py-1.5 pr-6 text-slate-500 whitespace-nowrap">Artist</td>
                        <td className="py-1.5 text-white font-medium">{result.artist}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 pr-6 text-slate-500 whitespace-nowrap">Album</td>
                        <td className="py-1.5 text-white font-medium">{result.album}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 pr-6 text-slate-500 whitespace-nowrap">Genre</td>
                        <td className="py-1.5 text-white font-medium">{result.genre}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 pr-6 text-slate-500 whitespace-nowrap">Release Date</td>
                        <td className="py-1.5 text-white font-medium">{result.releaseDate}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Listen Here Links */}
                  <div className="mt-4">
                    <p className="text-xs text-slate-500 mb-2">Listen here:</p>
                    <div className="flex items-center gap-3">
                      {result.appleMusic && result.appleMusic !== '#' && (
                        <a href={result.appleMusic} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-slate-400 hover:text-white" title="Apple Music">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      {result.spotify && result.spotify !== '#' && (
                        <a href={result.spotify} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-green-400 hover:text-green-300" title="Spotify">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {/* Anime loading indicator */}
              {animeLoading && (
                <div className="mt-4 flex items-center gap-2 text-indigo-300">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Finding anime...
                </div>
              )}
              {/* ─── Anime OST - show instantly when available, image pops when ready ─── */}
              {result.animes && result.animes.length > 0 && (() => {
                const anime = result.animes[0];
                return (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-8 bg-indigo-950/40 border border-indigo-500/20 rounded-2xl p-5 relative overflow-hidden backdrop-blur-xl"
                  >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />
                    <div className="text-indigo-400 text-xs font-bold tracking-widest flex items-center gap-1.5 mb-4">
                      <Disc3 className="w-3.5 h-3.5" />
                      ANIME OST
                    </div>
                    <div className="flex gap-4 items-start">
                      {/* Image - shows when fetched, placeholder before */}
                      {anime.imageUrl ? (
                        <img src={anime.imageUrl} alt="Anime Cover" className="w-28 h-40 rounded-xl bg-indigo-900 object-cover shrink-0 border border-indigo-500/20" />
                      ) : (
                        <div className="w-28 h-40 rounded-xl bg-indigo-900/50 shrink-0 border border-indigo-500/20 flex items-center justify-center">
                          <Disc className="w-8 h-8 text-indigo-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-indigo-50">{anime.title}</h3>
                        {anime.type && (
                          <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full mt-2 inline-block font-medium">
                            {anime.type}
                          </span>
                        )}
                        <div className="mt-4">
                          <button
                            onClick={() => navigator.clipboard.writeText(anime.title)}
                            className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded-lg transition-all hover:scale-105 active:scale-95 text-xs font-medium"
                            title="Copy Anime Name"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Copy anime name
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })()}


              {/* ─── Bottom Actions ─── */}
              <div className="mt-6 flex justify-center pb-2">
                <button
                  onClick={reset}
                  className="text-sm text-slate-400 hover:text-white flex items-center gap-2 px-4 py-2 rounded-full hover:bg-slate-800 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Identify Another
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Audio Level Bar ─── */}
        {listening && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 px-4 py-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-indigo-400" />
                <span className="text-xs text-slate-300 font-medium">{currentDevice}</span>
              </div>
              <span className="text-xs text-slate-500">{Math.round(audioLevel)}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full"
                animate={{ width: `${audioLevel}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default App;
