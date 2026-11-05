/**
 * Render de fórmulas con KaTeX.
 *  - renderMath(el, latex, displayMode): fórmula dinámica (se llama de nuevo al mover sliders).
 *  - renderMathIn(root): auto-render del contenido estático con delimitadores \( … \) y \[ … \].
 * KaTeX genera MathML oculto junto al HTML visual: los lectores de pantalla lo leen.
 */
import katex from 'katex';
import renderMathInElement from 'katex/contrib/auto-render';
import { katexMacros } from './katex-macros.js';

const BASE = {
  throwOnError: false,
  output: 'htmlAndMathml',
  strict: 'ignore',
  trust: false,
};

// Copia por llamada: KaTeX muta el objeto de macros con \gdef.
const macros = () => ({ ...katexMacros });

export function renderMath(element, latex, displayMode = false) {
  katex.render(latex, element, { ...BASE, displayMode, macros: macros() });
}

export function mathToString(latex, displayMode = false) {
  return katex.renderToString(latex, { ...BASE, displayMode, macros: macros() });
}

export function renderMathIn(root) {
  renderMathInElement(root, {
    ...BASE,
    macros: macros(),
    delimiters: [
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false },
    ],
    ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option'],
    ignoredClasses: ['no-math'],
  });
}
