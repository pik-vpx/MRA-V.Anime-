import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  // Vite automatically injects import.meta.env from .env files.
  // No custom define needed.
});
