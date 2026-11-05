/**
 * Modelo físico, neumático y lógico de la Célula de Mecanizado (Semana 7).
 *
 * Todas las funciones son puras y deterministas para que tanto las
 * visualizaciones (3D y 2D) como las pruebas unitarias (tests/celula.test.js)
 * verifiquen exactamente los mismos resultados.
 */

/** Parámetros constructivos nominales del banco de laboratorio. */
export const PARAMETROS_BANCO = {
  // Cilindro A (Monoestable, alimentador y barrido)
  diametroEmboloA_mm: 25,
  carreraA_mm: 100,
  fuerzaMuelleA_N: 25,
  // Cilindro B (Biestable, mordaza de clampeo)
  diametroEmboloB_mm: 32,
  diametroVastagoB_mm: 12,
  carreraB_mm: 50,
  // Neumática general
  presionNominal_bar: 6.0,
  rendimientoNeumatico: 0.9,
  // Motor trifásico M1 (jaula de ardilla)
  frecuenciaRed_Hz: 60,
  polosMotor: 4,
  deslizamientoNominal: 0.04, // 4 % -> 1728 rpm
  potenciaMotor_kW: 0.37,
  tensionLinea_V: 220,
  factorPotencia: 0.8,
  rendimientoMotor: 0.78,
};

/** Tiempos teóricos de diseño por fase (s) a 6.0 bar. */
export const TIEMPOS_FASE_BASE = [
  { etapa: 1, codigo: 'A+', nombre: 'Barrido de cuna', duracion_s: 0.8 },
  { etapa: 2, codigo: 'A-', nombre: 'Retorno por muelle', duracion_s: 0.7 },
  { etapa: 3, codigo: 'B-', nombre: 'Purga y homing mordaza', duracion_s: 0.5 },
  { etapa: 4, codigo: 'A+', nombre: 'Fijación axial de pieza', duracion_s: 0.8 },
  { etapa: 5, codigo: 'B+', nombre: 'Clampeo neumático', duracion_s: 0.6 },
  { etapa: 6, codigo: 'KM1', nombre: 'Mecanizado husillo derecha', duracion_s: 5.0 },
];

/**
 * Área de sección circular en m² a partir del diámetro en mm.
 * A = pi * (D / 2000)^2
 */
export function areaEmbolo_m2(diametro_mm) {
  const radio_m = diametro_mm / 2000;
  return Math.PI * radio_m * radio_m;
}

/**
 * Fuerza teórica y efectiva de avance del Cilindro A (monoestable, con resorte antagonista).
 * P en bar (1 bar = 1e5 Pa).
 * F_teo = P_Pa * A
 * F_ef  = eta * (P_Pa * A - F_muelle)
 */
export function fuerzaCilindroA(
  presion_bar = PARAMETROS_BANCO.presionNominal_bar,
  diametro_mm = PARAMETROS_BANCO.diametroEmboloA_mm,
  fuerzaMuelle_N = PARAMETROS_BANCO.fuerzaMuelleA_N,
  eta = PARAMETROS_BANCO.rendimientoNeumatico
) {
  const presion_Pa = presion_bar * 1e5;
  const area = areaEmbolo_m2(diametro_mm);
  const teorica_N = presion_Pa * area;
  const efectiva_N = Math.max(0, eta * (teorica_N - fuerzaMuelle_N));
  return {
    area_m2: area,
    teorica_N,
    efectiva_N,
    fuerzaTeorica_N: teorica_N,
    fuerzaEfectiva_N: efectiva_N,
  };
}

/**
 * Fuerza teórica y efectiva de clampeo del Cilindro B (biestable, doble efecto sin resorte).
 * F_teo = P_Pa * A_B
 * F_ef  = eta * P_Pa * A_B
 */
export function fuerzaClampeoB(
  presion_bar = PARAMETROS_BANCO.presionNominal_bar,
  diametro_mm = PARAMETROS_BANCO.diametroEmboloB_mm,
  eta = PARAMETROS_BANCO.rendimientoNeumatico
) {
  const presion_Pa = presion_bar * 1e5;
  const area = areaEmbolo_m2(diametro_mm);
  const teorica_N = presion_Pa * area;
  const efectiva_N = Math.max(0, eta * teorica_N);
  return {
    area_m2: area,
    teorica_N,
    efectiva_N,
    fuerzaTeorica_N: teorica_N,
    fuerzaEfectiva_N: efectiva_N,
  };
}

/**
 * Velocidad sincrónica y nominal del motor trifásico M1.
 * n_s = 120 * f / polos
 * n_r = n_s * (1 - s)
 */
export function velocidadMotor(
  frecuencia_Hz = PARAMETROS_BANCO.frecuenciaRed_Hz,
  polos = PARAMETROS_BANCO.polosMotor,
  deslizamiento = PARAMETROS_BANCO.deslizamientoNominal
) {
  const sincronica_rpm = (120 * frecuencia_Hz) / polos;
  const nominal_rpm = sincronica_rpm * (1 - deslizamiento);
  return {
    sincronica_rpm,
    nominal_rpm,
    nSincrona_rpm: sincronica_rpm,
    nNominal_rpm: nominal_rpm,
  };
}

/**
 * Corriente nominal de línea del motor trifásico:
 * I_nom = P_W / (sqrt(3) * V_L * cosPhi * eta)
 * Acepta potencia en W (> 10) o en kW (<= 10).
 */
export function corrienteNominalMotor(
  potencia = PARAMETROS_BANCO.potenciaMotor_kW,
  tension_V = PARAMETROS_BANCO.tensionLinea_V,
  cosPhi = PARAMETROS_BANCO.factorPotencia,
  eta = PARAMETROS_BANCO.rendimientoMotor
) {
  const potencia_W = potencia > 10 ? potencia : potencia * 1000;
  return potencia_W / (Math.sqrt(3) * tension_V * cosPhi * eta);
}

/**
 * Calcula la duración total del ciclo (s) para un tiempo de mecanizado tMecanizado_s dado
 * y una presión de trabajo P (bar).
 */
export function calcularTiemposCiclo(tMecanizado_s = 5.0, presion_bar = 6.0) {
  const factorPresion = Math.sqrt(6.0 / Math.max(2.0, presion_bar));
  const fases = TIEMPOS_FASE_BASE.map((f) => {
    // Etapa 3 (Homing B- con temporizador T1 = 0.5 s) y Etapa 6 (TON M1) son temporizadas por PLC
    const duracion =
      f.etapa === 6 ? tMecanizado_s : f.etapa === 3 ? f.duracion_s : Number((f.duracion_s * factorPresion).toFixed(3));
    return { ...f, duracion_s: duracion };
  });
  const duraciones_s = fases.map((f) => f.duracion_s);
  const tAcumulado_s = [0];
  let acum = 0;
  for (const d of duraciones_s) {
    acum = Number((acum + d).toFixed(3));
    tAcumulado_s.push(acum);
  }
  const total_s = acum;
  return {
    fases,
    duraciones_s,
    tAcumulado_s,
    total_s,
    tiempoTotal_s: total_s,
  };
}

/**
 * Devuelve el estado completo del GRAFCET (etapas 0 a 6) considerando condiciones
 * normales o fallas inducidas (corte eléctrico de 24 VDC o disparo de relé térmico RT1).
 *
 * @param {number} etapa Entero de 0 a 6
 * @param {{ corteElectrico?: boolean, falloTermico?: boolean, mordazaPreviaCerrada?: boolean }} [opts]
 */
export function estadoGrafcet(etapa, opts = {}) {
  const e = Math.max(0, Math.min(6, Math.round(etapa)));
  const corte = Boolean(opts.corteElectrico);
  const falloRT1 = Boolean(opts.falloTermico);

  const nominal = [
    {
      etapa: 0,
      fase: 'Etapa 0',
      titulo: 'Reposo inicial (Espera S1)',
      accion: 'Ninguna (Espera S1)',
      transicion: 'S1 · S0 · RT1 · a0 · b0',
      xA_mm: 0,
      xB_mm: 0,
      Y_A: 0,
      Y_B_PLUS: 0,
      Y_B_MINUS: 0,
      KM1: 0,
      piezaEstado: 'En rampa de alimentación',
    },
    {
      etapa: 1,
      fase: 'Etapa 1',
      titulo: 'A+ (Alimentación y barrido)',
      accion: 'YA := 1 (Avance Cilindro A)',
      transicion: 'a1 = 1',
      xA_mm: 100,
      xB_mm: 0,
      Y_A: 1,
      Y_B_PLUS: 0,
      Y_B_MINUS: 0,
      KM1: 0,
      piezaEstado: 'Pre-posicionada en cuna',
    },
    {
      etapa: 2,
      fase: 'Etapa 2',
      titulo: 'A- (Retorno por muelle)',
      accion: 'YA := 0 (Retorno muelle)',
      transicion: 'a0 = 1',
      xA_mm: 0,
      xB_mm: 0,
      Y_A: 0,
      Y_B_PLUS: 0,
      Y_B_MINUS: 0,
      KM1: 0,
      piezaEstado: 'Asentada por gravedad',
    },
    {
      etapa: 3,
      fase: 'Etapa 3',
      titulo: 'B- (Homing seguro biestable)',
      accion: 'YB- := 1 (Homing biestable)',
      transicion: 'b0 · T1 (0.5 s)',
      xA_mm: 0,
      xB_mm: 0,
      Y_A: 0,
      Y_B_PLUS: 0,
      Y_B_MINUS: 1,
      KM1: 0,
      piezaEstado: 'Mordaza asegurada atrás',
    },
    {
      etapa: 4,
      fase: 'Etapa 4',
      titulo: 'A+ (Fijación axial definitiva)',
      accion: 'YA := 1 (Fijación axial)',
      transicion: 'a1 = 1',
      xA_mm: 100,
      xB_mm: 0,
      Y_A: 1,
      Y_B_PLUS: 0,
      Y_B_MINUS: 0,
      KM1: 0,
      piezaEstado: 'Fijada axialmente por A+',
    },
    {
      etapa: 5,
      fase: 'Etapa 5',
      titulo: 'B+ (Clampeo biestable)',
      accion: 'YB+ := 1, YA := 1',
      transicion: 'b1 · a1 = 1',
      xA_mm: 100,
      xB_mm: 50,
      Y_A: 1,
      Y_B_PLUS: 1,
      Y_B_MINUS: 0,
      KM1: 0,
      piezaEstado: 'Prensada en 2 ejes (A+ y B+)',
    },
    {
      etapa: 6,
      fase: 'Etapa 6',
      titulo: 'Motor M1 Giro Derecha (CW)',
      accion: 'KM1 := 1, YA := 1',
      transicion: 'T2 (5.0 s)',
      xA_mm: 100,
      xB_mm: 50,
      Y_A: 1,
      Y_B_PLUS: 0,
      Y_B_MINUS: 0,
      KM1: 1,
      piezaEstado: 'En mecanizado (Husillo CW)',
    },
  ][e];

  let xA_mm = nominal.xA_mm;
  let xB_mm = nominal.xB_mm;
  let Y_A = nominal.Y_A;
  let Y_B_PLUS = nominal.Y_B_PLUS;
  let Y_B_MINUS = nominal.Y_B_MINUS;
  let KM1 = nominal.KM1;
  let piezaEstado = nominal.piezaEstado;

  if (falloRT1) {
    KM1 = 0;
    if (e === 6) {
      piezaEstado = 'PARO POR SOBRECARGA TÉRMICA (RT1 = 0): Motor detenido';
    }
  }

  if (corte) {
    Y_A = 0;
    Y_B_PLUS = 0;
    Y_B_MINUS = 0;
    KM1 = 0;
    // Cilindro A (monoestable) retorna por resorte a 0 mm
    xA_mm = 0;
    // Cilindro B (biestable) conserva mecánicamente su posición previa
    if (opts.mordazaPreviaCerrada !== undefined) {
      xB_mm = opts.mordazaPreviaCerrada ? 50 : 0;
    }
    piezaEstado =
      xB_mm === 50
        ? 'CORTE 24V: A retorna por muelle (a0=1); B biestable mantiene pieza sujeta (b1=1)'
        : 'CORTE 24V: A retorna por muelle (a0=1); B conserva posición';
  }

  const a0 = xA_mm === 0 ? 1 : 0;
  const a1 = xA_mm === 100 ? 1 : 0;
  const b0 = xB_mm === 0 ? 1 : 0;
  const b1 = xB_mm === 50 ? 1 : 0;
  const RT1 = falloRT1 ? 0 : 1;

  return {
    ...nominal,
    xA_mm,
    xB_mm,
    posA_mm: xA_mm,
    posB_mm: xB_mm,
    Y_A,
    Y_B_PLUS,
    Y_B_MINUS,
    KM1,
    a0,
    a1,
    b0,
    b1,
    RT1,
    sensores: { a0, a1, b0, b1, RT1 },
    salidas: { YA: Y_A, YB_plus: Y_B_PLUS, YB_minus: Y_B_MINUS, KM1 },
    piezaEstado,
  };
}
