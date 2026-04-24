/**
 * Shared type definitions for MRA Anime Edition.
 * Single source of truth — do NOT re-define these in other files.
 */

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

export const DEFAULT_SETTINGS: AppSettings = {
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

export interface ElectronAPI {
  onTriggerListen: (callback: (mode: 'mic' | 'desktop') => void) => void;
  removeTriggerListen?: () => void;
  saveSettings: (settings: AppSettings) => void;
  getSettingsSync?: () => AppSettings | null;
  getDesktopAudioSource?: () => Promise<string>;
  askGemini?: (title: string, artist: string) => Promise<{ title?: string; type?: string; error?: string }>;
}

export function getElectronAPI(): ElectronAPI | undefined {
  return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
}
