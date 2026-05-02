import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'esnext',
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'tldraw', '@tldraw/editor', '@tldraw/state', '@tldraw/state-react', '@tldraw/store', '@tldraw/tlschema', '@tldraw/utils', '@tldraw/validate'],
  },
})
