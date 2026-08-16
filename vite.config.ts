import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { classifyApi } from './server/vitePlugin'

export default defineConfig(({ mode }) => {
  // VITE_ 접두사 없이 읽습니다 — 이 값은 서버 프로세스에만 머무르고
  // 클라이언트 번들에는 절대 주입되지 않습니다.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      classifyApi(env.ANTHROPIC_API_KEY, env.BIUM_MODEL || undefined),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['apple-touch-icon.png', 'favicon-64.png'],
        manifest: {
          name: '비움 BIUM',
          short_name: '비움',
          description:
            '사진 한 장으로 버리는 법을 알려드립니다. 종량제로 가는 물건을 줄이는 앱.',
          lang: 'ko',
          dir: 'ltr',
          start_url: './',
          scope: './',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#f4f5f2',
          theme_color: '#0f7a55',
          categories: ['utilities', 'lifestyle'],
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
          // 판별 API 는 절대 캐시하지 않습니다 — 오래된 판별 결과를 보여주면 안 됩니다
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /\/api\/.*/,
              handler: 'NetworkOnly',
            },
          ],
        },
        devOptions: {
          // 개발 중에는 서비스워커를 끕니다 (HMR 과 충돌)
          enabled: false,
        },
      }),
    ],
    server: { port: 5173 },
  }
})
