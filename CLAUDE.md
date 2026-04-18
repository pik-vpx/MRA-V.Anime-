# MRA Anime Edition - Claude Code Guide

## Build & Test
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Dev**: `npm run dev`
- **Test**: No dedicated test suite (use `npm run lint` for validation).

## Coding Standards
- **Indentation**: 2 spaces.
- **Naming Conventions**:
  - **React Components**: `PascalCase` (e.g., `SettingsPage`)
  - **Variables/Functions**: `camelCase` (e.g., `processAudioBlob`)
  - **State Helpers**: `camelCase` (e.g., `listeningRef`)
- **File Structure**:
  - `src/components/`: Modular React components.
  - `src/lib/`: Logic and API integrations (audio, recognition).
  - `electron/`: Main and preload scripts for the app container.
- **Tech Stack**: React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Electron.

## Behavioral Guidelines
- **Autonomy**: Attempt to complete the full task end-to-end without stopping for minor clarifications.
- **Error Recovery**: If a build, lint, or runtime error occurs, analyze the output and attempt at least 3 distinct fixes independently before reporting failure.
- **Pattern Matching**: Always look at existing implementations in `src/lib/api.ts` or `src/App.tsx` before proposing changes to ensure consistency.
- **Chain of Thought**: When given a high-level goal, break it down into sub-tasks and execute them sequentially until the final goal is met.
- **Testing**: After making changes, proactively run `npm run lint` to verify code quality.
