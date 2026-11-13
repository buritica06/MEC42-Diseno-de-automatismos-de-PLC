/**
 * Utilidades comunes de los diagramas SVG (diagrama espacio-fase).
 * Los colores se toman de los tokens --viz-* del tema activo mediante CSS,
 * así que el cambio claro/oscuro no requiere volver a dibujar.
 */
import { escapeHtml } from '../components/card.js';

export const esc = escapeHtml;

/** Índice de color de los datos → token CSS. 0 = neutro. */
export const colorVar = (i) =>
  [
    'var(--viz-grid-strong)',
    'var(--viz-series-1)',
    'var(--viz-series-2)',
    'var(--viz-series-3)',
    'var(--viz-series-4)',
    'var(--viz-series-5)',
    'var(--viz-accent)',
  ][i] ?? 'var(--viz-axis)';

/** Formato numérico local con coma decimal opcional. */
export const fmt = (v, dec = 1) => v.toFixed(dec);

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Ejecuta `fn` la primera vez que `el` entra en pantalla (animaciones de entrada).
 * Devuelve la función de limpieza.
 */
export function alAparecer(el, fn) {
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        fn();
      }
    },
    { threshold: 0.2 }
  );
  io.observe(el);
  return () => io.disconnect();
}

/** Grupo de botones segmentados accesible (role="tablist" simplificado con aria-pressed). */
export function segmentado(opciones, actual, etiqueta) {
  return `<div class="seg" role="group" aria-label="${esc(etiqueta)}">${opciones
    .map(
      (o) =>
        `<button type="button" class="seg__btn" data-valor="${esc(o.valor)}" aria-pressed="${o.valor === actual}">${esc(o.texto)}</button>`
    )
    .join('')}</div>`;
}
