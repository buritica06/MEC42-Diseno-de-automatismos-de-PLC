import { describe, expect, it } from 'vitest';
import { createPlanta, PASO, ESTACIONES } from '../src/viz/three/giroLogica.js';
import { CICLO_NOMINAL, TEMPORIZADORES } from '../src/content/secuencia.js';

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
const enEtapa = (p, k) => () => p.etapasGP().includes(String(k));
const arrancar = (p) => {
  p.iniciar();
  expect(hasta(p, () => p.M[22])).toBe(true);
};

describe('Estación de giro temporizado', () => {
  it('arranca en la etapa 30 de GS y no se mueve sin orden', () => {
    const p = createPlanta();
    correr(p, 2);
    expect(p.M[30]).toBe(true);
    expect(p.etapasGP()).toEqual([]);
    expect(p.quieta()).toBe(true);
  });

  it('MARCHA ejecuta reposición, lubrica 3.0 s y solo entonces memoriza la marcha', () => {
    const p = createPlanta();
    correr(p, 0.05);
    p.iniciar();
    expect(hasta(p, () => p.M[21])).toBe(true);
    let lub = 0;
    while (p.M[21]) {
      expect(p.salidas.KM_LUB).toBe(true);
      expect(p.M[22]).toBeFalsy();
      p.paso();
      lub += PASO;
    }
    expect(lub).toBeCloseTo(TEMPORIZADORES.lub, 1);
    expect(p.M[22]).toBe(true);
  });

  it('recorre GP 0 → 9 con la divergencia y convergencia en Y y vuelve a 0', () => {
    const p = createPlanta();
    correr(p, 0.05);
    arrancar(p);
    const visto = [];
    const ok = hasta(p, () => {
      const e = p.etapasGP().join('+');
      if (e && e !== visto.at(-1)) visto.push(e);
      return p.ciclos === 1;
    });
    expect(ok).toBe(true);
    const desde1 = visto.slice(visto.indexOf('1'));
    expect(desde1.slice(0, 6)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(desde1).toContain('7+8');
    expect(desde1).toContain('7w+8w');
    expect(desde1.at(-2)).toBe('9');
    expect(desde1.at(-1)).toBe('0');
  });

  it('el ciclo productivo dura lo previsto en la guía (6.6 s)', () => {
    const p = createPlanta();
    correr(p, 0.05);
    arrancar(p);
    expect(hasta(p, () => p.ciclos === 2, 60)).toBe(true);
    expect(CICLO_NOMINAL).toBeCloseTo(6.6, 5);
    expect(Math.abs(p.ultimoCiclo - CICLO_NOMINAL)).toBeLessThan(0.12);
  });

  it('la mesa avanza exactamente 60° por ciclo y queda bloqueada', () => {
    const p = createPlanta();
    correr(p, 0.05);
    arrancar(p);
    const a0 = p.mesa.ang;
    expect(hasta(p, () => p.ciclos === 1)).toBe(true);
    expect(p.mesa.ang - a0).toBeCloseTo(60, 6);
    expect(p.E.u).toBe(0);
  });

  it('nunca energiza a la vez bobinas opuestas y no mecaniza con la mesa sin bloquear', () => {
    const p = createPlanta();
    correr(p, 0.05);
    arrancar(p);
    while (p.ciclos < 2) {
      p.paso();
      const q = p.salidas;
      expect(q.Y1p && q.Y1m).toBe(false);
      expect(q.Y2p && q.Y2m).toBe(false);
      expect(q.Y3p && q.Y3m).toBe(false);
      if (p.FK.u > 0 && p.FK.dir > 0) expect(p.E.u).toBe(0);
      // Los carros solo se trasladan con A y C arriba
      if (p.BD.u !== p.BD.prev) expect(p.AC.u).toBe(0);
    }
  });

  it('transporta la pieza bruta a la mesa y la terminada a la cinta 2', () => {
    const p = createPlanta();
    correr(p, 0.05);
    arrancar(p);
    expect(hasta(p, () => p.ciclos === 1)).toBe(true);
    expect(p.terminadas).toBe(1);
    const enCarga = p.cunas[p.cunaEn(ESTACIONES.carga)];
    // Tras el giro la cuna de carga recibió la pieza nueva (nivel 0) del transporte 1
    expect(p.piezas[enCarga].nivel).toBe(0);
    // La pieza que pasó por la estación 1 quedó taladrada
    expect(p.piezas[p.cunas[p.cunaEn(ESTACIONES.p1)]].nivel).toBeGreaterThanOrEqual(1);
  });

  it('PARADA termina el ciclo vigente y no inicia otro', () => {
    const p = createPlanta();
    correr(p, 0.05);
    arrancar(p);
    expect(hasta(p, enEtapa(p, 4))).toBe(true);
    p.parar();
    expect(hasta(p, () => p.ciclos === 1)).toBe(true);
    correr(p, 10);
    expect(p.ciclos).toBe(1);
    expect(p.etapasGP()).toEqual(['0']);
    expect(p.M[20]).toBe(true);
  });

  it('emergencia en 3 → 4: vacía GP, retiene ventosas, E termina el giro y B, D retornan', () => {
    const p = createPlanta();
    correr(p, 0.05);
    arrancar(p);
    expect(hasta(p, enEtapa(p, 4))).toBe(true);
    correr(p, 0.4);
    p.alternarEmergencia();
    correr(p, 2);
    expect(p.etapasGP()).toEqual([]);
    expect(p.V).toBe(true); // H_VENTOSA conserva su estado
    expect(p.E.u).toBe(1); // finaliza el giro por retención biestable
    expect(p.BD.u).toBe(0); // A y C arriba → B y D retornan
    expect(p.FK.u).toBe(0);
  });

  it('reposición: A y C llegan a origen antes de que B y D empiecen a retornar', () => {
    const p = createPlanta();
    correr(p, 0.05);
    arrancar(p);
    expect(hasta(p, enEtapa(p, 5))).toBe(true);
    correr(p, 0.3);
    p.alternarEmergencia();
    correr(p, 1.5);
    expect(p.AC.u).toBe(1); // A, C finalizan el descenso
    expect(p.BD.u).toBe(1); // con A, C abajo, B y D no retornan
    p.alternarEmergencia();
    p.iniciar();
    let bdMovio = false;
    const ok = hasta(p, () => p.M[36] || p.M[33], 20);
    expect(ok).toBe(true);
    // Repite comprobando el orden durante toda la reposición
    const q = createPlanta();
    correr(q, 0.05);
    arrancar(q);
    expect(hasta(q, enEtapa(q, 5))).toBe(true);
    correr(q, 0.3);
    q.alternarEmergencia();
    correr(q, 1.5);
    q.alternarEmergencia();
    q.iniciar();
    while (!q.M[33] && !q.M[36]) {
      q.paso();
      if (q.BD.u < 1) bdMovio = true;
      if (bdMovio) expect(q.AC.u).toBe(0);
    }
    expect(bdMovio).toBe(true);
  });

  it('tras la reposición con ventosas activas, la nueva MARCHA deposita las piezas y reanuda', () => {
    const p = createPlanta();
    correr(p, 0.05);
    arrancar(p);
    expect(hasta(p, enEtapa(p, 3))).toBe(true);
    p.alternarEmergencia();
    correr(p, 1.5);
    p.alternarEmergencia();
    p.iniciar();
    expect(hasta(p, () => p.M[33], 20)).toBe(true);
    expect(hasta(p, () => !p.V, 10)).toBe(true);
    expect(hasta(p, () => p.M[22], 20)).toBe(true);
    const c0 = p.ciclos;
    expect(hasta(p, () => p.ciclos === c0 + 1, 20)).toBe(true);
  });

  it('el movimiento es continuo: sin saltos entre scans', () => {
    const p = createPlanta();
    correr(p, 0.05);
    arrancar(p);
    let salto = 0;
    let giro = 0;
    while (p.ciclos < 1) {
      p.paso();
      for (const c of [p.AC, p.BD, p.E, p.FK]) salto = Math.max(salto, Math.abs(c.u - c.prev));
      giro = Math.max(giro, Math.abs(p.mesa.ang - p.mesa.prev));
    }
    expect(salto).toBeLessThan(0.01);
    expect(giro).toBeLessThan(0.5);
  });
});
