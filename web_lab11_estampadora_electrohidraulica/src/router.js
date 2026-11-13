/**
 * Router por hash (#/ y #/capitulo/<id>).
 *
 * Por qué hash: GitHub Pages sirve archivos estáticos sin reescrituras; con
 * hash no hace falta 404.html ni configurar el servidor, y el base path './'
 * funciona en cualquier subcarpeta.
 *
 * Cada vista se monta en un contenedor limpio y registra sus "disposers"
 * (escenas 3D, gráficas, contextos GSAP) que se ejecutan al salir: así no hay
 * fugas de memoria ni contextos WebGL huérfanos al cambiar de capítulo.
 */
import { CAPITULOS, findCapitulo } from './content/capitulos.js';
import { CURSO } from './content/curso.js';
import { card, escapeHtml } from './components/card.js';
import { icon } from './ui/icons.js';
import { animateViewIn, animateViewOut, refreshScroll, pulse } from './ui/motion.js';
import { renderMath, renderMathIn } from './math/katex.js';
import { mountViz } from './viz/host.js';

const ID_PATTERN = /^[0-9]{2}-[a-z-]{2,40}$/;

/** Interpreta el hash y lo valida contra el registro (whitelist). */
function parseHash() {
  const h = window.location.hash.replace(/^#/, '');
  const m = h.match(/^\/capitulo\/([^/?#]+)/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    if (ID_PATTERN.test(id) && findCapitulo(id)) return { name: 'capitulo', id };
    return { name: 'no-encontrado' };
  }
  return { name: 'inicio' };
}

export function createRouter({ viewEl, mainEl, nav, progress }) {
  let disposers = [];
  let navToken = 0;

  const ctxFor = () => ({
    mountViz,
    renderMath,
    renderMathIn,
    progress,
    track: (fn) => disposers.push(fn),
  });

  function teardown() {
    disposers.reverse().forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error(err);
      }
    });
    disposers = [];
  }

  function renderHome() {
    document.title = `${CURSO.titulo} · ${CURSO.codigo}`;
    const { completados, total, ejercicios } = progress.counts();
    const next = CAPITULOS.find((c) => !progress.isCompleted(c.id)) ?? CAPITULOS[0];
    const secundaria = CURSO.accionSecundaria;
    viewEl.innerHTML = `
      <section class="hero" aria-labelledby="hero-title">
        <span class="hero__eyebrow">${escapeHtml(CURSO.etiqueta)}</span>
        <h1 id="hero-title">${escapeHtml(CURSO.titulo)}</h1>
        <p class="hero__lead">${escapeHtml(CURSO.descripcion)}</p>
        ${CURSO.formula ? '<div class="hero__formula" data-formula></div>' : ''}
        <div class="hero__actions">
          <a class="btn btn--accent" href="#/capitulo/${next.id}">${icon('play')} ${completados ? 'Continuar' : 'Comenzar'}: ${escapeHtml(next.corto)}</a>
          ${secundaria ? `<a class="btn" href="#/capitulo/${secundaria.capitulo}">${escapeHtml(secundaria.texto)}</a>` : ''}
        </div>
        <ul class="meta-list">
          <li>${completados} de ${total} capítulos completados</li>
          <li>${ejercicios} actividades resueltas</li>
          <li>${escapeHtml(CURSO.institucion)}</li>
          <li>Docente: ${escapeHtml(CURSO.docente)}</li>
        </ul>
      </section>
      <h2 class="visually-hidden">Capítulos</h2>
      <div class="card-grid">
        ${CAPITULOS.map((c) =>
          card({
            eyebrow: `Capítulo ${c.numero}`,
            titulo: c.titulo,
            subtitulo: c.subtitulo,
            resumen: c.resumen,
            href: `#/capitulo/${c.id}`,
            accion: progress.isVisited(c.id) ? 'Repasar' : 'Abrir',
            icono: c.icono,
            estado: progress.isCompleted(c.id) ? 'completado' : progress.isVisited(c.id) ? 'visitado' : null,
            meta: `${c.minutos} min`,
          })
        ).join('')}
      </div>`;
    if (CURSO.formula) renderMath(viewEl.querySelector('[data-formula]'), CURSO.formula, true);
    nav.setCurrent(null);
  }

  async function renderChapter(id) {
    const cap = findCapitulo(id);
    const idx = CAPITULOS.indexOf(cap);
    const prev = CAPITULOS[idx - 1];
    const next = CAPITULOS[idx + 1];
    document.title = `${cap.numero}. ${cap.corto} · ${CURSO.titulo}`;
    nav.setCurrent(id);

    const mod = (await cap.load()).default;
    viewEl.innerHTML = `
      <header class="chapter-header">
        <div class="chapter-header__eyebrow">Capítulo ${cap.numero} · ${cap.minutos} min</div>
        <h1 tabindex="-1">${escapeHtml(cap.titulo)}</h1>
        <p class="chapter-header__lead">${escapeHtml(cap.subtitulo)}</p>
        ${
          mod.objetivos?.length
            ? `<section class="objectives" aria-labelledby="obj-title"><h2 id="obj-title">Al terminar este capítulo podrás…</h2>
               <ul>${mod.objetivos.map((o) => `<li>${o}</li>`).join('')}</ul></section>`
            : ''
        }
      </header>
      <article class="prose" data-body></article>
      <footer class="chapter-footer">
        <div class="complete-box">
          <p>¿Terminaste de estudiar este capítulo?</p>
          <button class="btn" type="button" data-complete aria-pressed="false"></button>
        </div>
        <nav class="pager" aria-label="Capítulos anterior y siguiente">
          ${prev ? `<a href="#/capitulo/${prev.id}"><small>${icon('chevronLeft')} Anterior</small><span>${escapeHtml(prev.corto)}</span></a>` : '<span></span>'}
          ${next ? `<a class="pager__next" href="#/capitulo/${next.id}"><small>Siguiente ${icon('chevronRight')}</small><span>${escapeHtml(next.corto)}</span></a>` : ''}
        </nav>
      </footer>`;

    const ctx = ctxFor();
    renderMathIn(viewEl.querySelector('.chapter-header'));
    mod.render(viewEl.querySelector('[data-body]'), ctx);

    const btn = viewEl.querySelector('[data-complete]');
    const paint = () => {
      const done = progress.isCompleted(id);
      btn.setAttribute('aria-pressed', String(done));
      btn.innerHTML = done ? `${icon('check')} Capítulo completado` : 'Marcar como completado';
    };
    btn.addEventListener('click', () => {
      progress.setCompleted(id, !progress.isCompleted(id));
      paint();
      pulse(btn);
    });
    paint();
    progress.markVisited(id);
  }

  async function route() {
    const token = ++navToken;
    const r = parseHash();
    await animateViewOut(viewEl);
    if (token !== navToken) return; // llegó otra navegación mientras tanto
    teardown();
    window.scrollTo(0, 0);

    try {
      if (r.name === 'capitulo') await renderChapter(r.id);
      else if (r.name === 'no-encontrado') {
        viewEl.innerHTML = `<div class="prose"><h1 tabindex="-1">Capítulo no encontrado</h1>
          <p>La dirección no corresponde a ningún capítulo. <a href="#/">Volver al inicio</a>.</p></div>`;
        nav.setCurrent(null);
      } else renderHome();
    } catch (err) {
      console.error(err);
      viewEl.innerHTML = `<div class="prose"><h1 tabindex="-1">No se pudo cargar el contenido</h1>
        <p>Revisa tu conexión y vuelve a intentarlo. <a href="#/">Volver al inicio</a>.</p></div>`;
    }
    if (token !== navToken) return;

    const gsapCtx = animateViewIn(viewEl);
    disposers.push(() => gsapCtx.revert());
    refreshScroll();
    // Foco al título para lectores de pantalla (sin desplazar la página)
    (viewEl.querySelector('h1[tabindex]') ?? mainEl).focus({ preventScroll: true });
  }

  window.addEventListener('hashchange', route);
  return { start: route };
}
