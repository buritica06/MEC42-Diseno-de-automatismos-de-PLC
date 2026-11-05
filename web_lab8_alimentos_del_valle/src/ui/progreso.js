/**
 * Progreso persistente del estudiante (localStorage).
 *
 * Estado: { version, visitados: string[], completados: string[], ejercicios: string[] }
 * Todo lo leído del almacenamiento se sanitiza: solo se aceptan identificadores
 * conocidos (capítulos registrados y ejercicios con formato válido).
 */
import { tweenProgress } from './motion.js';
import { CURSO } from '../content/curso.js';

const KEY = `${CURSO.clave}:progreso:v1`;
const EXERCISE_ID = /^ej-\d{1,3}$/;

export function createProgress(chapterIds) {
  const known = new Set(chapterIds);
  const listeners = new Set();
  let state = load();

  function load() {
    const empty = { version: 1, visitados: [], completados: [], ejercicios: [] };
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw || raw.length > 10_000) return empty;
      const data = JSON.parse(raw);
      const ids = (arr) => (Array.isArray(arr) ? arr.filter((x) => typeof x === 'string' && known.has(x)) : []);
      const ex = Array.isArray(data?.ejercicios)
        ? data.ejercicios.filter((x) => typeof x === 'string' && EXERCISE_ID.test(x))
        : [];
      return {
        version: 1,
        visitados: [...new Set(ids(data?.visitados))],
        completados: [...new Set(ids(data?.completados))],
        ejercicios: [...new Set(ex)],
      };
    } catch {
      return empty;
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* almacenamiento no disponible: el progreso vale para esta sesión */
    }
    listeners.forEach((fn) => fn(api));
  }

  const api = {
    isVisited: (id) => state.visitados.includes(id),
    isCompleted: (id) => state.completados.includes(id),
    isExerciseSolved: (id) => state.ejercicios.includes(id),
    markVisited(id) {
      if (!known.has(id) || state.visitados.includes(id)) return;
      state.visitados.push(id);
      save();
    },
    setCompleted(id, done) {
      if (!known.has(id)) return;
      const has = state.completados.includes(id);
      if (done && !has) state.completados.push(id);
      else if (!done && has) state.completados = state.completados.filter((x) => x !== id);
      else return;
      save();
    },
    markExercise(id) {
      if (!EXERCISE_ID.test(id) || state.ejercicios.includes(id)) return;
      state.ejercicios.push(id);
      save();
    },
    /** Fracción 0–1: capítulos completados sobre el total. */
    ratio: () => state.completados.length / known.size,
    counts: () => ({ completados: state.completados.length, total: known.size, ejercicios: state.ejercicios.length }),
    reset() {
      state = { version: 1, visitados: [], completados: [], ejercicios: [] };
      save();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return api;
}

/** Conecta el estado de progreso con la barra de la cabecera. */
export function bindProgressBar(progress, root = document) {
  const container = root.querySelector('.progress');
  const bar = root.querySelector('.progress__bar');
  const label = root.querySelector('.progress__label');
  const render = () => {
    const r = progress.ratio();
    const { completados, total } = progress.counts();
    container.setAttribute('aria-valuenow', String(Math.round(r * 100)));
    container.setAttribute('aria-valuetext', `${completados} de ${total} capítulos completados`);
    tweenProgress(bar, label, r);
  };
  progress.subscribe(render);
  render();
}
