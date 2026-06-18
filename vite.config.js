import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function envConfigPlugin() {
  return {
    name: 'env-config',
    configResolved(config) {
      const fioKey = config.env.VITE_FIO_API_KEY || ''
      const ppKey = config.env.VITE_PRUNPLANNER_API_KEY || ''
      const out = path.resolve(config.root, 'public/config.js')
      fs.writeFileSync(out, `window.FIO_API_KEY = ${JSON.stringify(fioKey)};\nwindow.PRUNPLANNER_API_KEY = ${JSON.stringify(ppKey)};\n`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), envConfigPlugin()],
})
