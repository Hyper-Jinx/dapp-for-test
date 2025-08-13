import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['buffer'],
  },
  // Allow overriding base path for GitHub Pages (e.g. "/repo-name/")
  base: process.env.BASE_PATH || '/',
})
