/**
 * Base común de los capítulos.
 *
 * Un capítulo = un archivo HTML de contenido (con fórmulas \( … \) y \[ … \])
 * + marcadores <div data-viz="nombre" data-preset="clave"></div> donde se
 * montan las visualizaciones + (opcional) una función setup() para
 * interactividad propia (paso a paso, ejercicios…).
 *
 * El router añade la cabecera (título, objetivos) y el pie (completado,
 * anterior/siguiente); el capítulo solo aporta su cuerpo.
 */
export function createChapter({ html, objetivos = [], presets = {}, setup }) {
  return {
    objetivos,
    /**
     * @param {HTMLElement} root  contenedor .prose del capítulo
     * @param {{ mountViz, renderMathIn, track(fn) }} ctx
     */
    render(root, ctx) {
      root.insertAdjacentHTML('beforeend', html);
      ctx.renderMathIn(root);
      root.querySelectorAll('[data-viz]').forEach((slot) => {
        const preset = presets[slot.dataset.preset] ?? {};
        const handle = ctx.mountViz(slot, slot.dataset.viz, preset);
        ctx.track(() => handle.dispose());
      });
      // Bloques de contenido que aparecen con GSAP al hacer scroll
      root
        .querySelectorAll(':scope > h2, :scope > .callout, :scope > .table-wrap')
        .forEach((el) => el.classList.add('reveal'));
      setup?.(root, ctx);
    },
  };
}
