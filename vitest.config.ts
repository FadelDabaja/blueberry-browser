import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    teardownTimeout: 10000,
  },
  resolve: {
    alias: {
      '@common': resolve(__dirname, 'src/renderer/common'),
    },
  },
})
