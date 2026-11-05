import { describe, expect, it } from 'vitest';
import { createPlanta, PASO, TIEMPOS } from '../src/viz/three/alimentosLogica.js';

const correr = (p, segundos) => {
  for (let i = 0; i < Math.round(segundos / PASO); i++) p.paso();
};
const hasta = (p, condicion, limite = 40) => {
  for (let i = 0; i < Math.round(limite / PASO); i++) {
    if (condicion()) return true;
    p.paso();
  }
  return false;
};
const arrancar = (p) => {
  p.iniciar();
  expect(hasta(p, () => p.auto)).toBe(true);
};

describe('Secuencia de Alimentos Del Valle', () => {
  it('arranca detenida y espera la orden de marcha', () => {
    const p = createPlanta();
    correr(p, 2);
    expect(p.estado()).toBe('Planta detenida');
    expect(p.M[10]).toBe(1);
    expect(p.etapa()).toBe(-1);
    expect(p.quieta()).toBe(true);
  });

  it('ejecuta las diez etapas en orden y vuelve a la etapa 0', () => {
    const p = createPlanta();
    correr(p, 0.1);
    arrancar(p);
    const orden = [];
    const ok = hasta(p, () => {
      const e = p.etapa();
      if (e !== orden.at(-1)) orden.push(e);
      return p.ciclos === 1;
    });
    expect(ok).toBe(true);
    expect(orden.slice(orden.indexOf(1))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);
  });

  it('respeta los tiempos de la guía', () => {
    const p = createPlanta();
    correr(p, 0.1);
    arrancar(p);
    for (const [etapa, t] of [
      [3, TIEMPOS.dosif],
      [4, TIEMPOS.freno],
      [5, TIEMPOS.rev],
    ]) {
      expect(hasta(p, () => p.etapa() === etapa)).toBe(true);
      let medido = 0;
      while (p.etapa() === etapa) {
        p.paso();
        medido += PASO;
      }
      expect(medido).toBeCloseTo(t, 1);
    }
  });

  it('nunca energiza a la vez salidas opuestas ni dosifica sin amarre', () => {
    const p = createPlanta();
    correr(p, 0.1);
    arrancar(p);
    while (p.ciclos < 2) {
      p.paso();
      expect(p.km1 && p.km2).toBe(false);
      expect(p.y1 && p.y2).toBe(false);
      expect(p.y3 && p.y4).toBe(false);
      if (p.km1) expect(p.A.x >= 0.99 && p.B.x >= 0.99).toBe(true);
    }
  });

  it('llena el frasco, lo expulsa y lo entrega a la tapadora', () => {
    const p = createPlanta();
    correr(p, 0.1);
    arrancar(p);
    expect(hasta(p, () => p.etapa() === 4)).toBe(true);
    expect(p.frascos.find((f) => f.estado === 'asiento').fill).toBeCloseTo(1, 1);
    expect(hasta(p, () => p.terminados === 1, 60)).toBe(true);
  });

  it('STOP termina el ciclo y no inicia otro', () => {
    const p = createPlanta();
    correr(p, 0.1);
    arrancar(p);
    expect(hasta(p, () => p.etapa() === 3)).toBe(true);
    p.parar();
    expect(hasta(p, () => p.ciclos === 1)).toBe(true);
    correr(p, 15);
    expect(p.etapa()).toBe(0);
    expect(p.ciclos).toBe(1);
  });

  it('la emergencia vacía GP, para M1, retiene A y B y retrae C', () => {
    const p = createPlanta();
    correr(p, 0.1);
    arrancar(p);
    expect(hasta(p, () => p.etapa() === 3)).toBe(true);
    correr(p, 0.5);
    p.alternarEmergencia();
    correr(p, 1);
    expect(p.etapa()).toBe(-1);
    expect(p.km1).toBe(false);
    expect(p.A.x).toBe(1);
    expect(p.B.x).toBe(1);
    expect(p.vBanda).toBeLessThan(0.05);

    p.iniciar();
    correr(p, 1);
    expect(p.M[10]).toBe(1); // no rearma con S0 pulsado

    p.alternarEmergencia();
    arrancar(p);
    expect(p.frascos.some((f) => f.estado === 'asiento' && f.fill > 0)).toBe(false);
    expect(p.A.x).toBeLessThan(0.02); // a0 y b0 ya confirmados; el final de carrera sigue amortiguando
    expect(p.B.x).toBeLessThan(0.02);
  });

  it('la emergencia durante la expulsión retrae C por resorte', () => {
    const p = createPlanta();
    correr(p, 0.1);
    arrancar(p);
    expect(hasta(p, () => p.etapa() === 8)).toBe(true);
    correr(p, 0.6);
    expect(p.C.x).toBe(1);
    p.alternarEmergencia();
    correr(p, 1);
    expect(p.C.x).toBe(0);
  });

  it('RT1 detiene la succión y exige rearme', () => {
    const p = createPlanta();
    correr(p, 0.1);
    arrancar(p);
    expect(hasta(p, () => p.etapa() === 5)).toBe(true);
    p.alternarTermico();
    correr(p, 0.1);
    expect(p.km2).toBe(false);
    expect(p.M[10]).toBe(1);
    p.alternarTermico();
    arrancar(p);
    expect(p.etapa()).toBeGreaterThanOrEqual(0);
  });

  it('reiniciar devuelve la planta al estado inicial desde cualquier etapa', () => {
    const p = createPlanta();
    correr(p, 0.1);
    arrancar(p);
    expect(hasta(p, () => p.etapa() === 5)).toBe(true);
    p.reiniciar();
    correr(p, 3);
    expect(p.estado()).toBe('Planta detenida');
    expect(p.A.x).toBe(0);
    expect(p.B.x).toBe(0);
    expect(p.C.x).toBe(0);
    expect(p.frascos.every((f) => f.estado === 'libre')).toBe(true);
    expect(p.quieta()).toBe(true);
  });

  it('el movimiento es continuo: sin saltos de posición entre barridos', () => {
    const p = createPlanta();
    correr(p, 0.1);
    arrancar(p);
    let maxSalto = 0;
    while (p.ciclos < 1) {
      p.paso();
      for (const c of [p.A, p.B, p.C]) maxSalto = Math.max(maxSalto, Math.abs(c.x - c.prev));
    }
    expect(maxSalto).toBeLessThan(0.02);
  });
});
