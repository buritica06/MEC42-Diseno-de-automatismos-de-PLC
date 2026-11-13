/**
 * Diagrama espacio-fase (VDI 3260) interactivo en SVG para la Estación de Control de Peso.
 *
 * Muestra las seis fases del ciclo, la condición de reposo invertida de B (normalmente extendido),
 * el tiempo de pesaje t1 con báscula libre y la divergencia en OR entre la ruta OK (cilindro C y cinta)
 * y la ruta NOK (cilindro D a canaleta de descarte).
 */
import { escapeHtml } from './card.js';

/** Trazas de cada actuador en las fases 1 a 6 */
const FILAS = [
  {
    nombre: 'Cilindro A (Alimentación)',
    desig: 'A',
    sensor0: 'B1',
    sensor1: 'B2',
    color: '#0052cc',
    puntos: [
      [1, 0],
      [2, 1],
      [3, 0],
      [6, 0],
    ],
  },
  {
    nombre: 'Cilindro B (Bloqueo báscula)',
    desig: 'B',
    sensor0: 'B3 (libre)',
    sensor1: 'B4 (bloq.)',
    color: '#b91c1c',
    invertido: true,
    puntos: [
      [1, 1],
      [2, 1],
      [3, 0],
      [4, 1],
      [6, 1],
    ],
  },
  {
    nombre: 'Pesaje báscula (T1 = 3 s)',
    desig: 'T1',
    sensor0: '0',
    sensor1: 'T1.Q',
    color: '#0284c7',
    puntos: [
      [1, 0],
      [3, 0],
      [3, 1],
      [4, 1],
      [4, 0],
      [6, 0],
    ],
  },
  {
    nombre: 'Cilindro C (Clasificación OK)',
    desig: 'C',
    sensor0: 'S1',
    sensor1: 'B5',
    color: '#15803d',
    rama: 'ok',
    puntos: [
      [1, 0],
      [4, 0],
      [5, 1],
      [6, 0],
    ],
  },
  {
    nombre: 'Cilindro D (Rechazo NOK)',
    desig: 'D',
    sensor0: 'S2',
    sensor1: 'S3',
    color: '#c2410c',
    rama: 'nok',
    discontinuo: true,
    puntos: [
      [1, 0],
      [4, 0],
      [5, 1],
      [6, 0],
    ],
  },
  {
    nombre: 'Cinta H1 (Evacuación + T2)',
    desig: 'H1',
    sensor0: '0',
    sensor1: '1',
    color: '#0d9488',
    rama: 'ok',
    puntos: [
      [1, 0],
      [5.5, 0],
      [5.5, 1],
      [6, 1],
    ],
  },
];

export const PASOS = [
  {
    n: 1,
    fase: '1 → 2',
    causa: 'X21 · B1 · B4 · S1 · S2 (Marcha y C.I.)',
    efecto: 'Cilindro A avanza y empuja la pieza hacia la báscula',
    salidas: 'Y1 (A+)',
    actuadores: 'A avanza hacia B2; B mantiene bloqueada la báscula (B4)',
  },
  {
    n: 2,
    fase: '2 → 3',
    causa: 'B2 = 1 (Pieza posicionada en báscula)',
    efecto: 'Simultáneamente A retrocede y B se retrae para liberar la báscula',
    salidas: 'Y2 (A−), Y3 (B−)',
    actuadores: 'A retorna a B1; B se retrae a B3 liberando el plato de pesaje',
  },
  {
    n: 3,
    fase: '3 → 4',
    causa: 'B1 · B3 = 1 (A en reposo y báscula libre)',
    efecto: 'Pesaje estático durante T1 = 3 s; al vencer T1 se desactiva Y3 y el muelle extiende B',
    salidas: 'Y3 durante T1; luego Y3 = 0',
    actuadores: 'Báscula libre pesando; al final B avanza a B4 por muelle',
  },
  {
    n: 4,
    fase: '4 → 5 (Bifurcación OR)',
    causa: 'B4 · S4 (Rama OK)  ó  B4 · S4̅ (Rama NOK)',
    efecto: 'Divergencia OR: si S4=1 avanza C hacia la cinta; si S4=0 avanza D hacia canaleta',
    salidas: 'Ruta OK: Y4 (C+)  |  Ruta NOK: Y5 (D+)',
    actuadores: 'Rama OK: C avanza a B5. Rama NOK: D avanza a S3',
  },
  {
    n: 5,
    fase: '5 → 6',
    causa: 'B5 = 1 (OK)  ó  S3 = 1 (NOK)',
    efecto: 'Ruta OK: C retorna a S1 por muelle. Ruta NOK: D retorna a S2 por muelle',
    salidas: 'Ruta OK: Y4=0 (retorno)  |  Ruta NOK: Y5=0 (retorno)',
    actuadores: 'Retorno de C a S1 o retorno de D a S2; contadores CTU actualizados',
  },
  {
    n: 6,
    fase: '6 = 1 (Fin de ciclo)',
    causa: 'S1 (OK) ó S2 (NOK) + Evacuación en cinta',
    efecto: 'Cinta H1 evacua la pieza hasta S5 + T2 (2 s); retorno a condiciones iniciales',
    salidas: 'Ruta OK: H1 (Cinta)  |  Ruta NOK: —',
    actuadores: 'Todos los actuadores en reposo (B1, B4, S1, S2); reinicio si marcha activa',
  },
];

const W = 960;
const X0 = 260;
const UX = 120; // 5 fases principales (1 a 6)
const Y0 = 48;
const ALTO_FILA = 64;
const H = Y0 + FILAS.length * ALTO_FILA + 16;
const px = (fase) => X0 + (fase - 1) * UX;
const py = (fila, nivel) => Y0 + fila * ALTO_FILA + (nivel ? 18 : 50);

function generarSvg(modoRama = 'ambas') {
  const lineasFase = [];
  for (let f = 1; f <= 6; f++) {
    const x = px(f);
    const etiqueta = f === 6 ? '6 = 1' : String(f);
    lineasFase.push(`<line class="vdi__paso" x1="${x}" y1="${Y0}" x2="${x}" y2="${H - 14}"/>`);
    lineasFase.push(`<text class="vdi__num" x="${x}" y="${Y0 - 14}" text-anchor="middle">Fase ${etiqueta}</text>`);
  }

  const filas = FILAS.map((f, i) => {
    const yTop = Y0 + i * ALTO_FILA;
    const oculta = (modoRama === 'ok' && f.rama === 'nok') || (modoRama === 'nok' && f.rama === 'ok');
    const opacidad = oculta ? 'opacity: 0.2;' : '';
    const d = f.puntos.map(([x, n], k) => `${k ? 'L' : 'M'}${px(x)} ${py(i, n)}`).join(' ');
    const dash = f.discontinuo ? 'stroke-dasharray="6,4"' : '';

    return `
      <g style="${opacidad}">
        <line class="vdi__sep" x1="8" y1="${yTop}" x2="${W - 8}" y2="${yTop}"/>
        <text class="vdi__nombre" x="16" y="${yTop + 36}" style="font-weight:600;">${escapeHtml(f.nombre)}</text>
        <text class="vdi__desig" x="215" y="${yTop + 36}" text-anchor="middle" style="fill:${f.color}; font-weight:bold;">${escapeHtml(f.desig)}</text>
        <text class="vdi__nivel" x="${X0 - 10}" y="${py(i, 1) + 4}" text-anchor="end">${escapeHtml(f.sensor1)}</text>
        <text class="vdi__nivel" x="${X0 - 10}" y="${py(i, 0) + 4}" text-anchor="end">${escapeHtml(f.sensor0)}</text>
        <path class="vdi__traza" d="${d}" style="stroke:${f.color}; stroke-width: 2.4;" ${dash}/>
      </g>`;
  }).join('');

  return `
  <svg class="vdi__svg" viewBox="0 0 ${W} ${H}" role="img"
       aria-label="Diagrama espacio-fase VDI 3260 de la estación de control de peso con bifurcación alternativa OR">
    <rect class="vdi__banda" data-banda x="${px(1)}" y="${Y0}" width="${UX}" height="${H - 14 - Y0}"/>
    <rect class="vdi__marco" x="8" y="${Y0}" width="${W - 16}" height="${H - 14 - Y0}"/>
    <line class="vdi__sep vdi__sep--fuerte" x1="${X0}" y1="${Y0}" x2="${X0}" y2="${H - 14}"/>
    <text class="vdi__cab" x="16" y="${Y0 - 14}">Actuador / Función</text>
    ${lineasFase.join('')}
    ${filas}
    <!-- Marcador de inicio invertido de B -->
    <circle cx="${px(1)}" cy="${py(1, 1)}" r="5" fill="#b91c1c"/>
    <text x="${px(1) + 8}" y="${py(1, 1) - 6}" font-size="11" fill="#b91c1c" font-weight="bold">B4 = 1 (Reposo)</text>
    <!-- Punto de divergencia OR en fase 4 -->
    <circle cx="${px(4)}" cy="${py(3, 0)}" r="4.5" fill="#6d28d9"/>
    <text x="${px(4) + 6}" y="${py(3, 0) - 8}" font-size="11" fill="#6d28d9" font-weight="bold">OR: S4 / S4̅</text>
  </svg>`;
}

export function montarDiagramaFases(root, { duraciones = [] } = {}) {
  root.classList.add('vdi');
  root.innerHTML = `
    <div class="vdi__selector-rama" style="display:flex; gap:0.75rem; align-items:center; margin-bottom:0.75rem;">
      <span style="font-weight:600; font-size:0.9rem;">Trayectoria a mostrar:</span>
      <button class="btn btn--small btn--active" type="button" data-rama="ambas">Ambas ramas (OR)</button>
      <button class="btn btn--small" type="button" data-rama="ok">Ruta OK (C + Cinta)</button>
      <button class="btn btn--small" type="button" data-rama="nok">Ruta NOK (D Rechazo)</button>
    </div>
    <div class="vdi__lienzo" data-lienzo>${generarSvg('ambas')}</div>
    <div class="vdi__barra" role="group" aria-label="Fases de la secuencia">
      <button class="btn btn--small" type="button" data-play aria-pressed="false">Reproducir ciclo</button>
      ${PASOS.map((p) => `<button class="vdi__btn" type="button" data-paso="${p.n}" aria-pressed="false">Paso ${p.n}</button>`).join('')}
    </div>
    <dl class="vdi__detalle" aria-live="polite">
      <div><dt>Fase</dt><dd data-fase></dd></div>
      <div><dt>Causa (Receptividad)</dt><dd data-causa></dd></div>
      <div><dt>Efecto en la estación</dt><dd data-efecto></dd></div>
      <div><dt>Solenoides energizados</dt><dd data-salidas></dd></div>
      <div><dt>Detalle cinemático</dt><dd data-actuadores></dd></div>
      <div><dt>Duración simulada</dt><dd data-duracion></dd></div>
    </dl>`;

  const lienzo = root.querySelector('[data-lienzo]');
  const botones = [...root.querySelectorAll('[data-paso]')];
  const ramasBtns = [...root.querySelectorAll('[data-rama]')];
  const play = root.querySelector('[data-play]');
  let actual = 1;
  let temporizador = 0;
  let modoRamaActual = 'ambas';

  function actualizarBanda() {
    const banda = root.querySelector('[data-banda]');
    if (banda) banda.setAttribute('x', px(actual));
  }

  function seleccionar(n) {
    actual = Math.max(1, Math.min(6, n));
    const p = PASOS[actual - 1];
    actualizarBanda();
    botones.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.paso) === actual)));
    root.querySelector('[data-fase]').textContent = p.fase;
    root.querySelector('[data-causa]').textContent = p.causa;
    root.querySelector('[data-efecto]').textContent = p.efecto;
    root.querySelector('[data-salidas]').textContent = p.salidas;
    root.querySelector('[data-actuadores]').textContent = p.actuadores;
    const d = duraciones[actual - 1];
    root.querySelector('[data-duracion]').textContent = d ? `${d.toFixed(2)} s` : '—';
  }

  function detener() {
    clearInterval(temporizador);
    temporizador = 0;
    play.setAttribute('aria-pressed', 'false');
    play.textContent = 'Reproducir ciclo';
  }

  play.addEventListener('click', () => {
    if (temporizador) return detener();
    play.setAttribute('aria-pressed', 'true');
    play.textContent = 'Detener';
    temporizador = setInterval(() => seleccionar((actual % PASOS.length) + 1), 1600);
  });

  botones.forEach((b) =>
    b.addEventListener('click', () => {
      detener();
      seleccionar(Number(b.dataset.paso));
    })
  );

  ramasBtns.forEach((b) => {
    b.addEventListener('click', () => {
      ramasBtns.forEach((btn) => btn.classList.remove('btn--active'));
      b.classList.add('btn--active');
      modoRamaActual = b.dataset.rama;
      lienzo.innerHTML = generarSvg(modoRamaActual);
      actualizarBanda();
    });
  });

  seleccionar(1);
  return detener;
}
