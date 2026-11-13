import { realpathSync } from 'node:fs';
import { defineConfig, searchForWorkspaceRoot } from 'vite';

/**
 * node_modules puede ser un enlace (junction) a otra carpeta para ahorrar espacio en
 * OneDrive. Vite sirve los archivos por su ruta real y bloquea (403) los que quedan fuera
 * de la raíz, como las fuentes de KaTeX, Inter y JetBrains Mono: se permite esa ruta real.
 */
const rutasPermitidas = [searchForWorkspaceRoot(process.cwd())];
try {
  rutasPermitidas.push(realpathSync('node_modules'));
} catch {
  /* sin node_modules todavía (antes de npm install) */
}

/**
 * Base path:
 *  - Por defecto './' (rutas relativas): el build funciona en cualquier subcarpeta,
 *    incluido https://<usuario>.github.io/<repositorio>/, sin configurar nada,
 *    porque la navegación usa hash (#/capitulo/…) y no necesita reescrituras del servidor.
 *  - Se puede forzar con la variable de entorno BASE_PATH (p. ej. BASE_PATH=/mi-repo/).
 */
const base = process.env.BASE_PATH || './';

export default defineConfig({
  base,
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: false,
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 900,
  },
  // Pre-empaqueta en desarrollo las dependencias que solo se importan de forma
  // perezosa; así Vite no recarga la página al descubrirlas la primera vez.
  optimizeDeps: {
    include: ['three', 'troika-three-text', 'mathjs', 'lil-gui', 'gsap', 'katex'],
  },
  server: {
    port: 5173,
    open: false,
    fs: { allow: rutasPermitidas },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
