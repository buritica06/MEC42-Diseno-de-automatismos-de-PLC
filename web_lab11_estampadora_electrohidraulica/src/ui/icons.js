/**
 * Iconos SVG en línea (estilo Lucide: trazo 2, 24×24, sin relleno).
 * Se insertan como texto: todos son decorativos (aria-hidden) y el control
 * que los contiene lleva su propia etiqueta accesible.
 */
const svg = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const icons = {
  menu: svg(
    '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>'
  ),
  close: svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
  sun: svg(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>'
  ),
  moon: svg('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'),
  check: svg('<polyline points="20 6 9 17 4 12"/>'),
  checkCircle: svg('<circle cx="12" cy="12" r="9"/><polyline points="8 12 11 15 16 9"/>'),
  chevronLeft: svg('<polyline points="15 18 9 12 15 6"/>'),
  chevronRight: svg('<polyline points="9 18 15 12 9 6"/>'),
  chevronDown: svg('<polyline points="6 9 12 15 18 9"/>'),
  home: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>'),
  book: svg(
    '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'
  ),
  sigma: svg('<path d="M18 7V4H6l6 8-6 8h12v-3"/>'),
  waves: svg('<path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/><path d="M2 18c2-4 4-4 6 0s4 4 6 0 4-4 6 0" opacity=".5"/>'),
  steps: svg('<path d="M4 20h4v-4h4v-4h4V8h4"/>'),
  cpu: svg(
    '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/>'
  ),
  pencil: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  lightbulb: svg(
    '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/>'
  ),
  target: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
  sliders: svg(
    '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>'
  ),
  play: svg('<polygon points="6 4 20 12 6 20 6 4"/>'),
  reset: svg('<path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 3 3 9 9 9"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>'),
};

export const icon = (name) => icons[name] ?? '';
