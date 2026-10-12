import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // Only use singleFile plugin in build mode, not dev
    ...(command === 'build' ? [viteSingleFile()] : [])
  ],
  root: path.resolve(__dirname, 'src/ui'),
  server: {
    port: 5173,
    // Pinned: the bridge relay allows the browser client only from
    // http://localhost:5173. If vite silently fell back to 5174 the relay
    // would reject it as an unknown Origin, which reads as a bridge bug.
    // Better to fail here, loudly, with the port already in use.
    strictPort: true,
    open: true,
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/ui/index.html'),
      output: {
        entryFileNames: 'ui.js'
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
}));
