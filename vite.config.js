import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Configuracion de Vite: puerto 5173 y alias "@" hacia /src
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  build: {
    // es2022 habilita el "top-level await" que usa /services/index.js
    // para cargar Firebase solo cuando VITE_USE_MOCK=false.
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  esbuild: {
    supported: { 'top-level-await': true },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
  },
})
