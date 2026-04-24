/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Manual Integration Tests for live audio recording
 * 
 * These tests require manual verification as they rely on actual
 * microphone/desktop audio capture, which cannot be reliably 
 * tested in automated CI without mock audio streams.
 * 
 * Run manually with:
 *   npx tsx test/manual-live-audio.ts
 * 
 * Then play an anime song through speakers or sing into the microphone.
 */

import { identifyTrack } from '../src/lib/api';

async function testMicrophoneCapture(): Promise<void> {
  console.log('=== Manual Test: Microphone Audio Capture ===\n');
  console.log(' Speak or play an anime song into your microphone...');
  console.log(' (Recording for 10 seconds...)');
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioChunks: Blob[] = [];
    
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => audioChunks.push(e.data);
    recorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      console.log(' Recording done, size:', blob.size);
      
      const result = await identifyTrack(blob);
      if (result) {
        console.log('\n✅ SUCCESS: Identified track:', result.title);
        console.log('   Artist:', result.artist);
        console.log('   Album:', result.album);
      } else {
        console.log('\n❌ FAILED: Could not identify track');
      }
    };
    
    recorder.start();
    setTimeout(() => recorder.stop(), 10000);
  } catch (e) {
    console.error('❌ ERROR:', e);
  }
}

async function testDesktopAudioCapture(): Promise<void> {
  console.log('=== Manual Test: Desktop Audio Capture ===\n');
  console.log(' This requires system audio capture permissions.');
  console.log(' Run the app manually to test desktop mode.');
}

console.log('Manual integration tests need a browser or Electron environment.');
console.log('Please run this in dev mode: npm run dev');
console.log('Then open http://localhost:5173 and use the UI.');