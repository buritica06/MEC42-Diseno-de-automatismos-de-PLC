/**
 * Navegación por capítulos: lista lateral (escritorio) y cajón deslizable (móvil).
 * El capítulo actual se marca con aria-current="page"; los completados, con ✓.
 */
import { icon } from './icons.js';

export function createNav({ capitulos, progress, root = document }) {
  const nav = root.querySelector('.chapter-nav');
  const sidebar = root.querySelector('.sidebar');
  const backdrop = root.querySelector('.sidebar-backdrop');
  const toggle = root.querySelector('[data-action="toggle-nav"]');
  const mobile = window.matchMedia('(max-width: 899px)');
  let current = null;

  toggle.innerHTML = icon('menu');

  function render() {
    const items = capitulos
      .map((c) => {
        const done = progress.isCompleted(c.id);
        const isCurrent = c.id === current;
        return `<li>
          <a href="#/capitulo/${c.id}" ${isCurrent ? 'aria-current="page"' : ''} data-id="${c.id}">
            <span class="chapter-nav__num" aria-hidden="true">${c.numero}</span>
            <span>${c.corto}<span class="visually-hidden">${done ? ' (completado)' : ''}</span></span>
            <span class="chapter-nav__check" aria-hidden="true">${done ? icon('checkCircle') : ''}</span>
          </a>
        </li>`;
      })
      .join('');
    nav.innerHTML = `
      <ol class="chapter-nav__home">
        <li><a href="#/" ${current === null ? 'aria-current="page"' : ''}>
          <span class="chapter-nav__num" aria-hidden="true">${icon('home')}</span><span>Inicio</span><span></span>
        </a></li>
      </ol>
      <p class="chapter-nav__heading" id="nav-heading">Capítulos</p>
      <ol aria-labelledby="nav-heading">${items}</ol>`;
  }

  function setOpen(open) {
    sidebar.classList.toggle('is-open', open);
    backdrop.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.innerHTML = icon(open ? 'close' : 'menu');
    toggle.setAttribute('aria-label', open ? 'Cerrar menú de capítulos' : 'Abrir menú de capítulos');
    // En móvil, el cajón cerrado no debe recibir foco por teclado.
    if (mobile.matches) sidebar.inert = !open;
    if (open) nav.querySelector('a[aria-current="page"], a')?.focus();
  }

  toggle.addEventListener('click', () => setOpen(!sidebar.classList.contains('is-open')));
  backdrop.addEventListener('click', () => setOpen(false));
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a') && mobile.matches) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
  const syncMode = () => {
    sidebar.inert = mobile.matches && !sidebar.classList.contains('is-open');
    if (!mobile.matches) {
      sidebar.classList.remove('is-open');
      backdrop.hidden = true;
    }
  };
  mobile.addEventListener?.('change', syncMode);
  syncMode();

  progress.subscribe(render);
  render();

  return {
    setCurrent(id) {
      current = id;
      render();
    },
    close: () => setOpen(false),
  };
}
