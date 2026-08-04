import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const phoenixOrigin = 'http://localhost:4000'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'watch-phoenix-stdin',
      configureServer() {
        // Keeps stdin open; Node exits when Phoenix dies and closes the stream
        process.stdin.resume()
        process.stdin.on('close', () => process.exit(0))
      },
    },
  ],
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
    environmentOptions: {
      jsdom: { url: 'http://localhost:5173' },
    },
  },
})