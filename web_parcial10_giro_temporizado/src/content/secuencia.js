/**
 * DATOS TÉCNICOS DE LA ESTACIÓN (fuente única).
 *
 * Todo lo que describe el proceso vive aquí y lo consumen dos vistas:
 *   - la lógica de la simulación 3D (tiempos de carrera y etapas),
 *   - el diagrama espacio-fase (trazas de los actuadores y duración de cada fase).
 * Los valores provienen de la guía del Examen Parcial II (Semana 10):
 * Tablas de secuencia por intervalos y de tiempos de ciclo, y Figuras 4, 5 y 7.
 */

/** Tiempos nominales de carrera (s). Determinan la duración de cada etapa. */
export const CARRERAS = {
  AC: { ext: 0.8, ret: 0.8 }, // Cilindro 1: A y C (vertical, descenso = +)
  BD: { ext: 1.1, ret: 1.0 }, // Cilindro 2: B y D (horizontal, avance = +)
  E: { ext: 1.0, ret: 0.9 }, // Cilindro 3: E (giro = +, bloqueo = −)
  FK: { ext: 1.1, ret: 0.8 }, // Cilindro 4: F…K (monoestable, retorno por resorte)
};

/** Temporizadores TON del programa (s), sección 5.2 de la guía. */
export const TEMPORIZADORES = {
  lub: 3.0, // T_lub: lubricación central antes de memorizar MARCHA_MEM
  vac: 0.3, // T_vac: estabilización del vacío (etapa 2)
  lib: 0.2, // T_lib: despresurización de ventosas (etapa 6)
  sinc: 0.4, // T_sinc: convergencia en Y (7w · 8w)
  rep1: 1.0, // T_rep1: reposición A, C, E, F en origen
  rep2: 1.0, // T_rep2: reposición B, D en origen
  rel34: 0.2, // T_rel34: liberación de ventosas en reposición
};

/** Etapas del GRAFCET de producción GP (IEC 60848). */
export const ETAPAS_GP = {
  0: { accion: 'Reposo: espera de ciclo con piezas y origen listos', fase: null },
  1: { accion: 'Y1+ (A+, C+): descenso hacia las piezas', fase: 0 },
  2: { accion: 'S V_SUCCION: sujeción por ventosas', fase: 0 },
  3: { accion: 'Y1− (A−, C−): elevación de las piezas sujetas', fase: 1 },
  4: { accion: 'Y3+ (E+) ∥ Y2+ (B+, D+): giro de la mesa y avance de carros', fase: 2 },
  5: { accion: 'Y3− (E−) ∥ Y1+ (A+, C+): bloqueo de la mesa y colocación', fase: 3 },
  6: { accion: 'R V_SUCCION: liberación de piezas', fase: 3 },
  7: { accion: 'Y1− (A−, C−): retorno vertical a posición superior', fase: 4 },
  8: { accion: 'Y4 (F+ … K+) + Y_BARRIDO: mecanizado y barrido de virutas', fase: 4 },
  9: { accion: 'Y4 = 0 (F− … K−) ∥ Y2− (B−, D−): retorno total a reposo', fase: 5 },
};

/** Etapas del GRAFCET de seguridad y reposición GS (GEMMA D1 / A5–A6). */
export const ETAPAS_GS = {
  30: 'Parada de emergencia (D1): GP vaciado, ventosas retenidas',
  31: 'Reposición: A−, C−, E− y F− … K− a origen',
  32: 'Reposición: B−, D− (solo con A y C arriba)',
  33: 'Ventosas con pieza: espera de nueva MARCHA',
  34: 'Depósito seguro de las piezas retenidas',
  35: 'Forzado F/GP:{0}: reinicio del grafo de producción',
  36: 'Régimen normal habilitado',
};

/** Seis intervalos del diagrama espacio-fase (pasos 1 → 7 = 1). */
export const FASES = [
  {
    id: '1-2',
    titulo: 'Descenso y sujeción',
    movimientos: 'A+, C+',
    banco: 'Cil. 1 +',
    fin: 'S2 · S6 (B2); activa ventosas (H_VENT = 1)',
    etapas: [1, 2],
  },
  {
    id: '2-3',
    titulo: 'Elevación con piezas',
    movimientos: 'A−, C−',
    banco: 'Cil. 1 −',
    fin: 'S1 · S5 (B1) manteniendo las piezas sujetas',
    etapas: [3],
  },
  {
    id: '3-4',
    titulo: 'Giro y traslación',
    movimientos: 'E+ ∥ B+, D+',
    banco: 'Cil. 3 + ∥ Cil. 2 +',
    fin: 'S10 · S4 · S8 (S2 · B4)',
    etapas: [4],
  },
  {
    id: '4-5',
    titulo: 'Bloqueo y colocación',
    movimientos: 'E− ∥ A+, C+',
    banco: 'Cil. 3 − ∥ Cil. 1 +',
    fin: 'S9 · S2 · S6 (S1 · B2); libera ventosas',
    etapas: [5, 6],
  },
  {
    id: '5-6',
    titulo: 'Paralelismo en Y: retorno vertical ∥ mecanizado',
    movimientos: 'A−, C− ∥ F+ … K+ y barrido',
    banco: 'Cil. 1 − ∥ Cil. 4 +',
    fin: 'S1 · S5 · S12…S22 (B1 · B5)',
    etapas: [7, 8],
  },
  {
    id: '6-7',
    titulo: 'Retorno total',
    movimientos: 'F− … K− ∥ B−, D−',
    banco: 'Cil. 4 − ∥ Cil. 2 −',
    fin: 'S11…S21 · S3 · S7 (S3 · B3); listo para el ciclo',
    etapas: [9],
  },
];

/**
 * Filas del diagrama espacio-fase. `traza` = posición (0/1) en los siete
 * instantes 1…7; los actuadores se dibujan con rampas y las señales
 * (`senal: true`) con flancos verticales.
 */
export const ACTUADORES = [
  {
    id: 'A',
    grupo: 'Transporte 1',
    nombre: 'Elevación T1',
    s0: 'S1 (B1)',
    s1: 'S2 (B2)',
    color: 1,
    traza: [0, 1, 0, 0, 1, 0, 0],
  },
  {
    id: 'B',
    grupo: 'Transporte 1',
    nombre: 'Carro T1',
    s0: 'S3 (B3)',
    s1: 'S4 (B4)',
    color: 1,
    traza: [0, 0, 0, 1, 1, 1, 0],
  },
  {
    id: 'C',
    grupo: 'Transporte 2',
    nombre: 'Elevación T2',
    s0: 'S5',
    s1: 'S6',
    color: 2,
    traza: [0, 1, 0, 0, 1, 0, 0],
  },
  { id: 'D', grupo: 'Transporte 2', nombre: 'Carro T2', s0: 'S7', s1: 'S8', color: 2, traza: [0, 0, 0, 1, 1, 1, 0] },
  {
    id: 'E',
    grupo: 'Mesa de giro',
    nombre: 'Giro / bloqueo',
    s0: 'S9 (S1)',
    s1: 'S10 (S2)',
    color: 3,
    traza: [0, 0, 0, 1, 0, 0, 0],
  },
  {
    id: 'F',
    grupo: 'Herramientas',
    nombre: 'Taladrar 1',
    s0: 'S11 (S3)',
    s1: 'S12 (B5)',
    color: 4,
    traza: [0, 0, 0, 0, 0, 1, 0],
  },
  {
    id: 'G',
    grupo: 'Herramientas',
    nombre: 'Taladrar 2',
    s0: 'S13',
    s1: 'S14',
    color: 4,
    traza: [0, 0, 0, 0, 0, 1, 0],
  },
  { id: 'H', grupo: 'Herramientas', nombre: 'Asiento 1', s0: 'S15', s1: 'S16', color: 4, traza: [0, 0, 0, 0, 0, 1, 0] },
  { id: 'I', grupo: 'Herramientas', nombre: 'Asiento 2', s0: 'S17', s1: 'S18', color: 4, traza: [0, 0, 0, 0, 0, 1, 0] },
  {
    id: 'J',
    grupo: 'Herramientas',
    nombre: 'Desbarbado 1',
    s0: 'S19',
    s1: 'S20',
    color: 4,
    traza: [0, 0, 0, 0, 0, 1, 0],
  },
  {
    id: 'K',
    grupo: 'Herramientas',
    nombre: 'Desbarbado 2',
    s0: 'S21',
    s1: 'S22',
    color: 4,
    traza: [0, 0, 0, 0, 0, 1, 0],
  },
  {
    id: 'V',
    grupo: 'Señales',
    nombre: 'Ventosas (lámpara)',
    s0: 'OFF',
    s1: 'ON',
    color: 5,
    senal: true,
    traza: [0, 1, 1, 1, 0, 0, 0],
  },
  {
    id: 'YB',
    grupo: 'Señales',
    nombre: 'Barrido virutas',
    s0: 'OFF',
    s1: 'ON',
    color: 6,
    senal: true,
    traza: [0, 0, 0, 0, 1, 1, 0],
  },
];

/**
 * Ejecución nominal de un ciclo (s) derivada de los tiempos de carrera:
 * lubricación 3.0 s + ciclo productivo 6.6 s (Figura 7 de la guía).
 * Instantes (s) medidos desde el pulso de MARCHA.
 */
const T = CARRERAS;
const t1 = TEMPORIZADORES.lub;
const t2 = t1 + T.AC.ext; // fin etapa 1
const t3 = t2 + TEMPORIZADORES.vac; // fin etapa 2
const t4 = t3 + T.AC.ret; // fin etapa 3
const t5 = t4 + Math.max(T.E.ext, T.BD.ext); // fin etapa 4
const t6 = t5 + Math.max(T.E.ret, T.AC.ext); // fin etapa 5
const t7 = t6 + TEMPORIZADORES.lib; // fin etapa 6
const t8 = t7 + Math.max(T.AC.ret, T.FK.ext) + TEMPORIZADORES.sinc; // convergencia en Y
const t9 = t8 + Math.max(T.FK.ret, T.BD.ret); // fin etapa 9

export const INSTANTES = { t1, t2, t3, t4, t5, t6, t7, t8, t9 };
export const CICLO_NOMINAL = t9 - t1;
