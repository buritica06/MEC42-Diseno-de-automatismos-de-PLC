/**
 * Tema claro/oscuro con persistencia en localStorage.
 * El script en línea de index.html aplica el tema antes del primer pintado;
 * este módulo gestiona el botón y notifica a las visualizaciones con el
 * evento global 'themechange' (Three.js y Plotly releen sus colores).
 */
import { icon } from './icons.js';

const KEY = 'iub:tema'; // compartida: el tema elegido se conserva entre materias
const VALID = new Set(['light', 'dark']);

function readStored() {
  try {
    const v = localStorage.getItem(KEY);
    return VALID.has(v) ? v : null; // sanitizado: solo valores conocidos
  } catch {
    return null;
  }
}

export function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function apply(theme, button) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark';
  if (button) {
    button.innerHTML = dark ? icon('sun') : icon('moon');
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
    button.title = button.getAttribute('aria-label');
  }
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

export function initTheme(button) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const initial = readStored() ?? (media.matches ? 'dark' : 'light');
  apply(initial, button);

  button?.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* sin persistencia: el cambio vale para esta sesión */
    }
    apply(next, button);
  });

  // Si el usuario nunca eligió, seguir al sistema operativo.
  media.addEventListener?.('change', (e) => {
    if (!readStored()) apply(e.matches ? 'dark' : 'light', button);
  });
}

/** Lee un token CSS del tema activo (p. ej. '--viz-grid'). */
export function cssVar(name, el = document.documentElement) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}
