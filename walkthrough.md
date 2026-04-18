# MRA Clone "Anime Edition" Walkthrough

I have fully initialized the "MRA Clone" customized for Anime song detection as an Electron application using React and Tailwind CSS. The app features a stunningly modern UI with fluid animations, glowing elements, and dark mode aesthetics.

## Application Preview

![MRA Anime Player UI Layout](C:\Users\Nanaji\.gemini\antigravity\brain\8936b011-1849-45ba-9116-1cc69d5e226f\mra_anime_player_ui_1776316683854.png)

## What was built

1.  **Frameless Electron Host:** Configured an Electron main process (`main.cjs`) that launches a clean, borderless window with native top-bar dragging capabilities.
2.  **Audio Capturing Integration:** 
    *   Set up IPC bridge through `preload.cjs` to grant access to the `desktopCapturer`.
    *   Wrote `src/lib/audio.ts` to seamlessly record from the user's primary microphone OR their live Desktop audio using WebRTC `navigator.mediaDevices`.
3.  **Third Party APIs Framework:**
    *   Mocked out hooks for *AudD/Shazam* in `src/lib/api.ts` so you can drop your API key in to do fingerprinting.
    *   Integrated **Jikan API (MyAnimeList)** to automatically search the track name and return the exact anime it originates from.
    *   Integrated **Lrclib** to fetch dynamic lyrics based on track metadata.
4.  **Premium User Interface (`App.tsx`):**
    *   Created an immersive, reactive animated layout using TailwindCSS + `framer-motion`.
    *   Added a pulsating visualization listen button with a custom glow effect.
    *   Built the "Anime Origin" card highlighting the Anime Name along with the requested **Copy to Clipboard** button.
    *   A rich tracking displaying the album cover, lyrics wall, and platform integrations like Spotify.

## How to Run the App Local Development

To run the application natively on Windows and test it out:

```powershell
cd "a:\MRA clone for anime"
npm run electron:dev
```
*Note: Make sure any active scripts are saved before launching. The `electron:dev` script will concurrently boot Vite and the Electron host.*

> [!TIP]
> **API Key Setup**
> The application uses a mock API delay to demonstrate the gorgeous transitions by default. When you are ready for real world tests, replace the placeholder in `src/lib/api.ts` with your actual AudD Audio Recognition API Key.
