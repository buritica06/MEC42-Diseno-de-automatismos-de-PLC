/**
 * Macros KaTeX compartidas por todo el sitio. Úsalas en el contenido para que
 * la notación sea idéntica en todos los capítulos (ver docs/guia-contenido.md).
 *
 *   \Z{x[k]}        → 𝒵{x[k]}            transformada Z
 *   \iZ{X(z)}       → 𝒵⁻¹{X(z)}          transformada Z inversa
 *   \pole{1}        → p₁                 polo
 *   \zero{1}        → c₁                 cero
 *   \zinv           → z⁻¹                operador de retardo
 *   \Gz             → G(z)
 *   \abs{x}         → |x|
 *   \tab            → un espacio amplio
 */
export const katexMacros = {
  '\\Z': '\\mathcal{Z}\\left\\{#1\\right\\}',
  '\\iZ': '\\mathcal{Z}^{-1}\\left\\{#1\\right\\}',
  '\\Ztransform': '\\mathcal{Z}\\left\\{#1\\right\\}',
  '\\pole': 'p_{#1}',
  '\\zero': 'c_{#1}',
  '\\zinv': 'z^{-1}',
  '\\Gz': 'G(z)',
  '\\abs': '\\left|#1\\right|',
  '\\tab': '\\qquad',
  '\\R': '\\mathbb{R}',
  '\\Cset': '\\mathbb{C}',
};
