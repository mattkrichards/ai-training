import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'

// Served from https://hub.richardssupply.com/meeting-runner/ (GitHub Pages, ai-training repo).
export default defineConfig({
  base: '/meeting-runner/',
  logLevel: 'error',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
