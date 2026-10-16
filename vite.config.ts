import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // The current local evidence UI uses inline icons and generated CSS/JS only.
  // Keep unused legacy brand images out of review builds pending rights review.
  publicDir: false,
  build: { rollupOptions: { input: { main: 'index.html', recorded: 'recorded.html' } } },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
