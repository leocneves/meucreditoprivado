
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Define a base como './' para que o build funcione em qualquer subpasta (como /meucreditoprivado/)
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
});
