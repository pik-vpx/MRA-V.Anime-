import { useState, useCallback, useEffect } from 'react';
import type { AppSettings } from '../types';
import { DEFAULT_SETTINGS, getElectronAPI } from '../types';

export type { AppSettings } from '../types';

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
    const electronAPI = getElectronAPI();
    if (electronAPI) {
      electronAPI.saveSettings(settings);
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
