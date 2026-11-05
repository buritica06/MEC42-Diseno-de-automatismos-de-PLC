/**
 * Componentes de contenido reutilizables (devuelven HTML como texto).
 * Los textos que reciben son siempre contenido del propio sitio (no del usuario);
 * aun así se escapan los campos de texto plano.
 */
import { icon } from '../ui/icons.js';

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * Tarjeta de contenido con jerarquía título → subtítulo → resumen → acción.
 * @param {{ eyebrow?, titulo, subtitulo?, resumen?, href?, accion?, icono?, estado?: 'completado'|'visitado'|null, meta? }} p
 */
export function card({ eyebrow, titulo, subtitulo, resumen, href, accion = 'Abrir', icono, estado, meta }) {
  const badge =
    estado === 'completado'
      ? `<span class="badge badge--done">${icon('check')} Completado</span>`
      : estado === 'visitado'
        ? `<span class="badge">En curso</span>`
        : meta
          ? `<span class="badge">${icon('clock')} ${escapeHtml(meta)}</span>`
          : '<span></span>';
  return `<article class="card">
    <div class="card__head">
      ${icono ? `<span class="card__icon" aria-hidden="true">${icon(icono)}</span>` : ''}
      <div>
        ${eyebrow ? `<div class="card__eyebrow">${escapeHtml(eyebrow)}</div>` : ''}
        <h3 class="card__title">${escapeHtml(titulo)}</h3>
      </div>
    </div>
    ${subtitulo ? `<p class="card__subtitle">${escapeHtml(subtitulo)}</p>` : ''}
    ${resumen ? `<p class="card__summary">${escapeHtml(resumen)}</p>` : ''}
    <div class="card__footer">
      ${badge}
      ${href ? `<a class="btn btn--small btn--primary" href="${href}">${escapeHtml(accion)} ${icon('chevronRight')}<span class="visually-hidden">: ${escapeHtml(titulo)}</span></a>` : ''}
    </div>
  </article>`;
}

/** Bloque destacado: 'def' (definición), 'thm' (teorema/propiedad), 'ex' (ejemplo), 'warn' (atención). */
export function callout(tipo, titulo, html) {
  return `<aside class="callout callout--${tipo}" role="note">
    <span class="callout__title">${escapeHtml(titulo)}</span>${html}</aside>`;
}
