/**
 * Diagrama espacio-fase (VDI 3260) interactivo del equipo de manipulación, en SVG.
 *
 * Reproduce el diagrama del enunciado: 13 líneas de fase (13 = 1) y 12 movimientos de los
 * actuadores A, B, C y D, con los enlaces de señal y las temporizaciones T1 y T2.
 * El SVG usa viewBox (escala con el ancho disponible) y toma los colores de los tokens CSS.
 */
import { escapeHtml } from './card.js';

/** Trazas: puntos [línea de fase, nivel]. */
const FILAS = [
  { nombre: 'Pinza', desig: 'A', s0: 'S1', s1: 'S2', puntos: [[1, 0], [2, 0], [3, 1], [5, 1], [6, 0], [8, 0], [9, 1], [11, 1], [12, 0], [13, 0]] },
  { nombre: 'Eje vertical', desig: 'B', s0: 'B1', s1: 'B2', puntos: [[1, 0], [2, 1], [3, 1], [4, 0], [7, 0], [8, 1], [9, 1], [10, 0], [13, 0]] },
  { nombre: 'Eje horizontal', desig: 'C', s0: 'B3', s1: 'B4', puntos: [[1, 0], [10, 0], [11, 1], [12, 1], [13, 0]] },
  { nombre: 'Unidad giratoria', desig: 'D', s0: 'S3', s1: 'B5', puntos: [[1, 0], [4, 0], [5, 1], [6, 1], [7, 0], [10, 0], [11, 1], [12, 1], [13, 0]] },
];

/** Enlaces de señal sobre la línea de fase x: de (fila, nivel) a (fila, nivel). */
const ENLACES = [
  { x: 2, de: [1, 1], a: [0, 0], rotulo: 'B2' },
  { x: 3, de: [0, 1], a: [1, 1], rotulo: 'S2' },
  { x: 4, de: [1, 0], a: [3, 0], rotulo: 'B1' },
  { x: 5, de: [3, 1], a: [0, 1], rotulo: 'B5' },
  { x: 6, de: [0, 0], a: [3, 1], rotulo: 'S1' },
  { x: 7, de: [3, 0], a: [1, 0], rotulo: 'S3' },
  { x: 8, de: [1, 1], a: [0, 0], rotulo: 'B2' },
  { x: 9, de: [0, 1], a: [1, 1], rotulo: 'S2' },
  { x: 10, de: [1, 0], a: [3, 0], rotulo: 'B1' },
  { x: 11, de: [3, 1], a: [0, 1], rotulo: 'B4·B5' },
  { x: 12, de: [0, 0], a: [3, 1], rotulo: 'S1' },
];

/** Lectura de cada movimiento: señal que lo inicia, efecto, bobinas y etapas del GRAFCET. */
export const PASOS = [
  { n: 1, causa: 'S_START (X31) · B_PIEZA · S1·B1·B3·S3', efecto: 'B baja a la canaleta 1', salidas: 'Y2', etapas: [1] },
  { n: 2, causa: 'B2: pinza abajo', efecto: 'A cierra y sujeta la pieza', salidas: 'Y2, Y1', etapas: [2] },
  { n: 3, causa: 'S2: pinza cerrada', efecto: 'B sube con la pieza', salidas: 'Y1', etapas: [3] },
  { n: 4, causa: 'B1: eje B arriba', efecto: 'D gira hacia las canaletas 2/3', salidas: 'Y1, Y5, Y6', etapas: [4] },
  { n: 5, causa: 'B5 y T1 = 1,5 s', efecto: 'A abre: pieza en la canaleta 2', salidas: 'Y1 (T1) → ninguna', etapas: [5, 6] },
  { n: 6, causa: 'S1: pinza abierta', efecto: 'D vuelve a la canaleta 1', salidas: 'Y7, Y4', etapas: [7] },
  { n: 7, causa: 'S3: D en canaleta 1', efecto: 'B baja a la canaleta 1', salidas: 'Y2', etapas: [8] },
  { n: 8, causa: 'B2: pinza abajo', efecto: 'A cierra y sujeta la pieza', salidas: 'Y2, Y1', etapas: [9] },
  { n: 9, causa: 'S2: pinza cerrada', efecto: 'B sube con la pieza', salidas: 'Y1', etapas: [10] },
  { n: 10, causa: 'B1: eje B arriba', efecto: 'C extiende y D gira a la vez', salidas: 'Y1, Y3, Y5, Y6', etapas: [11] },
  { n: 11, causa: 'B4 · B5 y T2 = 1,5 s', efecto: 'A abre: pieza en la canaleta 3', salidas: 'Y1, Y3 (T2) → Y3', etapas: [12, 13] },
  { n: 12, causa: 'S1: pinza abierta', efecto: 'C retrae y D vuelve: C1 + 1', salidas: 'Y7, Y4', etapas: [14] },
];

// Geometría del lienzo
const W = 940;
const X0 = 250; // línea de fase 1
const UX = 52;
const Y0 = 50;
const ALTO_FILA = 76;
const H = Y0 + FILAS.length * ALTO_FILA + 38;
const px = (linea) => X0 + (linea - 1) * UX;
const py = (fila, nivel) => Y0 + fila * ALTO_FILA + (nivel ? 20 : 58);

function svg() {
  const yFin = Y0 + FILAS.length * ALTO_FILA;
  const lineas = [];
  for (let l = 1; l <= 13; l++) {
    const x = px(l);
    lineas.push(`<line class="vdi__paso" x1="${x}" y1="${Y0}" x2="${x}" y2="${yFin}"/>`);
    lineas.push(`<text class="vdi__num" x="${x}" y="${Y0 - 14}" text-anchor="middle">${l === 13 ? '13=1' : l}</text>`);
  }
  const filas = FILAS.map((f, i) => {
    const yTop = Y0 + i * ALTO_FILA;
    const d = f.puntos.map(([x, n], k) => `${k ? 'L' : 'M'}${px(x)} ${py(i, n)}`).join(' ');
    return `
      <line class="vdi__sep" x1="8" y1="${yTop}" x2="${W - 8}" y2="${yTop}"/>
      <text class="vdi__nombre" x="18" y="${yTop + 43}">${escapeHtml(f.nombre)}</text>
      <text class="vdi__desig" x="196" y="${yTop + 44}" text-anchor="middle">${f.desig}</text>
      <text class="vdi__nivel" x="${X0 - 14}" y="${py(i, 1) + 4}" text-anchor="end">1</text>
      <text class="vdi__nivel" x="${X0 - 14}" y="${py(i, 0) + 4}" text-anchor="end">0</text>
      <text class="vdi__rotulo" x="${px(13) + 12}" y="${py(i, 1) + 4}">${f.s1}</text>
      <text class="vdi__rotulo" x="${px(13) + 12}" y="${py(i, 0) + 4}">${f.s0}</text>
      <path class="vdi__traza" d="${d}"/>`;
  }).join('');
  const enlaces = ENLACES.map((e) => {
    const x = px(e.x);
    const y1 = py(...e.de);
    const y2 = py(...e.a);
    const dir = y2 > y1 ? 1 : -1;
    // El rótulo va justo después del origen de la flecha: cae en el hueco entre niveles, nunca sobre una traza.
    const yr = y1 + dir * 16;
    return `
      <line class="vdi__enlace" x1="${x}" y1="${y1}" x2="${x}" y2="${y2 - dir * 7}" marker-end="url(#vdi-flecha)"/>
      <text class="vdi__rotulo" x="${x + 6}" y="${yr + 4}">${escapeHtml(e.rotulo)}</text>`;
  }).join('');
  const tiempos = [5, 11]
    .map(
      (l, k) => `
      <line class="vdi__temporizador" x1="${px(l)}" y1="${Y0}" x2="${px(l)}" y2="${yFin}"/>
      <text class="vdi__tiempo" x="${px(l)}" y="${yFin + 24}" text-anchor="middle">T${k + 1} = 1,5 s</text>`
    )
    .join('');
  return `
  <svg class="vdi__svg" viewBox="0 0 ${W} ${H}" role="img"
       aria-label="Diagrama espacio-fase de los actuadores A, B, C y D en 13 líneas de fase, con T1 y T2 de 1,5 s">
    <defs>
      <marker id="vdi-flecha" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto">
        <path class="vdi__punta" d="M0 0 L10 5 L0 10 z"/>
      </marker>
    </defs>
    <rect class="vdi__banda" data-banda x="${px(1)}" y="${Y0}" width="${UX}" height="${yFin - Y0}"/>
    <rect class="vdi__marco" x="8" y="${Y0}" width="${W - 16}" height="${yFin - Y0}"/>
    <line class="vdi__sep vdi__sep--fuerte" x1="${X0 - 34}" y1="${Y0}" x2="${X0 - 34}" y2="${yFin}"/>
    <text class="vdi__cab" x="18" y="${Y0 - 14}">Elemento</text>
    ${lineas.join('')}${tiempos}${filas}${enlaces}
    <circle class="vdi__inicio" cx="${px(1)}" cy="${py(1, 0)}" r="5"/>
  </svg>`;
}

/**
 * Monta el diagrama dentro de `root`.
 * @param {HTMLElement} root
 * @param {{ duraciones?: Record<number, number> }} [opts] duración simulada de cada etapa de GP (s)
 * @returns {() => void} función de limpieza
 */
export function montarDiagramaFases(root, { duraciones = {} } = {}) {
  root.classList.add('vdi');
  root.innerHTML = `
    <div class="vdi__lienzo">${svg()}</div>
    <div class="vdi__barra" role="group" aria-label="Movimientos de la secuencia">
      <button class="btn btn--small" type="button" data-play aria-pressed="false">Reproducir</button>
      ${PASOS.map((p) => `<button class="vdi__btn" type="button" data-paso="${p.n}" aria-pressed="false">${p.n}</button>`).join('')}
    </div>
    <dl class="vdi__detalle" aria-live="polite">
      <div><dt>Causa</dt><dd data-causa></dd></div>
      <div><dt>Efecto</dt><dd data-efecto></dd></div>
      <div><dt>Bobinas</dt><dd data-salidas></dd></div>
      <div><dt>Etapa GP · duración</dt><dd data-duracion></dd></div>
    </dl>`;

  const banda = root.querySelector('[data-banda]');
  const botones = [...root.querySelectorAll('[data-paso]')];
  const play = root.querySelector('[data-play]');
  let actual = 1;
  let temporizador = 0;

  function seleccionar(n) {
    actual = n;
    const p = PASOS[n - 1];
    banda.setAttribute('x', px(n));
    botones.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.paso) === n)));
    root.querySelector('[data-causa]').textContent = p.causa;
    root.querySelector('[data-efecto]').textContent = p.efecto;
    root.querySelector('[data-salidas]').textContent = p.salidas;
    const t = p.etapas.reduce((acc, e) => acc + (duraciones[e] ?? 0), 0);
    const seg = t ? `${t.toFixed(2).replace('.', ',')} s` : '—';
    root.querySelector('[data-duracion]').textContent = `${p.etapas.join(' + ')} · ${seg}`;
  }
  function detener() {
    clearInterval(temporizador);
    temporizador = 0;
    play.setAttribute('aria-pressed', 'false');
    play.textContent = 'Reproducir';
  }
  play.addEventListener('click', () => {
    if (temporizador) return detener();
    play.setAttribute('aria-pressed', 'true');
    play.textContent = 'Detener';
    temporizador = setInterval(() => seleccionar((actual % PASOS.length) + 1), 1300);
  });
  botones.forEach((b) =>
    b.addEventListener('click', () => {
      detener();
      seleccionar(Number(b.dataset.paso));
    })
  );
  seleccionar(1);
  return detener;
}
