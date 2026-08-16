import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { classifyApi } from './server/vitePlugin'

export default defineConfig(({ mode }) => {
  // VITE_ 접두사 없이 읽습니다 — 이 값은 서버 프로세스에만 머무르고
  // 클라이언트 번들에는 절대 주입되지 않습니다.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      classifyApi(env.ANTHROPIC_API_KEY, env.BIUM_MODEL || undefined),
    ],
    server: { port: 5173 },
  }
})
