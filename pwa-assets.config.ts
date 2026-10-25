import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Gera os PNGs do app a partir de public/icon.svg: `npm run icons`.
// Android usa 192/512 e o maskable (recortado em círculo ou squircle); o iPhone usa o apple-touch-icon de 180 px.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0.1, resizeOptions: { background: '#0f1115' } },
    apple: { ...minimal2023Preset.apple, padding: 0.1, resizeOptions: { background: '#0f1115' } },
  },
  images: ['public/icon.svg'],
})
