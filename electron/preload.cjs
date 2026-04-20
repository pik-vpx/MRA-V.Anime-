const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDesktopAudioSource: () => ipcRenderer.invoke('get-desktop-audio'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.send('save-settings', settings),
  askGemini: (title, artist) => ipcRenderer.invoke('gemini-ask', { title, artist }),
  onTriggerListen: (callback) => {
    ipcRenderer.on('trigger-listen', (event, mode) => callback(mode));
  },
  removeTriggerListen: () => {
    ipcRenderer.removeAllListeners('trigger-listen');
  }
});