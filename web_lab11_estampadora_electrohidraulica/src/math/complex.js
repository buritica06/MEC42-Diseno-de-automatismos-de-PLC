/**
 * Aritmética compleja mínima sobre objetos planos { re, im }.
 *
 * Se usa en los lazos calientes (superficies 3D de 128×128 puntos, barridos
 * de frecuencia) donde crear instancias de math.js por punto sería demasiado
 * lento. Todas las funciones son puras y devuelven objetos nuevos.
 */

export const C = (re, im = 0) => ({ re, im });

export const ZERO = Object.freeze(C(0, 0));
export const ONE = Object.freeze(C(1, 0));

export const add = (a, b) => C(a.re + b.re, a.im + b.im);
export const sub = (a, b) => C(a.re - b.re, a.im - b.im);
export const mul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const scale = (a, s) => C(a.re * s, a.im * s);
// 0 − x en vez de −x: evita el −0, que haría arg(−1) = −π en lugar de π.
export const neg = (a) => C(0 - a.re, 0 - a.im);
export const conj = (a) => C(a.re, -a.im);
export const abs = (a) => Math.hypot(a.re, a.im);
export const arg = (a) => Math.atan2(a.im, a.re);

/** División robusta (algoritmo de Smith): evita desbordes cuando |b| es grande o pequeño. */
export function div(a, b) {
  if (Math.abs(b.re) >= Math.abs(b.im)) {
    if (b.re === 0 && b.im === 0) return C(Infinity, Infinity);
    const r = b.im / b.re;
    const d = b.re + b.im * r;
    return C((a.re + a.im * r) / d, (a.im - a.re * r) / d);
  }
  const r = b.re / b.im;
  const d = b.re * r + b.im;
  return C((a.re * r + a.im) / d, (a.im * r - a.re) / d);
}

export const exp = (a) => {
  const m = Math.exp(a.re);
  return C(m * Math.cos(a.im), m * Math.sin(a.im));
};

export const log = (a) => C(Math.log(abs(a)), arg(a));

export function sqrt(a) {
  const m = abs(a);
  const re = Math.sqrt((m + a.re) / 2);
  const im = Math.sign(a.im || 1) * Math.sqrt(Math.max(0, (m - a.re) / 2));
  return C(re, im);
}

/** Potencia entera exacta por multiplicación repetida (z^2, z^-3…). */
export function powInt(a, n) {
  if (n === 0) return C(1, 0);
  let base = n < 0 ? div(ONE, a) : a;
  let k = Math.abs(n);
  let acc = C(1, 0);
  while (k > 0) {
    if (k & 1) acc = mul(acc, base);
    base = mul(base, base);
    k >>= 1;
  }
  return acc;
}

/** Potencia general a^b. Usa la vía entera cuando el exponente es entero pequeño. */
export function pow(a, b) {
  if (b.im === 0 && Number.isInteger(b.re) && Math.abs(b.re) <= 64) return powInt(a, b.re);
  if (a.re === 0 && a.im === 0) return b.re > 0 ? C(0, 0) : C(Infinity, 0);
  return exp(mul(b, log(a)));
}

export const sin = (a) => C(Math.sin(a.re) * Math.cosh(a.im), Math.cos(a.re) * Math.sinh(a.im));
export const cos = (a) => C(Math.cos(a.re) * Math.cosh(a.im), -Math.sin(a.re) * Math.sinh(a.im));

/** Polar → cartesiano. */
export const polar = (r, theta) => C(r * Math.cos(theta), r * Math.sin(theta));

export const isFiniteC = (a) => Number.isFinite(a.re) && Number.isFinite(a.im);

/** Formatea z como "0.80 + 0.30j" (notación de ingeniería con j). */
export function format(a, digits = 2, tol = 1e-9) {
  const re = Math.abs(a.re) < tol ? 0 : a.re;
  const im = Math.abs(a.im) < tol ? 0 : a.im;
  const f = (x) => x.toFixed(digits).replace('-', '−');
  if (im === 0) return f(re);
  if (re === 0) return `${f(im)}j`;
  return `${f(re)} ${im < 0 ? '−' : '+'} ${Math.abs(im).toFixed(digits)}j`;
}

/** Igual que format() pero en sintaxis LaTeX para KaTeX. */
export function toLatex(a, digits = 3, tol = 1e-9) {
  const re = Math.abs(a.re) < tol ? 0 : a.re;
  const im = Math.abs(a.im) < tol ? 0 : a.im;
  const f = (x) => x.toFixed(digits);
  if (im === 0) return f(re);
  if (re === 0) return `${f(im)}j`;
  return `${f(re)} ${im < 0 ? '-' : '+'} ${Math.abs(im).toFixed(digits)}j`;
}
