/**
 * Diagrama de funciones espacio-fase (VDI 3260) interactivo, en SVG.
 *
 * Las trazas y los enlaces de señal reproducen la figura de la guía. El SVG usa
 * viewBox, así que escala con el ancho disponible; los colores salen de los
 * tokens CSS del tema (claro/oscuro) mediante clases.
 */
import { escapeHtml } from './card.js';

/** Elementos del diagrama: puntos [paso, nivel] de cada traza. */
const FILAS = [
  {
    nombre: 'Cilindro de sujeción',
    desig: 'A',
    puntos: [
      [0, 0],
      [0.5, 0],
      [1.5, 1],
      [4.5, 1],
      [5.5, 0],
      [9, 0],
    ],
  },
  {
    nombre: 'Cilindro de alimentación',
    desig: 'B',
    puntos: [
      [0, 0],
      [1.5, 0],
      [2.5, 1],
      [3.5, 1],
      [4.5, 0],
      [9, 0],
    ],
  },
  {
    nombre: 'Temporizador',
    desig: 't1',
    puntos: [
      [0, 0],
      [2.5, 0],
      [2.5, 1],
      [3.5, 1],
      [3.5, 0],
      [9, 0],
    ],
  },
  {
    nombre: 'Motor de estampado',
    desig: 'D',
    puntos: [
      [0, 0],
      [2.5, 0],
      [2.5, 1],
      [3.5, 1],
      [3.5, 0],
      [9, 0],
    ],
  },
  {
    nombre: 'Cilindro expulsor',
    desig: 'C',
    puntos: [
      [0, 0],
      [5.5, 0],
      [6.5, 1],
      [7.5, 0],
      [9, 0],
    ],
  },
];

/** Enlaces de señal: de (fila, nivel) a (fila, nivel) sobre la línea de paso x. */
const ENLACES = [
  { x: 1.5, de: [0, 1], a: [1, 0], rotulo: 'B2·B7' },
  { x: 2.5, de: [1, 1], a: [2, 1], rotulo: 'B4' },
  { x: 2.5, de: [2, 0], a: [3, 1], rotulo: '' },
  { x: 3.5, de: [2, 1], a: [1, 1], rotulo: 't1' },
  { x: 3.5, de: [2, 0], a: [3, 1], rotulo: '' },
  { x: 4.5, de: [1, 0], a: [0, 1], rotulo: 'B3' },
  { x: 5.5, de: [0, 0], a: [4, 0], rotulo: 'B1' },
];

/** Lectura de cada paso: señal que lo inicia, efecto y solenoides con tensión. */
export const PASOS = [
  { n: 1, causa: 'S1 con B1·B3·B5 y guarda cerrada', efecto: 'A avanza y sujeta la pieza', salidas: 'Y1' },
  {
    n: 2,
    causa: 'B2·B7: posición y presión de apriete',
    efecto: 'B lleva el carro bajo el troquel',
    salidas: 'Y1, Y2',
  },
  { n: 3, causa: 'B4: carro en posición de estampado', efecto: 'Arrancan el motor D y t1 (3 s)', salidas: 'Y1, Y6' },
  { n: 4, causa: 't1 cumplido', efecto: 'D se detiene y B retrocede', salidas: 'Y1, Y3' },
  { n: 5, causa: 'B3: carro en zona de carga', efecto: 'Cae Y1 y A abre por muelle', salidas: '—' },
  { n: 6, causa: 'B1: mordaza abierta', efecto: 'C asciende y expulsa la pieza', salidas: 'Y4' },
  { n: 7, causa: 'B6: expulsor arriba', efecto: 'Inversión inmediata: C desciende', salidas: 'Y5' },
  { n: 8, causa: 'B5: expulsor en el foso', efecto: 'Fin de ciclo: todo en reposo', salidas: '—' },
];

// Geometría del lienzo
const W = 920;
const X0 = 250; // inicio de la zona de pasos
const UX = 72;
const Y0 = 46;
const ALTO_FILA = 72;
const H = Y0 + FILAS.length * ALTO_FILA + 12;
const px = (paso) => X0 + paso * UX;
const py = (fila, nivel) => Y0 + fila * ALTO_FILA + (nivel ? 20 : 54);

function svg() {
  const lineas = [];
  for (let p = 1; p <= 9; p++) {
    const x = px(p - 0.5);
    lineas.push(`<line class="vdi__paso" x1="${x}" y1="${Y0}" x2="${x}" y2="${H - 12}"/>`);
    lineas.push(`<text class="vdi__num" x="${x}" y="${Y0 - 12}" text-anchor="middle">${p}</text>`);
  }
  const filas = FILAS.map((f, i) => {
    const yTop = Y0 + i * ALTO_FILA;
    const d = f.puntos.map(([x, n], k) => `${k ? 'L' : 'M'}${px(x)} ${py(i, n)}`).join(' ');
    return `
      <line class="vdi__sep" x1="8" y1="${yTop}" x2="${W - 8}" y2="${yTop}"/>
      <text class="vdi__nombre" x="18" y="${yTop + 41}">${escapeHtml(f.nombre)}</text>
      <text class="vdi__desig" x="205" y="${yTop + 42}" text-anchor="middle">${escapeHtml(f.desig)}</text>
      <text class="vdi__nivel" x="${X0 - 12}" y="${py(i, 1) + 4}" text-anchor="end">1</text>
      <text class="vdi__nivel" x="${X0 - 12}" y="${py(i, 0) + 4}" text-anchor="end">0</text>
      <path class="vdi__traza" d="${d}"/>`;
  }).join('');
  const enlaces = ENLACES.map((e) => {
    const x = px(e.x);
    const y1 = py(...e.de);
    const y2 = py(...e.a);
    const dir = y2 > y1 ? 1 : -1;
    const yr = (y1 + y2) / 2;
    return `
      <line class="vdi__enlace" x1="${x}" y1="${y1}" x2="${x}" y2="${y2 - dir * 7}" marker-end="url(#vdi-flecha)"/>
      ${e.rotulo ? `<text class="vdi__rotulo" x="${x + 7}" y="${yr + 4}">${escapeHtml(e.rotulo)}</text>` : ''}`;
  }).join('');
  return `
  <svg class="vdi__svg" viewBox="0 0 ${W} ${H}" role="img"
       aria-label="Diagrama espacio-fase VDI 3260 de los elementos A, B, t1, D y C en nueve líneas de paso">
    <defs>
      <marker id="vdi-flecha" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto">
        <path class="vdi__punta" d="M0 0 L10 5 L0 10 z"/>
      </marker>
    </defs>
    <rect class="vdi__banda" data-banda x="${px(0.5)}" y="${Y0}" width="${UX}" height="${H - 12 - Y0}"/>
    <rect class="vdi__marco" x="8" y="${Y0}" width="${W - 16}" height="${H - 12 - Y0}"/>
    <line class="vdi__sep vdi__sep--fuerte" x1="${X0}" y1="${Y0}" x2="${X0}" y2="${H - 12}"/>
    <text class="vdi__cab" x="18" y="${Y0 - 12}">Elemento</text>
    ${lineas.join('')}${filas}${enlaces}
    <circle class="vdi__inicio" cx="${px(0.5)}" cy="${py(0, 0)}" r="5"/>
    <text class="vdi__rotulo" x="${px(0.5) + 9}" y="${py(0, 0) + 18}">S1</text>
    <text class="vdi__rotulo" x="${px(6.5)}" y="${py(4, 1) - 8}" text-anchor="middle">B6</text>
    <text class="vdi__rotulo" x="${px(7.5) + 6}" y="${py(4, 0) - 8}">B5</text>
    <text class="vdi__tiempo" x="${px(3)}" y="${py(2, 1) + 22}" text-anchor="middle">3 s</text>
  </svg>`;
}

/**
 * Monta el diagrama dentro de `root`.
 * @param {HTMLElement} root
 * @param {{ duraciones?: number[] }} [opts]  duración simulada de los pasos 1 a 7, en segundos
 * @returns {() => void} función de limpieza
 */
export function montarDiagramaFases(root, { duraciones = [] } = {}) {
  root.classList.add('vdi');
  root.innerHTML = `
    <div class="vdi__lienzo">${svg()}</div>
    <div class="vdi__barra" role="group" aria-label="Pasos de la secuencia">
      <button class="btn btn--small" type="button" data-play aria-pressed="false">Reproducir</button>
      ${PASOS.map((p) => `<button class="vdi__btn" type="button" data-paso="${p.n}" aria-pressed="false">${p.n}</button>`).join('')}
    </div>
    <dl class="vdi__detalle" aria-live="polite">
      <div><dt>Causa</dt><dd data-causa></dd></div>
      <div><dt>Efecto</dt><dd data-efecto></dd></div>
      <div><dt>Solenoides</dt><dd data-salidas></dd></div>
      <div><dt>Duración simulada</dt><dd data-duracion></dd></div>
    </dl>`;

  const banda = root.querySelector('[data-banda]');
  const botones = [...root.querySelectorAll('[data-paso]')];
  const play = root.querySelector('[data-play]');
  let actual = 1;
  let temporizador = 0;

  function seleccionar(n) {
    actual = n;
    const p = PASOS[n - 1];
    banda.setAttribute('x', px(n - 0.5));
    botones.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.paso) === n)));
    root.querySelector('[data-causa]').textContent = p.causa;
    root.querySelector('[data-efecto]').textContent = p.efecto;
    root.querySelector('[data-salidas]').textContent = p.salidas;
    const d = duraciones[n - 1];
    root.querySelector('[data-duracion]').textContent = d ? `${d.toFixed(1)} s` : '—';
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
    temporizador = setInterval(() => seleccionar((actual % PASOS.length) + 1), 1400);
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
