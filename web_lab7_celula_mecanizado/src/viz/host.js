/**
 * Anfitrión de visualizaciones: construye el bloque (escenario + panel lateral
 * + información + tabla de datos), carga el motor de forma perezosa y coordina
 * el ciclo de vida mount / update / resize / dispose de cada escena o gráfica.
 *
 * Responsabilidades transversales que NO repite cada visualización:
 *   - Carga diferida (IntersectionObserver, 300 px antes de entrar en pantalla).
 *   - Detección de WebGL2 y respaldo estático.
 *   - ResizeObserver con debounce de 100 ms → resize().
 *   - Coalescencia de cambios de sliders: como máximo un update() por frame.
 *   - Cambio de tema → restyle() (o update()).
 *   - Lecturas numéricas con tween GSAP, fórmulas KaTeX y tabla accesible.
 */
import { VIZ } from './registry.js';
import { icon } from '../ui/icons.js';
import { tweenNumber } from '../ui/motion.js';
import { renderMath } from '../math/katex.js';
import { escapeHtml } from '../components/card.js';

let uid = 0;

/** WebGL2 es obligatorio desde three r163; WebGL1 → respaldo estático. */
export function detectWebGL() {
  try {
    const c = document.createElement('canvas');
    if (c.getContext('webgl2')) return 'webgl2';
    if (c.getContext('webgl') || c.getContext('experimental-webgl')) return 'webgl1';
  } catch {
    /* sin soporte */
  }
  return null;
}

const debounce = (fn, ms) => {
  let t;
  const d = (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
  d.cancel = () => clearTimeout(t);
  return d;
};

function buildShell(def, id, tall) {
  const fig = document.createElement('figure');
  fig.className = 'viz reveal';
  fig.setAttribute('aria-labelledby', `${id}-title`);
  fig.innerHTML = `
    <header class="viz__header">
      <h3 class="viz__title" id="${id}-title">${escapeHtml(def.titulo)}</h3>
      <p class="viz__desc">${escapeHtml(def.descripcion)}</p>
    </header>
    <div class="viz__body">
      <div class="viz__stage ${tall ? 'viz__stage--tall' : ''}">
        <div class="viz__loading" role="status"><span class="spinner" aria-hidden="true"></span><span>Cargando visualización…</span></div>
      </div>
      <aside class="viz__aside" aria-label="Controles de la visualización">
        <button class="viz__aside-toggle" type="button" aria-expanded="false" aria-controls="${id}-aside">
          <span>${icon('sliders')} Parámetros</span>${icon('chevronDown')}
        </button>
        <div class="viz__aside-content" id="${id}-aside">
          <div class="viz__gui"></div>
          <dl class="readouts" aria-live="polite"></dl>
          <div class="viz__actions"></div>
          <p class="viz__hint"></p>
        </div>
      </aside>
    </div>
    <div class="viz__info"></div>
    <details class="viz__data">
      <summary>Ver datos en tabla</summary>
      <div class="viz__data-table"></div>
    </details>`;
  return fig;
}

/**
 * Monta una visualización registrada dentro de `slot`.
 * @param {HTMLElement} slot
 * @param {keyof VIZ} name
 * @param {{ params?: object, hideControls?: string[], titulo?: string, descripcion?: string }} [opts]
 * @returns {{ dispose(): void }}
 */
export function mountViz(slot, name, opts = {}) {
  const base = VIZ[name];
  if (!base) throw new Error(`Visualización desconocida: ${name}`);
  const def = {
    ...base,
    ...(opts.titulo && { titulo: opts.titulo }),
    ...(opts.descripcion && { descripcion: opts.descripcion }),
  };
  const id = `viz-${name}-${++uid}`;
  const fig = buildShell(def, id, def.tall);
  slot.replaceWith(fig);

  const stage = fig.querySelector('.viz__stage');
  const asideToggle = fig.querySelector('.viz__aside-toggle');
  const asideContent = fig.querySelector('.viz__aside-content');
  const guiBox = fig.querySelector('.viz__gui');
  const readoutsEl = fig.querySelector('.readouts');
  const actionsEl = fig.querySelector('.viz__actions');
  const hintEl = fig.querySelector('.viz__hint');
  const infoEl = fig.querySelector('.viz__info');
  const details = fig.querySelector('.viz__data');
  const tableBox = fig.querySelector('.viz__data-table');

  let instance = null;
  let guiApi = null;
  let disposed = false;
  let rafId = 0;
  let lastTable = null;
  const cleanups = [];

  // Panel de parámetros plegable en pantallas estrechas (en escritorio siempre visible).
  const narrow = window.matchMedia('(max-width: 1023px)');
  const syncAside = () => {
    if (narrow.matches) {
      const open = asideToggle.getAttribute('aria-expanded') === 'true';
      asideContent.hidden = !open;
    } else {
      asideContent.hidden = false;
    }
  };
  asideToggle.addEventListener('click', () => {
    const open = asideToggle.getAttribute('aria-expanded') !== 'true';
    asideToggle.setAttribute('aria-expanded', String(open));
    syncAside();
  });
  narrow.addEventListener?.('change', syncAside);
  cleanups.push(() => narrow.removeEventListener?.('change', syncAside));
  syncAside();

  /* ── Información devuelta por la visualización ── */
  const readoutNodes = new Map();
  function onInfo(info = {}) {
    if (disposed) return;
    if (info.latex) {
      const list = Array.isArray(info.latex) ? info.latex : [info.latex];
      infoEl.innerHTML = list.map(() => '<div class="math-block"></div>').join('');
      list.forEach((tex, i) => renderMath(infoEl.children[i], tex, true));
    }
    if (info.readouts) {
      const seen = new Set();
      for (const r of info.readouts) {
        seen.add(r.label);
        let node = readoutNodes.get(r.label);
        if (!node) {
          const wrap = document.createElement('div');
          wrap.className = 'readout';
          wrap.innerHTML = `<dt>${escapeHtml(r.label)}</dt><dd></dd>`;
          readoutsEl.appendChild(wrap);
          node = { wrap, dd: wrap.querySelector('dd') };
          readoutNodes.set(r.label, node);
        }
        if (r.state) node.dd.dataset.state = r.state;
        else delete node.dd.dataset.state;
        if (typeof r.value === 'number') tweenNumber(node.dd, r.value, r.format ?? ((v) => v.toFixed(3)));
        else node.dd.textContent = r.value ?? '—';
      }
      for (const [label, node] of readoutNodes) {
        if (!seen.has(label)) {
          node.wrap.remove();
          readoutNodes.delete(label);
        }
      }
    }
    if (info.aria) {
      const target = stage.querySelector('[role="img"]');
      target?.setAttribute('aria-label', `${def.aria} ${info.aria}`);
    }
    if (info.table) {
      lastTable = info.table;
      if (details.open) renderTable();
    }
  }

  function renderTable() {
    if (!lastTable) {
      tableBox.innerHTML = '<p>Sin datos.</p>';
      return;
    }
    const { caption, columns, rows } = lastTable;
    const fmt = (v) => (typeof v === 'number' ? (Number.isFinite(v) ? v.toFixed(4) : '—') : escapeHtml(v));
    tableBox.innerHTML = `<table>
      ${caption ? `<caption class="visually-hidden">${escapeHtml(caption)}</caption>` : ''}
      <thead><tr>${columns.map((c) => `<th scope="col">${escapeHtml(c)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${fmt(v)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
  }
  details.addEventListener('toggle', () => details.open && renderTable());

  function showFallback(message) {
    const src = def.fallback ? `${import.meta.env.BASE_URL}assets/images/fallbacks/${def.fallback}` : null;
    stage.innerHTML = `<div class="viz__fallback" role="img" aria-label="${escapeHtml(def.aria)}">
      ${src ? `<img src="${src}" alt="${escapeHtml(def.aria)}" loading="lazy" />` : ''}
      <p>${escapeHtml(message)}</p>
    </div>`;
    fig.querySelector('.viz__aside').hidden = true;
  }

  /* ── Carga diferida ── */
  async function load() {
    if (def.kind === 'three') {
      const gl = detectWebGL();
      if (gl !== 'webgl2') {
        showFallback(
          gl === 'webgl1'
            ? 'Tu navegador solo ofrece WebGL 1; esta escena requiere WebGL 2. Mostrando versión estática.'
            : 'Tu navegador no soporta WebGL. Mostrando versión estática.'
        );
        return;
      }
    }
    let mod;
    let createGUI;
    try {
      // lil-gui también se carga bajo demanda, junto con el motor de la visualización.
      [mod, { createGUI }] = await Promise.all([def.load(), import('../ui/gui.js')]);
    } catch (err) {
      console.error(err);
      showFallback('No se pudo cargar la visualización. Revisa tu conexión y recarga la página.');
      return;
    }
    if (disposed) return;

    const params = { ...mod.defaults, ...(opts.params ?? {}) };
    const factory = mod.createScene ?? mod.createChart;
    stage.querySelector('.viz__loading')?.remove();

    try {
      instance = factory(stage, { params, onInfo, ariaLabel: def.aria });
      await instance.mount();
    } catch (err) {
      console.error(err);
      instance?.dispose?.();
      instance = null;
      showFallback('Ocurrió un error al iniciar la visualización. Mostrando versión estática.');
      return;
    }
    if (disposed) {
      instance.dispose();
      return;
    }

    const hidden = new Set(opts.hideControls ?? []);
    const schema = (mod.controls ?? []).filter((c) => !hidden.has(c.key));
    guiApi = createGUI(
      guiBox,
      params,
      () => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          if (!disposed) instance.update(params);
        });
      },
      schema,
      { title: 'Parámetros', ariaLabel: `Parámetros: ${def.titulo}` }
    );
    hintEl.textContent =
      def.kind === 'three'
        ? 'Arrastra para rotar · rueda para acercar · teclado: flechas, + / −, R.'
        : 'Arrastra para hacer zoom · doble clic para restablecer · pasa el cursor para ver valores.';

    if (instance.download) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn--small';
      btn.textContent = 'Descargar PNG';
      btn.addEventListener('click', () => instance.download());
      actionsEl.appendChild(btn);
    }

    const ro = new ResizeObserver(debounce(() => !disposed && instance?.resize(), 100));
    ro.observe(stage);
    cleanups.push(() => ro.disconnect());

    const onTheme = () => (instance.restyle ? instance.restyle() : instance.update(params));
    window.addEventListener('themechange', onTheme);
    cleanups.push(() => window.removeEventListener('themechange', onTheme));
  }

  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        load();
      }
    },
    { rootMargin: '300px 0px' }
  );
  io.observe(fig);
  cleanups.push(() => io.disconnect());

  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(rafId);
      cleanups.forEach((fn) => fn());
      guiApi?.destroy();
      instance?.dispose();
      instance = null;
    },
  };
}
