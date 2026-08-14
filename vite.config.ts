import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

/**
 * `public/reference/` guarda la ilustración maestra de los personajes: hace
 * falta en el repositorio para poder regenerarlos con `npm run characters`,
 * pero no pinta nada en el sitio publicado (son 2 MB que el juego no carga).
 * Vite copia `public/` entero, así que se borra del build al terminar.
 */
function excludeReferenceArt(): Plugin {
  return {
    name: 'excluir-referencia',
    apply: 'build',
    closeBundle() {
      const root = dirname(fileURLToPath(import.meta.url));
      rmSync(resolve(root, 'dist/reference'), { recursive: true, force: true });
    }
  };
}

// `base: './'` produce rutas relativas, así que el build funciona igual en la
// raíz de un dominio que en https://<usuario>.github.io/<repo>/.
export default defineConfig({
  base: './',
  plugins: [excludeReferenceArt()],
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
