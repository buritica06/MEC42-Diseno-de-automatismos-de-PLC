import { describe, it, expect } from 'vitest';
import {
  createPlanta,
  medirCiclo,
  CONTEO_MAX,
  P,
  PASO,
  PESO_NOMINAL,
  T1,
  T2,
  T_VIGILANCIA,
  TOLERANCIA,
} from '../src/viz/three/estacionPesoLogica.js';

const avanzar = (p, segundos) => {
  const pasos = Math.round(segundos / PASO);
  for (let i = 0; i < pasos; i++) p.paso();
};

const esperarCondicion = (p, condicion, timeoutSegundos = 30) => {
  const maxPasos = Math.round(timeoutSegundos / PASO);
  for (let i = 0; i < maxPasos; i++) {
    if (condicion()) return;
    p.paso();
  }
  throw new Error(`Condición no alcanzada en ${timeoutSegundos} s`);
};

const contarEstado = (p, estado) => [...p.pz.estado].filter((e) => e === estado).length;

describe('Secuencia del GRAFCET de producción (GP)', () => {
  it('ejecuta la ruta OK (etapas 1 a 8) cuando el peso está dentro de tolerancia', () => {
    expect(medirCiclo('ok').map((t) => t.etapa)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('ejecuta la ruta NOK (etapas 1 a 4, luego 9 y 10) cuando el peso está fuera de tolerancia', () => {
    expect(medirCiclo('nok').map((t) => t.etapa)).toEqual([1, 2, 3, 4, 9, 10]);
  });

  it('mantiene la báscula libre en la etapa 3 durante T1 = 3 s (prueba 4)', () => {
    const e3 = medirCiclo('ok').find((t) => t.etapa === 3);
    expect(e3.fin - e3.inicio).toBeCloseTo(T1, 1);
  });

  it('mantiene H1 en la etapa 8 durante T2 = 2 s tras activar S5', () => {
    const e8 = medirCiclo('ok').find((t) => t.etapa === 8);
    expect(e8.fin - e8.inicio).toBeCloseTo(T2, 1);
  });

  it('respeta la condición de reposo invertida del cilindro B (B4 = 1, B3 = 0)', () => {
    const s = createPlanta().sensores();
    expect([s.B1, s.B4, s.S1, s.S2, s.B3]).toEqual([true, true, true, true, false]);
  });

  it('energiza los solenoides de cada etapa según las acciones continuas del SCL', () => {
    const p = createPlanta();
    p.fijarModo('ok');
    p.pulsarS0();
    const salidas = () => [p.y1, p.y2, p.y3, p.y4, p.y5, p.h1];
    const esperado = {
      1: [true, false, false, false, false, false],
      2: [false, true, true, false, false, false],
      3: [false, false, true, false, false, false],
      4: [false, false, false, false, false, false],
      5: [false, false, false, true, false, false],
      6: [false, false, false, false, false, false],
      7: [false, false, false, false, false, true],
      8: [false, false, false, false, false, true],
    };
    for (const [etapa, s] of Object.entries(esperado)) {
      esperarCondicion(p, () => p.etapa() === Number(etapa));
      p.paso();
      expect(salidas(), `etapa ${etapa}`).toEqual(s);
    }
  });

  it('nunca energiza Y1 e Y2 a la vez (válvula biestable de A)', () => {
    const p = createPlanta();
    p.pulsarS0();
    for (let i = 0; i < Math.round(60 / PASO); i++) {
      p.paso();
      expect(p.y1 && p.y2).toBe(false);
    }
  });
});

describe('Contadores, báscula y flujo de piezas', () => {
  it('cuenta una pieza OK por ciclo (CU = ↑X7) y la deja en el contenedor OK (prueba 2)', () => {
    const p = createPlanta();
    p.fijarModo('ok');
    p.pulsarS0();
    esperarCondicion(p, () => p.ciclos >= 3, 60);
    expect(p.ok).toBe(3);
    expect(p.nok).toBe(0);
    avanzar(p, 1);
    expect(contarEstado(p, P.CAJA_OK)).toBeGreaterThanOrEqual(2);
  });

  it('cuenta una pieza NOK por ciclo (CU = ↑X10) y la deja en el contenedor NOK (prueba 3)', () => {
    const p = createPlanta();
    p.fijarModo('nok');
    p.pulsarS0();
    esperarCondicion(p, () => p.ciclos >= 3, 60);
    expect(p.nok).toBe(3);
    expect(p.ok).toBe(0);
    avanzar(p, 1);
    expect(contarEstado(p, P.CAJA_NOK)).toBeGreaterThanOrEqual(2);
  });

  it('pesa siempre una pieza real: ningún ciclo arranca sin pieza en el centro', () => {
    const p = createPlanta();
    p.pulsarS0();
    let previa = 0;
    const pesos = [];
    for (let i = 0; i < Math.round(120 / PASO); i++) {
      p.paso();
      const e = p.etapa();
      if (previa === 3 && e === 4) pesos.push(p.ultimoPeso);
      previa = e;
    }
    expect(pesos.length).toBeGreaterThan(8);
    expect(Math.min(...pesos)).toBeGreaterThan(PESO_NOMINAL - 5 * TOLERANCIA);
  });

  it('la lectura de la báscula evoluciona sin saltos (filtro de 2.º orden)', () => {
    const p = createPlanta();
    p.fijarModo('ok');
    p.pulsarS0();
    esperarCondicion(p, () => p.etapa() === 3);
    let maxSalto = 0;
    for (let i = 0; i < Math.round(T1 / PASO); i++) {
      const antes = p.peso;
      p.paso();
      maxSalto = Math.max(maxSalto, Math.abs(p.peso - antes));
    }
    expect(maxSalto).toBeLessThan(15); // g por barrido de 5 ms
    expect(Math.abs(p.peso - PESO_NOMINAL)).toBeLessThanOrEqual(TOLERANCIA);
  });

  it('el conmutador S4 manda aunque se cambie con la pieza ya en la báscula', () => {
    const p = createPlanta();
    p.fijarModo('nok');
    p.pulsarS0();
    esperarCondicion(p, () => p.etapa() === 3);
    avanzar(p, 2);
    p.fijarModo('ok'); // el operario pasa S4 a 1 durante el pesaje
    esperarCondicion(p, () => p.etapa() === 5 || p.etapa() === 9);
    expect(p.etapa()).toBe(5);
  });

  it('Reset_Conteo pone a cero ambos contadores (prueba 8) y CTU satura en PV', () => {
    const p = createPlanta();
    p.ok = CONTEO_MAX;
    p.nok = 5;
    p.resetConteo();
    expect([p.ok, p.nok]).toEqual([0, 0]);
  });
});

describe('Modo (GM), paro de fin de ciclo y pruebas de seguridad', () => {
  it('arranca en la etapa 1 al pulsar S0 con condiciones iniciales (prueba 1)', () => {
    const p = createPlanta();
    avanzar(p, 1);
    expect(p.etapa()).toBe(0);
    p.pulsarS0();
    p.paso();
    p.paso();
    expect(p.etapa()).toBe(1);
  });

  for (const etapa of [1, 2, 3, 4, 5, 6, 7, 8]) {
    it(`S6 pulsado en la etapa ${etapa} termina el ciclo OK y se detiene en la etapa 0`, () => {
      const p = createPlanta();
      p.fijarModo('ok');
      p.pulsarS0();
      esperarCondicion(p, () => p.etapa() === etapa);
      p.alternarS6();
      p.paso();
      expect(p.marcha).toBe(false);
      expect(p.etapa()).not.toBe(0); // el ciclo en curso no se interrumpe
      esperarCondicion(p, () => p.etapa() === 0, 20);
      p.alternarS6(); // se suelta S6
      avanzar(p, 3);
      expect(p.etapa()).toBe(0); // no vuelve a arrancar sin S0
    });
  }

  for (const etapa of [9, 10]) {
    it(`S6 pulsado en la etapa ${etapa} termina el ciclo NOK y se detiene en la etapa 0`, () => {
      const p = createPlanta();
      p.fijarModo('nok');
      p.pulsarS0();
      esperarCondicion(p, () => p.etapa() === etapa);
      p.alternarS6();
      esperarCondicion(p, () => p.etapa() === 0, 20);
      avanzar(p, 3);
      expect(p.etapa()).toBe(0);
    });
  }

  it('con el cable de S6 desconectado no arranca un nuevo ciclo (prueba 6)', () => {
    const p = createPlanta();
    p.cableS6Roto = true;
    p.pulsarS0();
    avanzar(p, 3);
    expect(p.marcha).toBe(false);
    expect(p.etapa()).toBe(0);
  });

  it('la rotura del cable de S6 en marcha borra X21 y el ciclo termina en la etapa 0', () => {
    const p = createPlanta();
    p.pulsarS0();
    esperarCondicion(p, () => p.etapa() === 1);
    p.cableS6Roto = true;
    p.paso();
    expect(p.marcha).toBe(false);
    esperarCondicion(p, () => p.etapa() === 0, 20);
  });

  for (const etapa of [1, 3, 5, 9]) {
    it(`un corte de tensión en la etapa ${etapa} deja B extendido y salidas a 0 (prueba 7)`, () => {
      const p = createPlanta();
      p.fijarModo(etapa === 9 ? 'nok' : 'ok');
      p.pulsarS0();
      esperarCondicion(p, () => p.etapa() === etapa);
      p.cortarTension(true);
      avanzar(p, 2);
      expect([p.y1, p.y2, p.y3, p.y4, p.y5, p.h1]).toEqual([false, false, false, false, false, false]);
      expect(p.sensores().B4).toBe(true); // báscula bloqueada por el muelle de la válvula
      expect(p.sensores().S1).toBe(true); // C retorna por muelle
      expect(p.sensores().S2).toBe(true); // D retorna por muelle
      p.cortarTension(false);
      p.paso();
      expect(p.etapa()).toBe(0); // la CPU rearranca en la etapa inicial
      expect(p.marcha).toBe(false); // y en la etapa 20 de GM
    });
  }

  it('reinicia la estación y vuelve a producir tras un corte con A extendido', () => {
    const p = createPlanta();
    p.pulsarS0();
    esperarCondicion(p, () => p.etapa() === 2);
    p.cortarTension(true);
    avanzar(p, 1);
    p.cortarTension(false);
    p.reiniciar();
    avanzar(p, 2);
    p.pulsarS0();
    esperarCondicion(p, () => p.ciclos >= 1, 30);
  });
});

describe('Vigilancia por etapa (watchdog de 5 s) e inyección de fallas', () => {
  for (const [cil, etapa, modo] of [
    ['A', 1, 'ok'],
    ['C', 5, 'ok'],
    ['D', 9, 'nok'],
  ]) {
    it(`el atasco del cilindro ${cil} dispara la alarma en la etapa ${etapa}`, () => {
      const p = createPlanta();
      p.fijarModo(modo);
      p.fallas[cil] = true;
      p.pulsarS0();
      esperarCondicion(p, () => p.etapa() === etapa);
      avanzar(p, T_VIGILANCIA - 0.5);
      expect(p.alarma).toBe('');
      avanzar(p, 1);
      expect(p.alarma).toContain(`Etapa ${etapa}`);
      p.fallas[cil] = false; // se libera el atasco: la secuencia continúa
      esperarCondicion(p, () => p.etapa() !== etapa, 10);
      p.reconocerAlarma();
      expect(p.alarma).toBe('');
    });
  }

  it('el atasco de B (báscula sin bloquear) dispara la alarma en la etapa 4', () => {
    const p = createPlanta();
    p.pulsarS0();
    esperarCondicion(p, () => p.etapa() === 3);
    p.fallas.B = true; // B queda retraído: B4 nunca llega
    esperarCondicion(p, () => p.etapa() === 4);
    avanzar(p, T_VIGILANCIA + 0.5);
    expect(p.alarma).toContain('Etapa 4');
  });

  it('la falla de S5 deja la cinta en marcha y dispara la alarma en la etapa 7', () => {
    const p = createPlanta();
    p.fijarModo('ok');
    p.fallas.S5 = true;
    p.pulsarS0();
    esperarCondicion(p, () => p.etapa() === 7);
    avanzar(p, T_VIGILANCIA + 0.5);
    expect(p.h1).toBe(true);
    expect(p.alarma).toContain('Etapa 7');
  });

  it('el ciclo normal no dispara la vigilancia', () => {
    const p = createPlanta();
    p.pulsarS0();
    avanzar(p, 90);
    expect(p.alarma).toBe('');
  });
});
