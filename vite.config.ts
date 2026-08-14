import { defineConfig } from 'vite';

// `base: './'` produces relative asset URLs, so the build works both at the
// domain root and at https://<user>.github.io/<repo>/ without extra config.
export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5173
  },
  build: {
    target: 'es2020',
    // Phaser pesa ~1,6 MB sin comprimir (376 kB gzip); es una sola dependencia.
    chunkSizeWarningLimit: 2000,
    assetsDir: 'bundle'
  }
});
