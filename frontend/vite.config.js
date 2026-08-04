import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PWA config makes the same React build installable on staff devices
// (works offline for cached views, gets an app icon on Android home screens)
// without needing a separate native codebase for that use case.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Apartment Manager',
        short_name: 'AptManager',
        description: 'Manage leases, billing, complaints and notices',
        theme_color: '#1F2937',
        background_color: '#F8F7F4',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/notices') || url.pathname.startsWith('/api/property'),
            handler: 'NetworkFirst',
            options: { cacheName: 'api-read-cache', expiration: { maxEntries: 50, maxAgeSeconds: 3600 } }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:5000', ws: true }
    }
  }
});
