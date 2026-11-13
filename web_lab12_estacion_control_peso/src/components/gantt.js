/**
 * Diagrama de Gantt en HTML y CSS (sin dependencias).
 *
 * Cada barra se coloca con porcentajes sobre su pista, así que el diagrama se
 * adapta a cualquier ancho; en pantallas estrechas el nombre de la tarea pasa
 * a ocupar una línea propia encima de la barra (ver .gantt en components.css).
 */
import { escapeHtml } from './card.js';

/**
 * @param {{
 *   titulo: string, unidad: string, total: number, marca: number, decimales?: number,
 *   grupos: { nombre: string, tono: 1|2|3|4|5, tareas: { nombre: string, inicio: number, fin: number }[] }[]
 * }} datos
 * @returns {string} HTML del diagrama
 */
export function gantt({ titulo, unidad, total, marca, decimales = 0, grupos }) {
  const pct = (v) => `${((v / total) * 100).toFixed(3)}%`;
  const num = (v) => v.toFixed(decimales);
  const marcas = [];
  for (let t = 0; t <= total + 1e-9; t += marca) marcas.push(t);

  const eje = marcas.map((t) => `<span class="gantt__marca" style="left:${pct(t)}">${num(t)}</span>`).join('');
  const rejilla = marcas.map((t) => `<i style="left:${pct(t)}"></i>`).join('');

  const filas = grupos
    .map(
      (g) => `
      <div class="gantt__grupo" data-tono="${g.tono}">${escapeHtml(g.nombre)}</div>
      ${g.tareas
        .map((t) => {
          const dur = t.fin - t.inicio;
          const texto = `${num(t.inicio)}–${num(t.fin)} ${unidad}`;
          return `
        <div class="gantt__fila" data-tono="${g.tono}">
          <div class="gantt__nombre">${escapeHtml(t.nombre)}</div>
          <div class="gantt__pista">
            <div class="gantt__rejilla" aria-hidden="true">${rejilla}</div>
            <div class="gantt__barra" style="left:${pct(t.inicio)};width:${pct(dur)}" title="${escapeHtml(texto)}"></div>
          </div>
          <div class="gantt__tiempo">${escapeHtml(texto)}</div>
        </div>`;
        })
        .join('')}`
    )
    .join('');

  return `
  <figure class="gantt" aria-label="${escapeHtml(titulo)}">
    <figcaption class="gantt__titulo">${escapeHtml(titulo)}</figcaption>
    <div class="gantt__fila gantt__fila--eje" aria-hidden="true">
      <div class="gantt__nombre">Tiempo (${escapeHtml(unidad)})</div>
      <div class="gantt__pista gantt__pista--eje">${eje}</div>
      <div class="gantt__tiempo"></div>
    </div>
    ${filas}
  </figure>`;
}
