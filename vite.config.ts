import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/cofre-pessoal/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Cofre Pessoal',
        short_name: 'Cofre Pessoal',
        description: 'Gerenciador de senhas local — os dados nunca saem do seu aparelho.',
        lang: 'pt-BR',
        theme_color: '#0C0C0D',
        background_color: '#0C0C0D',
        display: 'standalone',
        start_url: '/cofre-pessoal/',
        scope: '/cofre-pessoal/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
});
