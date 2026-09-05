/// <reference types="vitest/config" />
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
  // Tests run through this same config, so a module resolves in a test exactly
  // as it does in the build — one plugin pipeline, one set of aliases.
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Plain Node by default: most of what is worth testing here is arithmetic
    // and translation, which needs no DOM. The two suites that do need one
    // opt in per file with a `@vitest-environment jsdom` docblock, so the
    // majority of the suite does not pay for a browser it never touches.
    environment: 'node',
  },
})
