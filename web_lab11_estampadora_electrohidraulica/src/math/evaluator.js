/**
 * Evaluador matemático seguro basado en math.js.
 *
 * Reglas del proyecto (ver docs/arquitectura.md § Modelo de amenazas):
 *   - NUNCA eval() ni new Function().
 *   - Toda expresión pasa por: longitud máxima → whitelist de caracteres →
 *     análisis sintáctico con math.parse → whitelist de nodos del AST
 *     (solo constantes, variables declaradas, operadores aritméticos y
 *     funciones matemáticas puras) → evaluación con límite de tiempo.
 *
 * Dos vías de evaluación comparten la misma validación:
 *   - evaluateSafe(): vía de referencia. Evalúa con el compilador de math.js
 *     y aplica un timeout (Promise.race). Para entradas del estudiante y
 *     cálculos puntuales.
 *   - compileSafe(): vía rápida para lazos calientes (superficies 3D de
 *     128×128, barridos de frecuencia). Recorre el AST validado de math.js y
 *     construye un árbol de clausuras sobre aritmética compleja nativa.
 *     Las pruebas (tests/evaluator.test.js) verifican que ambas vías coinciden.
 */
import {
  create,
  parseDependencies,
  compileDependencies,
  evaluateDependencies,
  addDependencies,
  subtractDependencies,
  multiplyDependencies,
  divideDependencies,
  powDependencies,
  unaryMinusDependencies,
  unaryPlusDependencies,
  absDependencies,
  argDependencies,
  reDependencies,
  imDependencies,
  conjDependencies,
  expDependencies,
  logDependencies,
  sqrtDependencies,
  sinDependencies,
  cosDependencies,
  complexDependencies,
  piDependencies,
  eDependencies,
  iDependencies,
} from 'mathjs';
import * as Cx from './complex.js';

/** Instancia única y mínima de math.js (solo las funciones que permitimos). */
const math = create(
  {
    parseDependencies,
    compileDependencies,
    evaluateDependencies,
    addDependencies,
    subtractDependencies,
    multiplyDependencies,
    divideDependencies,
    powDependencies,
    unaryMinusDependencies,
    unaryPlusDependencies,
    absDependencies,
    argDependencies,
    reDependencies,
    imDependencies,
    conjDependencies,
    expDependencies,
    logDependencies,
    sqrtDependencies,
    sinDependencies,
    cosDependencies,
    complexDependencies,
    piDependencies,
    eDependencies,
    iDependencies,
  },
  { number: 'number', precision: 64 }
);

export const MAX_LENGTH = 200;
export const DEFAULT_TIMEOUT_MS = 50;
const MAX_SCOPE_KEYS = 24;

/** Caracteres permitidos: letras, dígitos, espacios y + - * / ^ ( ) . , */
const CHAR_WHITELIST = /^[0-9A-Za-z_+\-*/^().,\s]*$/;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,15}$/;

const CONSTANTS = Object.freeze({
  pi: Cx.C(Math.PI),
  e: Cx.C(Math.E),
  i: Cx.C(0, 1),
  j: Cx.C(0, 1), // notación de ingeniería
});

const OPERATORS = Object.freeze({
  add: (a, b) => Cx.add(a, b),
  subtract: (a, b) => Cx.sub(a, b),
  multiply: (a, b) => Cx.mul(a, b),
  divide: (a, b) => Cx.div(a, b),
  pow: (a, b) => Cx.pow(a, b),
  unaryMinus: (a) => Cx.neg(a),
  unaryPlus: (a) => a,
});

const FUNCTIONS = Object.freeze({
  abs: (a) => Cx.C(Cx.abs(a)),
  arg: (a) => Cx.C(Cx.arg(a)),
  re: (a) => Cx.C(a.re),
  im: (a) => Cx.C(a.im),
  conj: (a) => Cx.conj(a),
  exp: (a) => Cx.exp(a),
  log: (a) => Cx.log(a),
  sqrt: (a) => Cx.sqrt(a),
  sin: (a) => Cx.sin(a),
  cos: (a) => Cx.cos(a),
});

export class EvaluationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EvaluationError';
  }
}

/** Valida la cadena (longitud y caracteres). Lanza EvaluationError si no pasa. */
export function validateExpression(expr) {
  if (typeof expr !== 'string') throw new EvaluationError('La expresión debe ser texto.');
  const s = expr.trim();
  if (s.length === 0) throw new EvaluationError('La expresión está vacía.');
  if (s.length > MAX_LENGTH) throw new EvaluationError(`La expresión supera ${MAX_LENGTH} caracteres.`);
  if (!CHAR_WHITELIST.test(s)) throw new EvaluationError('La expresión contiene caracteres no permitidos.');
  return s;
}

/** Recorre el AST y rechaza cualquier nodo fuera de la whitelist. */
function assertSafeTree(node, variables) {
  node.traverse((n, path, parent) => {
    switch (n.type) {
      case 'ConstantNode':
        if (typeof n.value !== 'number' || !Number.isFinite(n.value))
          throw new EvaluationError('Solo se admiten constantes numéricas.');
        break;
      case 'ParenthesisNode':
        break;
      case 'OperatorNode':
        if (!(n.fn in OPERATORS)) throw new EvaluationError(`Operador no permitido: ${n.op}`);
        break;
      case 'FunctionNode':
        if (n.fn.type !== 'SymbolNode' || !(n.fn.name in FUNCTIONS))
          throw new EvaluationError(`Función no permitida: ${n.fn.name ?? '?'}`);
        if (n.args.length !== 1) throw new EvaluationError(`La función ${n.fn.name} recibe un solo argumento.`);
        break;
      case 'SymbolNode': {
        // El nombre de una función aparece como SymbolNode hijo de su FunctionNode.
        const isFnName = parent && parent.type === 'FunctionNode' && path === 'fn';
        if (!isFnName && !(n.name in CONSTANTS) && !variables.includes(n.name))
          throw new EvaluationError(`Símbolo desconocido: ${n.name}`);
        break;
      }
      default:
        throw new EvaluationError(`Construcción no permitida: ${n.type}`);
    }
  });
}

/** Convierte el AST validado en un árbol de clausuras sobre aritmética compleja. */
function buildClosure(node) {
  switch (node.type) {
    case 'ConstantNode': {
      const c = Cx.C(node.value);
      return () => c;
    }
    case 'ParenthesisNode':
      return buildClosure(node.content);
    case 'SymbolNode': {
      const name = node.name;
      if (name in CONSTANTS) {
        const c = CONSTANTS[name];
        return (scope) => (name in scope ? scope[name] : c);
      }
      return (scope) => scope[name];
    }
    case 'OperatorNode': {
      const op = OPERATORS[node.fn];
      const args = node.args.map(buildClosure);
      if (args.length === 1) {
        const [a] = args;
        return (s) => op(a(s));
      }
      const [a, b] = args;
      return (s) => op(a(s), b(s));
    }
    case 'FunctionNode': {
      const fn = FUNCTIONS[node.fn.name];
      const a = buildClosure(node.args[0]);
      return (s) => fn(a(s));
    }
    default:
      throw new EvaluationError(`Nodo no soportado: ${node.type}`);
  }
}

function toComplex(v) {
  if (typeof v === 'number') return Cx.C(v);
  if (v && typeof v === 'object' && typeof v.re === 'number' && typeof v.im === 'number') return Cx.C(v.re, v.im);
  throw new EvaluationError('Las variables deben ser números (reales o {re, im}).');
}

/** Limita el scope a variables numéricas con nombres válidos. */
export function sanitizeScope(scope = {}) {
  const keys = Object.keys(scope);
  if (keys.length > MAX_SCOPE_KEYS) throw new EvaluationError('Demasiadas variables.');
  const out = Object.create(null);
  for (const k of keys) {
    if (!IDENTIFIER.test(k)) throw new EvaluationError(`Nombre de variable inválido: ${k}`);
    const c = toComplex(scope[k]);
    if (!Cx.isFiniteC(c)) throw new EvaluationError(`La variable ${k} no es finita.`);
    out[k] = c;
  }
  return out;
}

function parseValidated(expr, variables) {
  const s = validateExpression(expr);
  for (const v of variables) {
    if (!IDENTIFIER.test(v)) throw new EvaluationError(`Nombre de variable inválido: ${v}`);
  }
  let node;
  try {
    node = math.parse(s);
  } catch (err) {
    throw new EvaluationError(`Sintaxis inválida: ${err.message}`);
  }
  assertSafeTree(node, variables);
  return node;
}

const compileCache = new Map();

/**
 * Compila una expresión validada para evaluación repetida (vía rápida).
 * @param {string} expr  p. ej. "abs((b0 + b1*z^-1)/(1 + a1*z^-1 + a2*z^-2))"
 * @param {{ variables: string[] }} options  variables admitidas en el scope
 * @returns {{ evaluate(scope): {re,im}, evaluateReal(scope): number, source: string }}
 */
export function compileSafe(expr, { variables = [] } = {}) {
  const key = `${expr}|${variables.join(',')}`;
  const cached = compileCache.get(key);
  if (cached) return cached;

  const node = parseValidated(expr, variables);
  const fn = buildClosure(node);
  const compiled = Object.freeze({
    source: node.toString(),
    /** Evalúa con un scope ya complejo ({re, im}); sin validación por llamada. */
    evaluateComplexFast: (scopeC) => fn(scopeC),
    /** Evalúa con validación de scope; devuelve {re, im}. */
    evaluate: (scope) => fn(sanitizeScope(scope)),
    /** Evalúa y exige resultado real finito. */
    evaluateReal: (scope) => toFiniteReal(fn(sanitizeScope(scope))),
  });
  if (compileCache.size > 64) compileCache.clear();
  compileCache.set(key, compiled);
  return compiled;
}

function toFiniteReal(c) {
  const re = typeof c === 'number' ? c : c.re;
  const im = typeof c === 'number' ? 0 : c.im;
  if (!Number.isFinite(re) || !Number.isFinite(im)) throw new EvaluationError('El resultado no es finito.');
  if (Math.abs(im) > 1e-9 * Math.max(1, Math.abs(re)))
    throw new EvaluationError('El resultado es complejo; se esperaba un número real.');
  return re;
}

/** Convierte un resultado de math.js (number | Complex) a número real finito. */
function mathResultToReal(r) {
  if (typeof r === 'number') return toFiniteReal(r);
  if (r && typeof r.re === 'number') return toFiniteReal({ re: r.re, im: r.im });
  throw new EvaluationError('Tipo de resultado no admitido.');
}

/**
 * Evaluación segura de referencia (math.js) con límite de tiempo.
 *
 * Nota honesta: la evaluación de math.js es síncrona, así que el timeout no
 * puede interrumpirla a mitad; se complementa con una comprobación del tiempo
 * transcurrido. La protección real contra expresiones costosas son la longitud
 * máxima y la whitelist del AST (sin bucles, sin funciones definidas por el
 * usuario, sin acceso a objetos).
 *
 * @returns {Promise<number>} número real finito
 */
export function evaluateSafe(expr, scope = {}, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const work = new Promise((resolve, reject) => {
    try {
      const clean = sanitizeScope(scope);
      const node = parseValidated(expr, Object.keys(clean));
      const mathScope = new Map();
      for (const [k, v] of Object.entries(clean)) {
        mathScope.set(k, v.im === 0 ? v.re : math.complex(v.re, v.im));
      }
      // 'j' como unidad imaginaria (notación de ingeniería) si no está en el scope.
      if (!mathScope.has('j')) mathScope.set('j', math.complex(0, 1));
      const t0 = performance.now(); // se cronometra la evaluación, no el análisis sintáctico
      const result = node.compile().evaluate(mathScope);
      if (performance.now() - t0 > timeoutMs) throw new EvaluationError('La evaluación excedió el tiempo permitido.');
      resolve(mathResultToReal(result));
    } catch (err) {
      reject(err instanceof EvaluationError ? err : new EvaluationError(err.message));
    }
  });
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new EvaluationError('La evaluación excedió el tiempo permitido.')), timeoutMs);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/*
 * Calentamiento: math.js crea sus funciones de forma perezosa la primera vez que
 * se usan, y esa primera vez puede tardar más que el timeout de 50 ms. Se hace
 * una evaluación que toca todas las funciones permitidas al cargar el módulo.
 */
try {
  math
    .parse('abs(sqrt(exp(log(cos(sin(2)))))) + arg(-1) + re(1) + im(1) + conj(1) + 2^3 - 1/2*pi + e + i')
    .compile()
    .evaluate();
} catch {
  /* el calentamiento es opcional */
}

/** Versión síncrona de referencia (sin timer), útil en pruebas y en validaciones puntuales. */
export function evaluateReference(expr, scope = {}) {
  const clean = sanitizeScope(scope);
  const node = parseValidated(expr, Object.keys(clean));
  const mathScope = new Map();
  for (const [k, v] of Object.entries(clean)) {
    mathScope.set(k, v.im === 0 ? v.re : math.complex(v.re, v.im));
  }
  if (!mathScope.has('j')) mathScope.set('j', math.complex(0, 1));
  const r = node.compile().evaluate(mathScope);
  return typeof r === 'number' ? Cx.C(r) : Cx.C(r.re, r.im);
}
