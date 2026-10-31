/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// O app é publicado em https://caiozuniga.github.io/ingles-app/
const version = JSON.parse(readFileSync('./package.json', 'utf8')).version as string
const build = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'local'
  }
})()
// Data do commit (ISO): fixa para cada versão, mesmo se o app for gerado de novo.
const buildDate = (() => {
  try {
    return execSync('git log -1 --format=%cI', { encoding: 'utf8' }).trim()
  } catch {
    return new Date().toISOString()
  }
})()

export default defineConfig({
  base: '/ingles-app/',
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_BUILD__: JSON.stringify(build),
    __APP_BUILD_DATE__: JSON.stringify(buildDate),
  },
  plugins: [
    react(),
    tailwindcss(),
    // version.json publicado junto do app: a tela de Ajustes compara com o build em uso.
    {
      name: 'version-file',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version, build }) })
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/ingles-app/',
        name: 'Fluent — inglês sob medida',
        short_name: 'Fluent',
        description: 'Inglês personalizado: vocabulário, gramática, listening, writing e speaking com correção por IA.',
        lang: 'pt-BR',
        start_url: './',
        scope: './',
        theme_color: '#0e1014',
        background_color: '#0e1014',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['education'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App inteiro, incluindo o banco de conteúdo, fica no aparelho depois da primeira visita.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
