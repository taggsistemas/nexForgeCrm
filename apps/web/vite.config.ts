import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    manifest: { name: 'NexForge CRM', short_name: 'NexForge', lang: 'pt-BR', start_url: '/', display: 'standalone', background_color: '#f5f7fb', theme_color: '#101828', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }] },
    workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'], navigateFallbackDenylist: [/^\/api\//], cleanupOutdatedCaches: true },
  })],
  server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
});