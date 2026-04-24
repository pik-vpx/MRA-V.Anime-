/**
 * Google Gemini AI fallback — identifies anime from song metadata using LLM reasoning.
 * Tries Electron IPC first, falls back to direct web API call.
 */

import { logger } from '../utils/logger';
import { getElectronAPI } from '../types';
import type { AnimeData } from './animethemes';

/** Identifies anime from song title/artist using Google Gemini AI. */
export async function findAnimeFromGoogle(title: string, artist: string): Promise<AnimeData[]> {
  // Try Electron API first (when running in Electron app)
  const electronAPI = getElectronAPI();

  if (electronAPI?.askGemini) {
    try {
      logger.log('Using Electron Gemini API...');
      const result = await electronAPI.askGemini(title, artist);
      if (result?.title) {
        return [{ title: result.title, type: result.type || 'Theme', url: '', imageUrl: '' }];
      }
      logger.log('Electron Gemini result:', result);
    } catch (e) {
      logger.warn('Electron Gemini failed:', e);
    }
  }

  // Fallback: Direct web call (for web browser dev)
  logger.log('Using web fallback...');
  const apiKey = import.meta?.env?.VITE_GOOGLE_GEMINI_API_KEY;

  if (!apiKey) {
    logger.warn('Google Gemini API key not configured');
    return [];
  }

  try {
    const prompt = `"${title}" by "${artist}" is an anime song. Which anime uses this as OP or ED? Answer format: "AnimeName"`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?alt=json&key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 30 },
        }),
      },
    );

    if (!res.ok) return [];
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (!text) return [];

    const match = text.match(/(.+?)\s*\(?(OP|ED)\)?/i);
    if (match?.[1]) {
      return [
        {
          title: match[1].trim(),
          type: match[2] ? match[2].toUpperCase() : 'Theme',
          url: '',
          imageUrl: '',
        },
      ];
    }
  } catch (e) {
    logger.warn('Google AI fallback failed:', e);
  }

  return [];
}
