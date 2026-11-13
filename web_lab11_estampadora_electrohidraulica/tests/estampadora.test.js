import { describe, it, expect } from 'vitest';
import { createPlanta, medirCiclo, PASO, T1 } from '../src/viz/three/estampadoraLogica.js';

/** Avanza la planta `s` segundos de simulación. */
const avanzar = (p, s) => {
  for (let i = 0; i < Math.round(s / PASO); i++) p.paso();
};
/** Avanza hasta que se cumpla la condición (o falla a los 30 s). */
const hasta = (p, condicion) => {
  for (let i = 0; i < 30 / PASO; i++) {
    if (condicion()) return;
    p.paso();
  }
  throw new Error('La condición no se cumplió en 30 s');
};

describe('GRAFCET de producción', () => {
  it('recorre las etapas 1 a 7 en orden y vuelve a reposo', () => {
    const tramos = medirCiclo();
    expect(tramos.map((t) => t.etapa)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('mantiene el estampado exactamente el tiempo t1', () => {
    const e3 = medirCiclo().find((t) => t.etapa === 3);
    expect(e3.fin - e3.inicio).toBeCloseTo(T1, 1);
  });

  it('no arranca con la guarda abierta', () => {
    const p = createPlanta();
    p.alternarGuarda();
    avanzar(p, 1);
    p.marcha();
    avanzar(p, 2);
    expect(p.etapa()).toBe(0);
  });

  it('energiza los solenoides de la tabla de secuencia', () => {
    const p = createPlanta();
    p.continuo = false;
    p.marcha();
    hasta(p, () => p.etapa() === 2);
    p.paso();
    expect([p.y1, p.y2, p.y3, p.y6]).toEqual([true, true, false, false]);
    hasta(p, () => p.etapa() === 3);
    p.paso();
    expect([p.y1, p.y2, p.y6]).toEqual([true, false, true]);
    hasta(p, () => p.etapa() === 5);
    p.paso();
    expect([p.y1, p.y3, p.y4]).toEqual([false, false, false]);
  });
});

describe('Enclavamientos y fallas', () => {
  it('sin presión en B7 el ciclo se detiene en la etapa 1', () => {
    const p = createPlanta();
    p.fallaB7 = true;
    p.marcha();
    avanzar(p, 6);
    expect(p.etapa()).toBe(1);
    expect(p.sensores().B2).toBe(true);
    expect(p.sensores().B7).toBe(false);
  });

  it('con el carro atascado el motor D no arranca', () => {
    const p = createPlanta();
    p.atascoB = true;
    p.marcha();
    avanzar(p, 8);
    expect(p.etapa()).toBe(2);
    expect(p.y6).toBe(false);
    expect(p.golpes).toBe(0);
  });
});

describe('GRAFCET de seguridad', () => {
  it('el paro de emergencia vacía GP y lleva los ejes al origen', () => {
    const p = createPlanta();
    p.marcha();
    hasta(p, () => p.etapa() === 3);
    avanzar(p, 1);
    p.alternarEmergencia();
    avanzar(p, 0.05);
    expect(p.etapa()).toBe(-1);
    expect([p.y1, p.y6, p.y3, p.y5]).toEqual([false, false, true, true]);
    avanzar(p, 5);
    const s = p.sensores();
    expect(s.B1 && s.B3 && s.B5).toBe(true);
    expect(p.w).toBe(0);
  });

  it('solo rearma con S0 liberado y S2', () => {
    const p = createPlanta();
    p.alternarEmergencia();
    avanzar(p, 1);
    p.rearme(); // S0 sigue pulsado: se ignora
    avanzar(p, 1);
    expect(p.etapaGS()).toBe(11);
    p.alternarEmergencia();
    avanzar(p, 1);
    expect(p.etapaGS()).toBe(11);
    p.rearme();
    avanzar(p, 0.1);
    expect(p.etapaGS()).toBe(10);
    expect(p.etapa()).toBe(0);
  });
});
