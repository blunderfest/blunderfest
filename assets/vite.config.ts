import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const phoenixOrigin = 'http://localhost:4000'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../priv/static',
    emptyOutDir: false,
    rollupOptions: {
      input: 'index.html',
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: phoenixOrigin, changeOrigin: true },
      '/socket': { target: phoenixOrigin, changeOrigin: true, ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
})