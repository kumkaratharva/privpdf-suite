import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages project-site builds use the repository name as the base.
  // Set VITE_BASE_PATH=/your-repo-name/ in the GitHub Actions workflow if needed.
  base: process.env.VITE_BASE_PATH || '/',
})
