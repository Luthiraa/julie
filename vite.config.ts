import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron({
      entry: {
        main: 'electron/main.ts',
        preload: 'electron/preload.ts',
      },
      vite: {
        build: {
          rollupOptions: {
            external: [
              'puppeteer-core',
              'ollama',
              'groq-sdk',
              'dotenv',
              'node:fs',
              'node:path',
              'node:os',
              'node:child_process',
              'node:url',
              'electron',
              'fluent-ffmpeg',
              'bufferutil',
              'utf-8-validate'
            ]
          }
        }
      }
    }),
    renderer(),
  ],
})
