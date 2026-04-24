/**
 * Audio recording module — captures mic or desktop audio for fingerprinting.
 */

import type { AppSettings } from '../types';
import { getElectronAPI } from '../types';

let audioLevelCallback: ((level: number) => void) | null = null;

export function setAudioLevelCallback(callback: (level: number) => void) {
  audioLevelCallback = callback;
}

export function clearAudioLevelCallback() {
  audioLevelCallback = null;
}

function getSettingsFromStorage(): AppSettings | null {
  try {
    const saved = localStorage.getItem('mra-settings');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export async function recordAudio(mode: 'mic' | 'desktop', durationMs: number = 5000): Promise<Blob> {
  const electronAPI = getElectronAPI();
  const settings = electronAPI?.getSettingsSync?.() || getSettingsFromStorage();
  const inputDeviceId = settings?.inputDeviceId || 'default';
  
  let stream: MediaStream;
  
  if (mode === 'desktop') {
    if (!electronAPI) throw new Error("Electron API missing. Are you running this in a regular web browser instead of the Electron app?");
    const sourceId = await electronAPI.getDesktopAudioSource?.();
    if (!sourceId) throw new Error("Desktop audio source not found. Ensure the app has screen capture permissions.");
    
    const rawStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // @ts-expect-error Chrome-specific constraint
        mandatory: {
          chromeMediaSource: 'desktop',
        }
      },
      video: {
        // @ts-expect-error Chrome-specific constraint
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
        }
      }
    });
    
    const audioTrack = rawStream.getAudioTracks()[0];
    const videoTrack = rawStream.getVideoTracks()[0];
    if (videoTrack) videoTrack.stop();
    
    if (!audioTrack) {
        rawStream.getTracks().forEach(t => t.stop());
        throw new Error("Could not hook into system audio loopback.");
    }
    
    stream = new MediaStream([audioTrack]);
  } else {
    const constraints: MediaStreamConstraints = { 
      audio: inputDeviceId !== 'default' ? { deviceId: { exact: inputDeviceId } } : true, 
      video: false 
    };
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  }

  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  
  const updateLevel = () => {
    if (audioLevelCallback && analyser) {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const normalized = Math.min(100, (average / 128) * 100);
      audioLevelCallback(normalized);
    }
  };
  
  const levelInterval = setInterval(updateLevel, 50);

  return new Promise((resolve, reject) => {
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    const audioChunks: BlobPart[] = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      clearInterval(levelInterval);
      stream.getTracks().forEach(track => track.stop());
      audioContext.close();
      if (audioLevelCallback) audioLevelCallback(0);
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      resolve(audioBlob);
    };

    mediaRecorder.onerror = (e) => {
      clearInterval(levelInterval);
      stream.getTracks().forEach(track => track.stop());
      audioContext.close();
      if (audioLevelCallback) audioLevelCallback(0);
      reject(e);
    };

    mediaRecorder.start();

    setTimeout(() => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, durationMs);
  });
}