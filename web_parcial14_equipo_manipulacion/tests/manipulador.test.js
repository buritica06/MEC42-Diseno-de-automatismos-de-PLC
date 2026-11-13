import { describe, expect, it } from 'vitest';
import { createPlanta, medirCiclo, PASO } from '../src/viz/three/manipuladorLogica.js';

const correr = (p, s) => {
  for (let i = 0; i < s / PASO; i++) p.paso();
};
const arrancar = () => {
  const p = createPlanta();
  correr(p, 5); // llenado de la canaleta 1
  p.pulsarReset();
  correr(p, 4); // GS 21 → 22 → 23 → 24
  return p;
};

describe('Equipo de manipulación', () => {
  it('arranca bloqueado (GS 20) y exige S_RESET', () => {
    const p = createPlanta();
    correr(p, 2);
    expect(p.gs).toBe(20);
    expect(p.gp).toBe(-1);
    p.pulsarReset();
    correr(p, 4);
    expect(p.gs).toBe(24);
    expect(p.gp).toBe(0);
  });

  it('un ciclo doble recorre las 14 etapas y deposita en las canaletas 2 y 3', () => {
    const tramos = medirCiclo();
    expect(tramos.map((t) => t.etapa)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    const t5 = tramos.find((t) => t.etapa === 5);
    expect(t5.fin - t5.inicio).toBeCloseTo(1.5, 1);
  });

  it('cuenta ciclos dobles y se detiene al completar el lote N', () => {
    const p = arrancar();
    p.lote = 2;
    p.pulsarStart();
    correr(p, 60);
    expect(p.cv).toBe(2);
    expect(p.gp).toBe(0);
    expect(p.marcha).toBe(false);
    const enCanaletas = p.piezas.filter((z) => z.activa && (z.lugar === 'c2' || z.lugar === 'c3')).length;
    expect(enCanaletas).toBe(4);
  });

  it('S_STOP termina el ciclo doble en curso y para en posición inicial', () => {
    const p = arrancar();
    p.pulsarStart();
    correr(p, 2);
    p.pulsarStop();
    correr(p, 30);
    expect(p.cv).toBe(1);
    expect(p.gp).toBe(0);
    const s = p.sensores();
    expect(s.S1 && s.B1 && s.B3 && s.S3).toBe(true);
  });

  it('emergencia: GP vacío, A-B-C vuelven a reposo y D queda detenido; RESET devuelve D a S3', () => {
    const p = arrancar();
    p.pulsarStart();
    for (let i = 0; i < 40000 && !(p.gp === 4 && p.D.x > 0.4); i++) p.paso();
    p.alternarEmergencia();
    correr(p, 3);
    expect(p.gp).toBe(-1);
    expect(p.A.x).toBe(0);
    expect(p.B.x).toBe(0);
    const dParado = p.D.x;
    expect(dParado).toBeGreaterThan(0.3);
    expect(dParado).toBeLessThan(1);
    p.alternarEmergencia();
    correr(p, 2);
    expect(p.D.x).toBe(dParado); // bloqueado hasta S_RESET
    p.pulsarReset();
    correr(p, 6);
    expect(p.D.x).toBe(0);
    expect(p.gs).toBe(24);
  });

  it('un sensor B2 averiado provoca fallo por vigilancia (5 s)', () => {
    const p = arrancar();
    p.falloB2 = true;
    p.pulsarStart();
    correr(p, 7);
    expect(p.gs).toBe(20);
    expect(p.fallo).toBe(true);
  });
});
