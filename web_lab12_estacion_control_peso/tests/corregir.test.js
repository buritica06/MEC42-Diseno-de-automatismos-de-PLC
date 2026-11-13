import { describe, it, expect } from 'vitest';
import { numeroCorrecto, normalizar, textoCorrecto, opcionesCorrectas } from '../src/components/corregir.js';

describe('numeroCorrecto', () => {
  it('acepta 0.5 % de error relativo', () => {
    expect(numeroCorrecto(100.4, 100)).toBe(true);
    expect(numeroCorrecto(100.6, 100)).toBe(false);
  });
  it('usa un mínimo absoluto cerca de cero', () => {
    expect(numeroCorrecto(0.0005, 0)).toBe(true);
    expect(numeroCorrecto(0.01, 0)).toBe(false);
  });
  it('respeta una tolerancia propia', () => {
    expect(numeroCorrecto(10.5, 10, 1)).toBe(true);
  });
});

describe('texto', () => {
  it('ignora mayúsculas, tildes y espacios', () => {
    expect(normalizar('  Célula   Madre ')).toBe('celula madre');
    expect(textoCorrecto('MITOSIS', ['mitosis'])).toBe(true);
    expect(textoCorrecto('meiosis', ['mitosis'])).toBe(false);
  });
});

describe('opcionesCorrectas', () => {
  it('opción única', () => {
    expect(opcionesCorrectas([2], 2)).toBe(true);
    expect(opcionesCorrectas([1], 2)).toBe(false);
    expect(opcionesCorrectas([], 2)).toBe(false);
  });
  it('varias opciones: deben coincidir exactamente', () => {
    expect(opcionesCorrectas([2, 0], [0, 2])).toBe(true);
    expect(opcionesCorrectas([0], [0, 2])).toBe(false);
    expect(opcionesCorrectas([0, 1, 2], [0, 2])).toBe(false);
  });
});
