import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Forces the Service Worker to update automatically without prompting the user
      registerType: 'autoUpdate',
      
      // Disabled in dev because dev-mode Service Workers cause false-negative crashes
      devOptions: {
        enabled: false, 
      },
      
      manifest: {
        name: 'SCANKOTO Attendance System',
        short_name: 'SCANKOTO',
        description: 'Offline-first PWA attendance checker for CSU-ISS.',
        theme_color: '#1a1a1a', 
        background_color: '#1a1a1a', 
        display: 'standalone',
        start_url: '/',
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
        // THESE TWO LINES ARE CRITICAL: They force the SW to take over the browser immediately
        clientsClaim: true,
        skipWaiting: true,
        
        // Tells the browser to load your React app for ANY URL while offline
        navigateFallback: '/index.html',
        
        // Caches all compiled production assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
    })
  ],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['.loca.lt', '.trycloudflare.com']
  },
  preview: {
    host: true,
    port: 5173,
    allowedHosts: ['.loca.lt', '.trycloudflare.com']
  }
})