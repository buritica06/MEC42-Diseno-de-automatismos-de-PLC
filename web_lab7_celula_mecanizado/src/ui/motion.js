/**
 * GSAP: transiciones de interfaz y microinteracciones.
 *
 * Alcance (ver docs/arquitectura.md): solo DOM. GSAP NO anima geometría 3D
 * (eso lo hace el render loop de Three.js) ni gráficas Plotly (Plotly.react).
 * Con prefers-reduced-motion todo salta directamente a su estado final.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ ease: 'power2.out', duration: 0.4 });

const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
export const prefersReducedMotion = () => reduceQuery.matches;
// Sin animación con movimiento reducido o con la pestaña oculta (no hay frames que avancen el tween).
const instant = () => reduceQuery.matches || document.hidden;

/** Barra de progreso: tween del ancho y del porcentaje. */
export function tweenProgress(barEl, labelEl, ratio) {
  const pct = Math.round(ratio * 100);
  if (instant()) {
    gsap.set(barEl, { width: `${pct}%` });
    if (labelEl) labelEl.textContent = `${pct} %`;
    return;
  }
  gsap.to(barEl, { width: `${pct}%`, duration: 0.6 });
  if (labelEl) {
    const state = { v: parseInt(labelEl.textContent, 10) || 0 };
    gsap.to(state, {
      v: pct,
      duration: 0.6,
      onUpdate: () => (labelEl.textContent = `${Math.round(state.v)} %`),
    });
  }
}

/** Contador numérico junto a un control (p. ej. |p₁| al mover un slider). */
export function tweenNumber(el, to, format = (v) => v.toFixed(3)) {
  if (!Number.isFinite(to)) {
    gsap.killTweensOf(el._tweenState ?? {});
    el.textContent = to === Infinity ? '∞' : '—';
    el._value = undefined;
    return;
  }
  const from = Number.isFinite(el._value) ? el._value : to;
  el._value = to;
  if (instant() || from === to) {
    el.textContent = format(to);
    return;
  }
  const state = (el._tweenState = { v: from });
  gsap.to(state, {
    v: to,
    duration: 0.25,
    overwrite: true,
    onUpdate: () => (el.textContent = format(state.v)),
  });
}

/**
 * Entrada de una vista (capítulo o portada) y aparición escalonada de tarjetas.
 * Devuelve un contexto GSAP para revertir todo al desmontar la vista.
 */
export function animateViewIn(root) {
  const ctx = gsap.context(() => {
    const mm = gsap.matchMedia();
    mm.add({ reduceMotion: '(prefers-reduced-motion: reduce)', ok: '(prefers-reduced-motion: no-preference)' }, (c) => {
      // Estado final inmediato con movimiento reducido o si la pestaña está oculta
      // (en segundo plano no hay frames: el contenido quedaría invisible).
      if (c.conditions.reduceMotion || document.hidden) return;
      gsap.from(root, { opacity: 0, y: 12, duration: 0.5, clearProps: 'all' });
      const cards = root.querySelectorAll('.card');
      if (cards.length) {
        gsap.from(cards, { opacity: 0, y: 18, duration: 0.45, stagger: 0.06, delay: 0.1, clearProps: 'all' });
      }
      // Secciones y bloques que aparecen al hacer scroll
      const reveals = root.querySelectorAll('.reveal');
      if (reveals.length) {
        gsap.set(reveals, { opacity: 0, y: 16 });
        ScrollTrigger.batch(reveals, {
          start: 'top 95%',
          once: true,
          onEnter: (els) =>
            gsap.to(els, { opacity: 1, y: 0, stagger: 0.08, duration: 0.45, clearProps: 'transform,opacity' }),
        });
      }
    });
  }, root);
  return ctx;
}

/** Salida rápida de la vista anterior antes de cambiar de capítulo. */
export function animateViewOut(root) {
  if (instant() || !root.firstElementChild) return Promise.resolve();
  const tween = gsap.to(root, { opacity: 0, y: -8, duration: 0.2 });
  // Si el navegador congela los frames (pestaña en segundo plano), la navegación no debe quedarse esperando.
  const timeout = new Promise((resolve) => setTimeout(resolve, 350));
  return Promise.race([tween.then(), timeout]).then(() => {
    tween.kill();
    gsap.set(root, { clearProps: 'all' });
  });
}

/** Recalcula las posiciones de ScrollTrigger tras montar contenido dinámico. */
export function refreshScroll() {
  ScrollTrigger.refresh();
}

/** Pulso breve sobre un botón (p. ej. al marcar un capítulo como completado). */
export function pulse(el) {
  if (instant()) return;
  gsap.fromTo(el, { scale: 0.96 }, { scale: 1, duration: 0.3, ease: 'back.out(3)', clearProps: 'transform' });
}

export { gsap };
