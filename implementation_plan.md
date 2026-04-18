# MRA Clone "Anime Edition" Implementation Plan

This document outlines the proposed implementation plan for creating a Windows desktop application that clones the core features of Jadquir's MRA (Music Recognition Application), while adding custom features to detect and copy the anime a song originates from.

## Goal
Build a beautiful, natively-feeling Windows desktop application that:
1. Listens to microphone or desktop audio.
2. Identifies the playing track instantly.
3. Displays song details, platform links (Spotify, Apple Music, etc.), and lyrics.
4. **Unique Feature:** Automatically searches for and displays the Anime name the song belongs to.
5. **Unique Feature:** Provides a "Copy" button specifically for the Anime name.

> [!IMPORTANT]
> **User Review Required**
> Please review the proposed architecture and APIs below. We will need your confirmation on the tech stack and third-party APIs (like Shazam / AudD for recognition) before we proceed.

---

## Proposed Architecture

### Tech Stack
To deliver the requested **WOW** factor and premium aesthetic (animations, glassmorphism, modern design), we propose using web technologies packaged as a desktop app:
* **Framework:** Electron with Vite, React, and TypeScript.
* **Styling:** Vanilla CSS / TailwindCSS (if requested) + Framer Motion for micro-animations.
* **Audio Capture Mechanism:** WebRTC `navigator.mediaDevices` inside Electron (supports both Mic and Desktop audio capture seamlessly).

### Core Systems & APIs

*   **Audio Recognition (Shazam / AudD):**
    We will capture a 5-10 second snippet of audio buffer and send it to an audio recognition API. We recommend using **AudD** or the unofficial **Shazam API** via RapidAPI (requires a free API key with a monthly limit). Both return track title, artist, album art, and platform links.
*   **Anime Detection (VGMdb / Jikan API):**
    Once we have the Track Name and Artist, we will query an anime database (like the **Jikan REST API for MyAnimeList** or **VGMdb API**) to cross-reference if the track is known as an Anime Opening (OP), Ending (ED), or Original Soundtrack (OST).
*   **Lyrics Fetching (Lrclib):**
    We will use a free lyrics API such as **Lrclib** to fetch synchronized or plain lyrics to match the current track.

---

## File Structure & Components

The codebase will be initialized as a modern `electron-vite` project.

### Electron Main Process (`/src/main`)
*   `main.ts`: Initializes the Windows app, removes standard window framing to allow custom titlebars, and manages system tray features if needed.
*   `audioHandler.ts`: Handles permissions and logic for routing desktop vs. microphone audio streams.

### React Renderer (`/src/renderer`)
*   `App.tsx`: Main layout, handling the core state (Listening -> Analyzing -> Result).
*   **Components:**
    *   `RecordButton.tsx`: A vibrant, animated pulsing button that user clicks to start/stop listening.
    *   `TrackResult.tsx`: Shows Album Art (with smooth gradients derived from the image), Track Name, Artist, and Platform Links.
    *   `AnimeIntegration.tsx` **[NEW]**: A specific UI card that displays the detected Anime title, origin (e.g., OP 1, ED 2), and the **Copy Anime Name** button.
    *   `LyricsView.tsx`: Displays scrolling or static lyrics.

---

## Open Questions

> [!CAUTION]
> **To proceed, I need your input on the following items:**

1. **APIs**: Are you okay with using a third-party recognition service like RapidAPI's Shazam API (which will require you to get a free API key) or would you prefer me to look into something else?
2. **Tech Stack**: Does the Electron + React stack sound good to you? It allows for the most visually stunning interfaces with very responsive developer tooling.
3. **Anime Matching**: Anime song titles frequently appear under various aliases (Japanese Romaji vs. English). If a song belongs to multiple animes or a game, do you want to list all of them, or just the top match?

---

## Verification Plan

### Automated/Unit Verification
*   We will test with sample MP3s (mic input simulation) covering popular anime tracks (e.g., *Gurenge* from Demon Slayer) to ensure the Title -> Anime Name pipeline works accurately.

### Manual Verification
*   **Mic Check**: Launching the app on Windows, speaking or playing music on a phone nearby, and verifying it successfully identifies the track.
*   **Desktop Audio Check**: Playing a YouTube video of an Anime opening and ensuring the app captures the Desktop audio stream, identifies it, shows the correct anime, and that the copy button correctly populates the clipboard.
