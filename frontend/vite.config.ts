import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The API is served by FastAPI on :8000. Proxying `/api` through the dev
// server means the browser only ever talks to one origin, so there is no CORS
// negotiation in development and no API host to configure in the client.
export default defineConfig({
  plugins: [react()],
  server: {
    // Honour a PORT handed down by the launcher; fall back to Vite's default.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
