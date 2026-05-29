import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // ← これを追加

export default defineConfig({
  plugins: [
    tailwindcss(), // ← これを追加
    react()
  ],
})