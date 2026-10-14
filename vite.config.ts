import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // The current local evidence UI uses inline icons and generated CSS/JS only.
  // Keep unused legacy brand images out of review builds pending rights review.
  publicDir: false,
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
