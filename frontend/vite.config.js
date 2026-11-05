import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const frontendRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        login: resolve(frontendRoot, 'index.html'),
        register: resolve(frontendRoot, 'register.html'),
      },
    },
  },
});
