import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: '/kotoba/',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: 'out', emptyOutDir: true },
  server: process.env.CODEX_SANDBOX === 'seatbelt'
    ? { watch: { useFsEvents: false, usePolling: true } }
    : undefined,
});
