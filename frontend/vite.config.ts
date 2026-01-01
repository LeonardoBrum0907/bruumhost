/// <reference types="vitest/config" />

import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
   plugins: [
      tailwindcss(),
      react(),
   ],
   test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/tests/setup.ts',
   },
   resolve: {
      alias: {
         '@': path.resolve(__dirname, './src'),
      },
   },
})