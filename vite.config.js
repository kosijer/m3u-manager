import { defineConfig } from 'vite';

export default defineConfig({
  // Relativne putanje rade i na https://<user>.github.io/<repo>/ i lokalno.
  base: './',
  build: {
    outDir: 'dist',
  },
});
