import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), wasm()],
  optimizeDeps: {
    exclude: ['sql.js']
  },
  resolve: {
    alias: {
      '@scorer/schema': path.resolve(__dirname, '../../packages/schema/src'),
      '@scorer/rules-netball': path.resolve(__dirname, '../../packages/rules-netball/src'),
      '@scorer/ui': path.resolve(__dirname, '../../packages/ui/src')
    }
  }
})