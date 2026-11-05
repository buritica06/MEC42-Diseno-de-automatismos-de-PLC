import { describe, it, expect } from 'vitest';
import {
  compileSafe,
  evaluateSafe,
  evaluateReference,
  validateExpression,
  EvaluationError,
} from '../src/math/evaluator.js';

describe('validateExpression', () => {
  it('acepta expresiones aritméticas', () => {
    expect(validateExpression(' 2*z^2 + 1 ')).toBe('2*z^2 + 1');
  });
  it('rechaza caracteres fuera de la whitelist', () => {
    for (const bad of ['a=1', 'x["y"]', 'f(x)={}', 'a;b', "'x'", 'a[0]', 'x > 1']) {
      expect(() => validateExpression(bad)).toThrow(EvaluationError);
    }
  });
  it('rechaza expresiones demasiado largas', () => {
    expect(() => validateExpression('1+'.repeat(150) + '1')).toThrow(/caracteres/);
  });
});

describe('whitelist del AST', () => {
  it('rechaza funciones peligrosas o desconocidas', () => {
    for (const bad of ['evaluate(1)', 'parse(1)', 'import(1)', 'createUnit(1)', 'foo(2)']) {
      expect(() => compileSafe(bad)).toThrow(EvaluationError);
    }
  });
  it('rechaza símbolos no declarados', () => {
    expect(() => compileSafe('x + 1')).toThrow(/Símbolo desconocido/);
    expect(() => compileSafe('x + 1', { variables: ['x'] })).not.toThrow();
  });
  it('rechaza asignaciones de función y rangos', () => {
    expect(() => compileSafe('f(x) = x')).toThrow();
    expect(() => compileSafe('1:5')).toThrow();
  });
});

describe('vía rápida vs. vía de referencia (math.js)', () => {
  const expr = 'K*(b0 + b1*z^-1)/(1 + a1*z^-1 + a2*z^-2)';
  const vars = ['K', 'b0', 'b1', 'a1', 'a2', 'z'];
  const compiled = compileSafe(expr, { variables: vars });
  const cases = [
    { z: { re: 0.3, im: 0.7 } },
    { z: { re: -1.2, im: 0.1 } },
    { z: { re: 1, im: 0 } },
    { z: { re: 0.01, im: -2 } },
  ];
  for (const c of cases) {
    it(`coincide en z = ${c.z.re} + ${c.z.im}j`, () => {
      const scope = { K: 1.5, b0: 1, b1: 0.5, a1: -1.3, a2: 0.4, ...c };
      const fast = compiled.evaluate(scope);
      const ref = evaluateReference(expr, scope);
      expect(fast.re).toBeCloseTo(ref.re, 10);
      expect(fast.im).toBeCloseTo(ref.im, 10);
    });
  }
  it('funciones abs, arg, exp, sqrt, cos', () => {
    const e = 'abs(exp(j*w)) + arg(-1) + sqrt(4) + cos(0)';
    const f = compileSafe(e, { variables: ['w'] });
    expect(f.evaluateReal({ w: 0.3 })).toBeCloseTo(1 + Math.PI + 2 + 1, 12);
  });
});

describe('evaluateSafe', () => {
  it('devuelve número finito', async () => {
    await expect(evaluateSafe('10 - 22.4/3*0.8^2 + 2/3*0.5^2')).resolves.toBeCloseTo(
      10 - (22.4 / 3) * 0.64 + (2 / 3) * 0.25,
      10
    );
  });
  it('rechaza resultados complejos', async () => {
    await expect(evaluateSafe('sqrt(-4)')).rejects.toThrow(/complejo/);
  });
  it('rechaza resultados no finitos', async () => {
    await expect(evaluateSafe('1/0')).rejects.toThrow(EvaluationError);
  });
  it('valida el scope', async () => {
    await expect(evaluateSafe('x', { 'x.y': 1 })).rejects.toThrow(/inválido/);
    await expect(evaluateSafe('x', { x: 'hola' })).rejects.toThrow(/números/);
  });
});
