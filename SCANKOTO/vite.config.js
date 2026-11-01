import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Enables the service worker during 'npm run dev' for immediate testing
      devOptions: {
        enabled: true 
      },
      manifest: {
        name: 'SCANKOTO Attendance System',
        short_name: 'SCANKOTO',
        description: 'Offline-first PWA attendance checker for CSU-ISS.',
        theme_color: '#1a1a1a', 
        background_color: '#1a1a1a', 
        display: 'standalone',
        icons: [
          {
            src: '/vite.svg', 
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: '/vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        // Automatically caches all code and styling assets for offline rendering
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['.loca.lt', '.trycloudflare.com']
  }
})