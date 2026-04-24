import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Headphones, Keyboard, RefreshCw, Save, ArrowLeft, Settings2, ChevronDown } from 'lucide-react';
import type { AppSettings } from '../types';
import { DEFAULT_SETTINGS, getElectronAPI } from '../types';

interface SettingsProps {
  onBack: () => void;
}


function Settings({ onBack }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('mra-settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  const [audioDevices, setAudioDevices] = useState<{ inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] }>({
    inputs: [],
    outputs: [],
  });

  const [recordingHotkey, setRecordingHotkey] = useState<'desktop' | 'mic' | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices({
        inputs: devices.filter(d => d.kind === 'audioinput'),
        outputs: devices.filter(d => d.kind === 'audiooutput'),
      });
    } catch (e) {
      console.error('Failed to enumerate devices:', e);
    }
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    loadDevices();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [loadDevices]);

  useEffect(() => {
    localStorage.setItem('mra-settings', JSON.stringify(settings));

    const electronAPI = getElectronAPI();
    if (electronAPI) {
      electronAPI.saveSettings(settings);
    }
  }, [settings]);

  const handleHotkeyCapture = (e: React.KeyboardEvent, type: 'desktop' | 'mic') => {
    e.preventDefault();
    const keys: string[] = [];
    if (e.ctrlKey) keys.push('Control');
    if (e.shiftKey) keys.push('Shift');
    if (e.altKey) keys.push('Alt');
    if (e.metaKey) keys.push('Meta');

    const key = e.key;
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
      keys.push(key.length === 1 ? key.toUpperCase() : key);
    }

    if (keys.length > 1) {
      const hotkeyStr = keys.join(' + ');
      setSettings(prev => ({
        ...prev,
        [type === 'desktop' ? 'desktopHotkey' : 'micHotkey']: hotkeyStr,
      }));
      setRecordingHotkey(null);
    }
  };

  const update = (key: keyof AppSettings, value: AppSettings[keyof AppSettings]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full w-full overflow-y-auto no-drag pb-8"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-2 pb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-indigo-400" />
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </div>

      <div className="px-6 space-y-8">
        {/* ─── Devices Section ─── */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <Headphones className="w-5 h-5 text-slate-300" />
            <h2 className="text-lg font-bold text-white">Devices</h2>
          </div>

          {/* Input Device */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm text-slate-400 w-28 shrink-0">Input Device:</span>
            <div className="relative flex-1">
              <select
                value={settings.inputDeviceId}
                onChange={(e) => update('inputDeviceId', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 pr-8 appearance-none cursor-pointer hover:border-slate-600 transition-colors focus:outline-none focus:border-indigo-500"
              >
                <option value="default">Default Microphone</option>
                {audioDevices.inputs.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <button
              onClick={loadDevices}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {/* Output Device */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 w-28 shrink-0">Output Device:</span>
            <div className="relative flex-1">
              <select
                value={settings.outputDeviceId}
                onChange={(e) => update('outputDeviceId', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 pr-8 appearance-none cursor-pointer hover:border-slate-600 transition-colors focus:outline-none focus:border-indigo-500"
              >
                <option value="default">Default Speakers</option>
                {audioDevices.outputs.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Speaker ${d.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <button
              onClick={loadDevices}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </section>

        <hr className="border-slate-800" />

        {/* ─── Hotkeys Section ─── */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <Keyboard className="w-5 h-5 text-slate-300" />
            <h2 className="text-lg font-bold text-white">Hotkeys</h2>
          </div>

          {/* Desktop Hotkey */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm text-slate-400 w-44 shrink-0">Listen Desktop Hotkey:</span>
            <div
              tabIndex={0}
              onClick={() => setRecordingHotkey('desktop')}
              onKeyDown={(e) => recordingHotkey === 'desktop' && handleHotkeyCapture(e, 'desktop')}
              className={`flex-1 bg-slate-800 border rounded-lg px-3 py-2.5 text-sm font-mono cursor-pointer transition-colors ${recordingHotkey === 'desktop'
                  ? 'border-indigo-500 text-indigo-300 animate-pulse'
                  : 'border-slate-700 text-white hover:border-slate-600'
                }`}
            >
              {recordingHotkey === 'desktop' ? 'Press keys...' : settings.desktopHotkey}
            </div>
            <button
              onClick={() => setRecordingHotkey(null)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </button>
          </div>

          {/* Mic Hotkey */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 w-44 shrink-0">Listen Microphone Hotkey:</span>
            <div
              tabIndex={0}
              onClick={() => setRecordingHotkey('mic')}
              onKeyDown={(e) => recordingHotkey === 'mic' && handleHotkeyCapture(e, 'mic')}
              className={`flex-1 bg-slate-800 border rounded-lg px-3 py-2.5 text-sm font-mono cursor-pointer transition-colors ${recordingHotkey === 'mic'
                  ? 'border-indigo-500 text-indigo-300 animate-pulse'
                  : 'border-slate-700 text-white hover:border-slate-600'
                }`}
            >
              {recordingHotkey === 'mic' ? 'Press keys...' : settings.micHotkey}
            </div>
            <button
              onClick={() => setRecordingHotkey(null)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </button>
          </div>
        </section>

        <hr className="border-slate-800" />

        {/* ─── General Section ─── */}
        <section className="space-y-5">
          <h2 className="text-lg font-bold text-white">General</h2>

          {/* Minimize to Tray */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.minimizeToTray}
                onChange={(e) => update('minimizeToTray', e.target.checked)}
                className="w-5 h-5 rounded bg-slate-800 border-slate-600 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer accent-indigo-500"
              />
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                Ignore 'Do you want to hide the application in to tray?' message before closing MRA.
              </span>
            </label>
            {settings.minimizeToTray && (
              <div className="ml-8 mt-2">
                <div className="relative inline-block">
                  <select
                    value={settings.trayAction}
                    onChange={(e) => update('trayAction', e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 pr-8 appearance-none cursor-pointer hover:border-slate-600 transition-colors focus:outline-none focus:border-indigo-500"
                  >
                    <option value="minimize">Minimize</option>
                    <option value="close">Close</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {/* Discord Activity */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={settings.enableDiscordActivity}
              onChange={(e) => update('enableDiscordActivity', e.target.checked)}
              className="w-5 h-5 rounded bg-slate-800 border-slate-600 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer accent-indigo-500"
            />
            <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
              Enable Discord Activity.
            </span>
          </label>

          {/* Remember Window Location */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={settings.rememberWindowLocation}
              onChange={(e) => update('rememberWindowLocation', e.target.checked)}
              className="w-5 h-5 rounded bg-slate-800 border-slate-600 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer accent-indigo-500"
            />
            <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
              Remember Window Location
            </span>
          </label>

          {/* Remember Window Size */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={settings.rememberWindowSize}
              onChange={(e) => update('rememberWindowSize', e.target.checked)}
              className="w-5 h-5 rounded bg-slate-800 border-slate-600 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer accent-indigo-500"
            />
            <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
              Remember Window Width and Height
            </span>
          </label>

          <hr className="border-slate-800" />

          {/* Search on Open */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">Search for music that is playing when MRA is opened</span>
            <div className="relative">
              <select
                value={settings.searchOnOpen}
                onChange={(e) => update('searchOnOpen', e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 pr-8 appearance-none cursor-pointer hover:border-slate-600 transition-colors focus:outline-none focus:border-indigo-500"
              >
                <option value="dont_search">Don't Search</option>
                <option value="mic">Microphone</option>
                <option value="desktop">Desktop Audio</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Search Duration */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">Search for music until</span>
            <div className="relative">
              <select
                value={settings.searchDuration}
                onChange={(e) => update('searchDuration', e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 pr-8 appearance-none cursor-pointer hover:border-slate-600 transition-colors focus:outline-none focus:border-indigo-500"
              >
                <option value="continue">Continue Searching</option>
                <option value="10s">10 Seconds</option>
                <option value="20s">20 Seconds</option>
                <option value="30s">30 Seconds</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Anime Info Source */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">Anime info source</span>
            <div className="relative">
              <select
                value={settings.animeInfoSource}
                onChange={(e) => update('animeInfoSource', e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 pr-8 appearance-none cursor-pointer hover:border-slate-600 transition-colors focus:outline-none focus:border-indigo-500"
              >
                <option value="animethemes">AnimeThemes.moe (Accurate)</option>
                <option value="google">Google AI Overview (Low token)</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}

export default Settings;
