import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-maskable.svg', 'dj-noa-bg.jpg', 'push-sw.js'],
      manifest: {
        name: 'DJ NOA',
        short_name: 'DJ NOA',
        description: 'Agenda inteligente y local-first para eventos, tareas, recordatorios y operaciones.',
        theme_color: '#07090c',
        background_color: '#07090c',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,jpg,jpeg,png,webp,woff2}'],
        cleanupOutdatedCaches: true,
        importScripts: ['push-sw.js']
      }
    })
  ]
});
