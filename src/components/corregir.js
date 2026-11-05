/**
 * Reglas de corrección de las actividades (funciones puras, sin DOM: se prueban
 * en tests/corregir.test.js).
 */

/** Tolerancia por defecto: 0.5 % relativo, con un mínimo absoluto de 0.001. */
export const numeroCorrecto = (obtenido, esperado, tol) =>
  Math.abs(obtenido - esperado) <= (tol ?? Math.max(5e-3 * Math.abs(esperado), 1e-3));

/** Minúsculas, sin tildes ni espacios sobrantes: "  Célula " y "celula" son iguales. */
export const normalizar = (s) =>
  String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const textoCorrecto = (obtenido, aceptadas) => aceptadas.map(normalizar).includes(normalizar(obtenido));

/** Opción múltiple: acierta si marca exactamente las opciones correctas. */
export function opcionesCorrectas(marcadas, correcta) {
  const esperadas = [].concat(correcta);
  return marcadas.length === esperadas.length && esperadas.every((i) => marcadas.includes(i));
}
