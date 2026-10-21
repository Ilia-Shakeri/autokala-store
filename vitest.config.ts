import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins:[react()],
  test:{environment:'jsdom',include:['test/frontend/**/*.test.{ts,tsx}'],setupFiles:['test/frontend/setup.ts'],pool:'threads',maxWorkers:1,testTimeout:15000,restoreMocks:true},
})
