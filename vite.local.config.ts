import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { localPreview } from './scripts/local-preview';

// Use the real client, Vite hot reload, and only local fixtures.
export default defineConfig({
  root: fileURLToPath(new URL('./src/client', import.meta.url)),
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  cacheDir: fileURLToPath(new URL('./dist/local-vite-cache', import.meta.url)),
  plugins: [react(), tailwind(), localPreview()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
