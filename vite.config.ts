import { pwa } from './scripts/pwa.ts';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import {defineConfig} from 'vite';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig(() => {
  return {
    define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(version) },
    plugins: [react(), tailwindcss(), pwa()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    server: {
      // Dual-stack binding avoids separate IPv4/IPv6 servers sharing localhost.
      host: '::',
      port: 3000,
      strictPort: false,
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
