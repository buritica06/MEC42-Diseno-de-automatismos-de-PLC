import { describe, it, expect } from 'vitest';
import {
  areaEmbolo_m2,
  fuerzaCilindroA,
  fuerzaClampeoB,
  velocidadMotor,
  corrienteNominalMotor,
  calcularTiemposCiclo,
  estadoGrafcet,
} from '../src/math/celula.js';
import { ACTIVIDADES } from '../src/modules/04-actividades/actividades.js';
import { numeroCorrecto, textoCorrecto, opcionesCorrectas } from '../src/components/corregir.js';

describe('Modelo físico y secuencial de la Célula de Mecanizado (Semana 7)', () => {
  it('calcula áreas y fuerzas efectivas de Cilindro A (monoestable) y Cilindro B (biestable)', () => {
    const areaA = areaEmbolo_m2(25);
    const areaB = areaEmbolo_m2(32);
    expect(areaA).toBeCloseTo(4.9087385e-4, 7);
    expect(areaB).toBeCloseTo(8.0424772e-4, 7);

    const fA = fuerzaCilindroA(6, 25, 25, 0.9);
    const fB = fuerzaClampeoB(6, 32, 0.9);
    expect(fA.fuerzaEfectiva_N).toBeCloseTo(242.572, 2);
    expect(fB.fuerzaEfectiva_N).toBeCloseTo(434.294, 2);

    // Caso límite: sin presión neumática la fuerza efectiva es cero
    expect(fuerzaCilindroA(0).fuerzaEfectiva_N).toBe(0);
    expect(fuerzaClampeoB(0).fuerzaEfectiva_N).toBe(0);
  });

  it('calcula velocidad síncrona, velocidad nominal y corriente del husillo trifásico M1', () => {
    const vel = velocidadMotor(60, 4, 0.04);
    expect(vel.nSincrona_rpm).toBe(1800);
    expect(vel.nNominal_rpm).toBeCloseTo(1728, 4);

    const corriente = corrienteNominalMotor(370, 220, 0.8, 0.78);
    expect(corriente).toBeCloseTo(1.5558, 3);
  });

  it('reproduce exactamente la secuencia A+ -> A- -> B- -> A+ -> B+ -> Motor M1 en GRAFCET', () => {
    const e0 = estadoGrafcet(0);
    const e1 = estadoGrafcet(1);
    const e2 = estadoGrafcet(2);
    const e3 = estadoGrafcet(3);
    const e4 = estadoGrafcet(4);
    const e5 = estadoGrafcet(5);
    const e6 = estadoGrafcet(6);

    // Posiciones de A (mm): 0 -> 100 -> 0 -> 0 -> 100 -> 100 -> 100
    expect([e0.posA_mm, e1.posA_mm, e2.posA_mm, e3.posA_mm, e4.posA_mm, e5.posA_mm, e6.posA_mm]).toEqual([
      0, 100, 0, 0, 100, 100, 100,
    ]);

    // Posiciones de B (mm): 0 -> 0 -> 0 -> 0 (Homing B-) -> 0 -> 50 -> 50
    expect([e0.posB_mm, e1.posB_mm, e2.posB_mm, e3.posB_mm, e4.posB_mm, e5.posB_mm, e6.posB_mm]).toEqual([
      0, 0, 0, 0, 0, 50, 50,
    ]);

    // En Etapa 3 se activa YB- aunque B ya esté en 0 mm
    expect(e3.salidas.YB_minus).toBe(1);
    expect(e3.sensores.b0).toBe(1);

    // En Etapa 6 gira el motor trifásico hacia la derecha (KM1 = 1) con pieza sujeta (a1 = 1, b1 = 1)
    expect(e6.salidas.KM1).toBe(1);
    expect(e6.sensores.a1).toBe(1);
    expect(e6.sensores.b1).toBe(1);
  });

  it('verifica comportamiento diferencial ante corte de 24 VDC y fallo térmico RT1', () => {
    // Corte de 24 VDC en Etapa 6: A (monoestable) retorna a 0 mm, B (biestable) mantiene 50 mm
    const e6Corte = estadoGrafcet(6, { corteElectrico: true });
    expect(e6Corte.posA_mm).toBe(0);
    expect(e6Corte.sensores.a0).toBe(1);
    expect(e6Corte.posB_mm).toBe(50);
    expect(e6Corte.sensores.b1).toBe(1);
    expect(e6Corte.salidas.KM1).toBe(0);

    // Disparo térmico RT1 en Etapa 6: detiene KM1
    const e6Termico = estadoGrafcet(6, { falloTermico: true });
    expect(e6Termico.salidas.KM1).toBe(0);
    expect(e6Termico.sensores.RT1).toBe(0);
  });

  it('calcula tiempos de ciclo coherentes con la presión y el temporizador TON', () => {
    const tNominal = calcularTiemposCiclo(5, 6);
    expect(tNominal.tiempoTotal_s).toBeCloseTo(8.4, 3);

    const tBajaPresion = calcularTiemposCiclo(5, 4);
    expect(tBajaPresion.tiempoTotal_s).toBeGreaterThan(tNominal.tiempoTotal_s);
  });
});

describe('Verificación independiente del banco de actividades (Compuerta C4)', () => {
  it('verifica unicidad de IDs ej-1 a ej-8 y estructura completa', () => {
    const ids = ACTIVIDADES.map((a) => a.id);
    expect(ids).toEqual(['ej-1', 'ej-2', 'ej-3', 'ej-4', 'ej-5', 'ej-6', 'ej-7', 'ej-8']);
    expect(new Set(ids).size).toBe(ACTIVIDADES.length);
  });

  it('valida respuestas de opción única y múltiple (ej-1, ej-2, ej-6)', () => {
    const ej1 = ACTIVIDADES.find((a) => a.id === 'ej-1');
    expect(opcionesCorrectas([1], ej1.correcta)).toBe(true);
    expect(opcionesCorrectas([0], ej1.correcta)).toBe(false);

    const ej2 = ACTIVIDADES.find((a) => a.id === 'ej-2');
    expect(opcionesCorrectas([0, 3], ej2.correcta)).toBe(true);
    expect(opcionesCorrectas([0], ej2.correcta)).toBe(false);

    const ej6 = ACTIVIDADES.find((a) => a.id === 'ej-6');
    expect(opcionesCorrectas([1], ej6.correcta)).toBe(true);
  });

  it('valida variantes razonables de respuesta de texto (ej-3)', () => {
    const ej3 = ACTIVIDADES.find((a) => a.id === 'ej-3');
    expect(textoCorrecto('Doble bobina', ej3.aceptadas)).toBe(true);
    expect(textoCorrecto('ERROR DE DOBLE BOBINA', ej3.aceptadas)).toBe(true);
    expect(textoCorrecto('Conflicto de doble bobina', ej3.aceptadas)).toBe(true);
    expect(textoCorrecto('Cortocircuito', ej3.aceptadas)).toBe(false);
  });

  it('valida actividades numéricas por segundo camino independiente dentro del 0.5 % (ej-4, ej-5)', () => {
    const ej4 = ACTIVIDADES.find((a) => a.id === 'ej-4');
    // Segundo camino independiente usando el módulo físico celula.js y los valores de la solución explicada
    const fAIndep = fuerzaCilindroA(6).fuerzaEfectiva_N;
    const fBIndep = fuerzaClampeoB(6).fuerzaEfectiva_N;
    expect(numeroCorrecto(fAIndep, ej4.respuestas[0].valor)).toBe(true);
    expect(numeroCorrecto(242.57, ej4.respuestas[0].valor)).toBe(true);
    expect(numeroCorrecto(fBIndep, ej4.respuestas[1].valor)).toBe(true);
    expect(numeroCorrecto(434.29, ej4.respuestas[1].valor)).toBe(true);

    const ej5 = ACTIVIDADES.find((a) => a.id === 'ej-5');
    const nrIndep = velocidadMotor(60, 4, 0.04).nNominal_rpm;
    const inIndep = corrienteNominalMotor(370, 220, 0.8, 0.78);
    expect(numeroCorrecto(nrIndep, ej5.respuestas[0].valor)).toBe(true);
    expect(numeroCorrecto(1728, ej5.respuestas[0].valor)).toBe(true);
    expect(numeroCorrecto(inIndep, ej5.respuestas[1].valor)).toBe(true);
    expect(numeroCorrecto(1.56, ej5.respuestas[1].valor)).toBe(true);
  });

  it('verifica que las preguntas abiertas (ej-7, ej-8) incluyen respuestaModelo detallada', () => {
    const ej7 = ACTIVIDADES.find((a) => a.id === 'ej-7');
    const ej8 = ACTIVIDADES.find((a) => a.id === 'ej-8');
    expect(ej7.respuestaModelo).toContain('95-96');
    expect(ej7.respuestaModelo).toContain('fases');
    expect(ej8.respuestaModelo).toContain('TON');
    expect(ej8.respuestaModelo).toContain('3.0');
  });
});
