import { defineConfig } from 'vite';

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
    // Three.js y troika viajan en el chunk perezoso de la escena 3D.
    chunkSizeWarningLimit: 900,
  },
  // Pre-empaqueta en desarrollo las dependencias que solo se importan de forma
  // perezosa; así Vite no recarga la página al descubrirlas la primera vez.
  optimizeDeps: {
    include: ['three', 'troika-three-text', 'lil-gui', 'gsap', 'katex'],
  },
  server: {
    port: 5173,
    open: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
