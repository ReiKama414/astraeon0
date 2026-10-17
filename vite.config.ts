import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { writeFileSync, mkdirSync } from 'node:fs'
import type { Plugin } from 'vite'

/** Dev-only: POST /__shot?name=x with a PNG data URL body saves it to .shots/ for visual QA. */
function shotSink(): Plugin {
  return {
    name: 'astralis-shot-sink',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__shot', (req, res) => {
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          const name = new URL(req.url ?? '', 'http://x').searchParams.get('name') ?? 'shot'
          mkdirSync('.shots', { recursive: true })
          writeFileSync(`.shots/${name.replace(/[^a-z0-9-_]/gi, '')}.png`, Buffer.from(body.replace(/^data:image\/png;base64,/, ''), 'base64'))
          res.end('ok')
        })
      })
    },
  }
}

// Remote astronomy archives do not send CORS headers: route them through a same-origin proxy.
const proxy = {
  '/proxy/exo': { target: 'https://exoplanetarchive.ipac.caltech.edu', changeOrigin: true, rewrite: (p: string) => p.replace(/^\/proxy\/exo/, '') },
  '/proxy/horizons': { target: 'https://ssd.jpl.nasa.gov', changeOrigin: true, rewrite: (p: string) => p.replace(/^\/proxy\/horizons/, '') },
  '/proxy/gaia': { target: 'https://gea.esac.esa.int', changeOrigin: true, rewrite: (p: string) => p.replace(/^\/proxy\/gaia/, '') },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), shotSink()],
  server: { proxy },
  preview: { proxy },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
})
