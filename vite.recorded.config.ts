import { defineConfig } from 'vite';

// Dependency-light standalone preview of the same recorded entry used by the
// full multipage build. No simulator, React, provider or account runtime needed.
export default defineConfig({
  publicDir: false,
  define: { 'import.meta.env.VITE_RECORDED_STANDALONE': JSON.stringify('true') },
  build: { outDir: 'dist-recorded', rollupOptions: { input: 'recorded.html' } },
});
