import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_PORT = Number(process.env.API_PORT ?? 3333);

export default defineConfig({
  root: 'src/web',
  plugins: [react()],
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // Em produção o Caddy serve o build e encaminha /api para a API, no mesmo domínio.
    proxy: {
      '/api': { target: `http://localhost:${API_PORT}`, changeOrigin: false },
    },
  },
});
