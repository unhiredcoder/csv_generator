import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://10.10.15.140:5000',
        changeOrigin: true,
        secure: false,
      },
      '/downloads': {
        target: 'http://10.10.15.140:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})