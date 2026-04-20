import { useState, useCallback, useEffect } from 'react';

export interface AppSettings {
  inputDeviceId: string;
  outputDeviceId: string;
  desktopHotkey: string;
  micHotkey: string;
  minimizeToTray: boolean;
  trayAction: 'minimize' | 'close';
  enableDiscordActivity: boolean;
  rememberWindowLocation: boolean;
  rememberWindowSize: boolean;
  searchOnOpen: 'dont_search' | 'mic' | 'desktop';
  searchDuration: 'continue' | '10s' | '20s' | '30s';
  animeInfoSource: 'animethemes' | 'google';
}

const DEFAULT_SETTINGS: AppSettings = {
  inputDeviceId: 'default',
  outputDeviceId: 'default',
  desktopHotkey: 'Control + Shift + D',
  micHotkey: 'Control + Shift + M',
  minimizeToTray: true,
  trayAction: 'minimize',
  enableDiscordActivity: false,
  rememberWindowLocation: true,
  rememberWindowSize: true,
  searchOnOpen: 'dont_search',
  searchDuration: 'continue',
  animeInfoSource: 'animethemes',
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('mra-settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  useEffect(() => {
    localStorage.setItem('mra-settings', JSON.stringify(settings));
    if (window.electronAPI) {
      window.electronAPI.saveSettings(settings);
    }
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    updateSetting,
    resetSettings,
  };
}
