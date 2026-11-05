/**
 * Punto de entrada. Carga solo lo necesario para la primera vista:
 * estilos, tipografías, KaTeX, GSAP y el router. Three.js, Plotly, math.js
 * y lil-gui se cargan bajo demanda cuando una visualización entra en pantalla.
 */
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/400.css';
import 'katex/dist/katex.min.css';
import './styles/theme.css';
import './styles/main.css';
import './styles/components.css';

import { CAPITULOS, CAPITULO_IDS } from './content/capitulos.js';
import { CURSO } from './content/curso.js';
import { initTheme } from './ui/theme.js';
import { createProgress, bindProgressBar } from './ui/progreso.js';
import { createNav } from './ui/nav.js';
import { createRouter } from './router.js';

/** Vuelca los datos de la materia en las partes fijas de la página (cabecera, pie, metadatos). */
function aplicarCurso() {
  const q = (sel) => document.querySelector(sel);
  q('meta[name="description"]').content = CURSO.descripcion;
  q('.brand').setAttribute('aria-label', `Inicio — ${CURSO.titulo}`);
  q('.brand__title').textContent = CURSO.titulo;
  q('.brand__subtitle').textContent = `${CURSO.codigo} · ${CURSO.asignatura}`;
  q('[data-curso="pie"]').textContent = [CURSO.institucion, CURSO.facultad, CURSO.programa, CURSO.asignatura]
    .filter(Boolean)
    .join(' · ');
  q('[data-curso="referencias"]').innerHTML = CURSO.referencias.length
    ? `Bibliografía base: ${CURSO.referencias.join(' · ')}`
    : '';
}

aplicarCurso();
initTheme(document.querySelector('[data-action="toggle-theme"]'));

const progress = createProgress(CAPITULO_IDS);
bindProgressBar(progress);

const nav = createNav({ capitulos: CAPITULOS, progress });

const router = createRouter({
  viewEl: document.querySelector('[data-view]'),
  mainEl: document.getElementById('contenido'),
  nav,
  progress,
});
router.start();
