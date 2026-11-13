/**
 * Diagrama espacio-fase interactivo (Figura 4 de la guía).
 *
 *  - Vista "Planta": los once actuadores A … K más ventosas y barrido.
 *  - Vista "Banco": la solución equivalente de cuatro cilindros.
 *  - Cada intervalo 1→2 … 6→7=1 es una banda seleccionable (ratón, toque o teclado)
 *    que resalta los movimientos activos y muestra su condición de fin de fase.
 *  - "Reproducir" recorre el ciclo con las duraciones nominales reales.
 */
import { ACTUADORES, FASES, INSTANTES } from '../content/secuencia.js';
import { alAparecer, colorVar, esc, fmt, reducedMotion, segmentado } from './svg.js';

const { t1, t3, t4, t5, t7, t8, t9 } = INSTANTES;
/** Duración nominal de cada intervalo (s). */
export const DURACION_FASES = [t3 - t1, t4 - t3, t5 - t4, t7 - t5, t8 - t7, t9 - t8];

/** Filas de la vista de banco: cuatro cilindros + señales. */
const BANCO = [
  { id: 'Cil. 1', nombre: 'A / C · vertical', s0: 'B1', s1: 'B2', color: 1, traza: ACTUADORES[0].traza },
  { id: 'Cil. 2', nombre: 'B / D · carros', s0: 'B3', s1: 'B4', color: 2, traza: ACTUADORES[1].traza },
  { id: 'Cil. 3', nombre: 'E · giro / bloqueo', s0: 'S1', s1: 'S2', color: 3, traza: ACTUADORES[4].traza },
  { id: 'Cil. 4', nombre: 'F + pilotos G … K', s0: 'S3', s1: 'B5', color: 4, traza: ACTUADORES[5].traza },
  ...ACTUADORES.filter((a) => a.senal),
];

const W = 940;
const IZQ = 200; // columna de nombres
const DER = 120; // columna de sensores
const SUP = 46; // cabecera de pasos
const FILA = 40;
const AMP = 22; // altura del nivel 1 dentro de la fila
const PASO_X = (W - IZQ - DER) / 6;
const x = (k) => IZQ + k * PASO_X;

function construirSVG(filas) {
  const alto = SUP + filas.length * FILA + 18;
  const yBase = (i) => SUP + i * FILA + FILA - 9;
  let s = `<svg class="ef__svg" viewBox="0 0 ${W} ${alto}" role="img" aria-labelledby="ef-tit ef-desc">
    <title id="ef-tit">Diagrama espacio-fase de la estación de giro temporizado</title>
    <desc id="ef-desc">Posición de cada actuador en los pasos 1 a 7 igual a 1. Seleccione un intervalo para ver sus movimientos.</desc>`;

  // Bandas de fase (fondo seleccionable)
  FASES.forEach((f, i) => {
    s += `<g class="ef__banda" data-fase="${i}" tabindex="0" role="button" aria-label="Intervalo ${esc(f.id)}: ${esc(f.titulo)}">
      <rect x="${x(i)}" y="${SUP - 30}" width="${PASO_X}" height="${alto - SUP + 18}" rx="6"></rect>
      <text class="ef__banda-txt" x="${x(i) + PASO_X / 2}" y="${SUP - 12}" text-anchor="middle">${esc(f.id.replace('-', ' → '))}</text>
    </g>`;
  });
  // Líneas de pasos
  for (let k = 0; k <= 6; k++) {
    s += `<line class="ef__paso" x1="${x(k)}" y1="${SUP - 2}" x2="${x(k)}" y2="${alto - 8}"></line>`;
    s += `<text class="ef__paso-num" x="${x(k)}" y="${alto - 0}" text-anchor="middle">${k === 6 ? '7 = 1' : k + 1}</text>`;
  }

  // Filas
  filas.forEach((a, i) => {
    const y0 = yBase(i);
    const y1 = y0 - AMP;
    const color = colorVar(a.color);
    s += `<g class="ef__fila" data-fila="${i}" style="--c:${color}">
      <line class="ef__nivel" x1="${IZQ - 6}" y1="${y0}" x2="${W - DER + 6}" y2="${y0}"></line>
      <line class="ef__nivel ef__nivel--1" x1="${IZQ - 6}" y1="${y1}" x2="${W - DER + 6}" y2="${y1}"></line>
      <text class="ef__id" x="14" y="${y0 - 4}">${esc(a.id)}</text>
      <text class="ef__nombre" x="${a.id.length > 2 ? 66 : 40}" y="${y0 - 4}">${esc(a.nombre)}</text>
      <text class="ef__sensor" x="${W - DER + 12}" y="${y0 + 4}">${esc(a.s0)}</text>
      <text class="ef__sensor" x="${W - DER + 12}" y="${y1 + 4}">${esc(a.s1)}</text>`;
    // Traza: rampas para cilindros, flancos verticales para señales
    const pts = [];
    a.traza.forEach((v, k) => {
      const yy = v ? y1 : y0;
      if (a.senal && k > 0 && a.traza[k - 1] !== v) pts.push([x(k), a.traza[k - 1] ? y1 : y0]);
      pts.push([x(k), yy]);
    });
    const d = pts.map(([px, py], k) => `${k ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
    s += `<path class="ef__traza" d="${d}" pathLength="1"></path>`;
    // Puntos de cambio
    a.traza.forEach((v, k) => {
      if (k > 0 && a.traza[k - 1] !== v)
        s += `<circle class="ef__punto" cx="${x(k)}" cy="${v ? y1 : y0}" r="3.6"></circle>`;
    });
    s += '</g>';
  });
  s += `<line class="ef__cursor" x1="${IZQ}" y1="${SUP - 2}" x2="${IZQ}" y2="${alto - 12}" hidden></line>`;
  s += '</svg>';
  return s;
}

function detalleFase(i) {
  const f = FASES[i];
  return `<div class="ef__detalle-cab"><span class="ef__chip">${esc(f.id.replace('-', ' → '))}</span><strong>${esc(f.titulo)}</strong>
      <span class="ef__dur">${fmt(DURACION_FASES[i], 1)} s</span></div>
    <dl class="ef__dl">
      <div><dt>Movimientos (planta)</dt><dd>${esc(f.movimientos)}</dd></div>
      <div><dt>Equivalente en banco</dt><dd>${esc(f.banco)}</dd></div>
      <div><dt>Fin de fase</dt><dd>${esc(f.fin)}</dd></div>
      <div><dt>Etapas GP</dt><dd>${f.etapas.join(', ')}${i === 4 ? ' (divergencia/convergencia en Y)' : ''}</dd></div>
    </dl>`;
}

/**
 * Monta el diagrama en `root`.
 * @returns {() => void} limpieza
 */
export function montarEspacioFase(root) {
  let vista = 'planta';
  let sel = 0;
  let raf = 0;
  const limpiezas = [];

  root.classList.add('ef', 'diagrama');
  root.innerHTML = `
    <div class="diagrama__barra">
      ${segmentado(
        [
          { valor: 'planta', texto: 'Planta (A … K)' },
          { valor: 'banco', texto: 'Banco (4 cilindros)' },
        ],
        vista,
        'Nivel de detalle'
      )}
      <button type="button" class="btn btn--small" data-play aria-pressed="false">▶ Reproducir ciclo</button>
    </div>
    <div class="diagrama__lienzo" tabindex="-1"><div class="diagrama__svg"></div></div>
    <p class="diagrama__nota">Desliza horizontalmente para ver el diagrama completo.</p>
    <div class="ef__detalle" aria-live="polite"></div>`;

  const svgBox = root.querySelector('.diagrama__svg');
  const detalle = root.querySelector('.ef__detalle');
  const play = root.querySelector('[data-play]');

  function dibujar() {
    svgBox.innerHTML = construirSVG(vista === 'planta' ? ACTUADORES : BANCO);
    marcar(sel);
  }

  function marcar(i) {
    sel = i;
    svgBox.querySelectorAll('.ef__banda').forEach((b) => b.classList.toggle('is-activa', Number(b.dataset.fase) === i));
    // Una fila está "activa" si cambia de nivel en el intervalo seleccionado
    const filas = vista === 'planta' ? ACTUADORES : BANCO;
    svgBox.querySelectorAll('.ef__fila').forEach((g) => {
      const a = filas[Number(g.dataset.fila)];
      const activa = a.senal ? a.traza[i] === 1 || a.traza[i + 1] === 1 : a.traza[i] !== a.traza[i + 1];
      g.classList.toggle('is-activa', activa);
    });
    detalle.innerHTML = detalleFase(i);
  }

  // Selección por ratón, toque y teclado (delegación: sobrevive a los redibujados)
  const onClick = (e) => {
    const b = e.target.closest('.ef__banda');
    if (b) {
      detener();
      marcar(Number(b.dataset.fase));
    }
    const seg = e.target.closest('.seg__btn');
    if (seg && seg.dataset.valor !== vista) {
      vista = seg.dataset.valor;
      root.querySelectorAll('.seg__btn').forEach((x) => x.setAttribute('aria-pressed', String(x === seg)));
      dibujar();
    }
  };
  const onKey = (e) => {
    const b = e.target.closest('.ef__banda');
    if (!b) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      detener();
      marcar(Number(b.dataset.fase));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const n = (sel + (e.key === 'ArrowRight' ? 1 : 5)) % 6;
      marcar(n);
      svgBox.querySelector(`.ef__banda[data-fase="${n}"]`)?.focus();
    }
  };
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  limpiezas.push(() => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('keydown', onKey);
  });

  /* Reproducción: cursor que recorre el ciclo con la duración nominal de cada fase. */
  const total = DURACION_FASES.reduce((a, b) => a + b, 0);
  function detener() {
    cancelAnimationFrame(raf);
    raf = 0;
    play.setAttribute('aria-pressed', 'false');
    play.textContent = '▶ Reproducir ciclo';
    svgBox.querySelector('.ef__cursor')?.setAttribute('hidden', '');
  }
  function reproducir() {
    const cursor = svgBox.querySelector('.ef__cursor');
    cursor.removeAttribute('hidden');
    play.setAttribute('aria-pressed', 'true');
    play.textContent = '■ Detener';
    const t0 = performance.now();
    const ciclo = total * 1000 * 1.25; // un poco más lento que el real para poder leer
    const frame = (ahora) => {
      const t = (((ahora - t0) % ciclo) / ciclo) * total;
      let acc = 0;
      let i = 0;
      while (i < 5 && t > acc + DURACION_FASES[i]) acc += DURACION_FASES[i++];
      const u = Math.min(1, (t - acc) / DURACION_FASES[i]);
      const px = x(i + u);
      cursor.setAttribute('x1', px);
      cursor.setAttribute('x2', px);
      if (i !== sel) marcar(i);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }
  const onPlay = () => (raf ? detener() : reproducir());
  play.addEventListener('click', onPlay);
  limpiezas.push(() => play.removeEventListener('click', onPlay), detener);

  dibujar();
  // Trazado progresivo de las líneas al entrar en pantalla
  if (!reducedMotion()) {
    root.classList.add('ef--oculto');
    limpiezas.push(alAparecer(root, () => root.classList.replace('ef--oculto', 'ef--dibujar')));
  }

  return () => limpiezas.forEach((fn) => fn());
}
