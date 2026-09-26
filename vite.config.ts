import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Remote astronomy archives do not send CORS headers: route them through a same-origin proxy.
const proxy = {
  '/proxy/exo': { target: 'https://exoplanetarchive.ipac.caltech.edu', changeOrigin: true, rewrite: (p: string) => p.replace(/^\/proxy\/exo/, '') },
  '/proxy/horizons': { target: 'https://ssd.jpl.nasa.gov', changeOrigin: true, rewrite: (p: string) => p.replace(/^\/proxy\/horizons/, '') },
  '/proxy/gaia': { target: 'https://gea.esac.esa.int', changeOrigin: true, rewrite: (p: string) => p.replace(/^\/proxy\/gaia/, '') },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy },
  preview: { proxy },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
})
