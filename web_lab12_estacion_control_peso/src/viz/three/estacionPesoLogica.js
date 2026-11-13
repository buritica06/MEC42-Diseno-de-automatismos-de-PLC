/**
 * Lógica de la estación de control de peso (Semana 12), sin dependencias de Three.js.
 *
 * Reproduce los dos GRAFCET de la guía (IEC 60848) y el FB_EstacionPeso en SCL:
 *   GP (producción): etapas 0 a 10, divergencia OR tras la etapa 4.
 *   GM (modo): etapas 20 (paro) y 21 (marcha), con paro de fin de ciclo por S6 (NC).
 * y un modelo de la planta con la disposición del plano de situación (lámina 1)
 * y de la vista en planta de la guía:
 *   - Línea de transporte según el eje y (x = 0): alimentador por el lado −y, centro de
 *     transferencia dentro de la carcasa (0, 0) y cinta H1 hacia +y con fotocélula S5.
 *   - A (eje x, avanza hacia +x): lleva la pieza del centro de la carcasa a la báscula.
 *   - Báscula en x = 1.95 con bloqueo por el pasador del cilindro B (eje y).
 *   - C (eje x, avanza hacia −x): el empujador en U devuelve la pieza OK a la línea.
 *   - D (eje y, avanza hacia −y): expulsa la pieza NOK a la canaleta y al contenedor.
 *
 * Avanza con un barrido fijo de 5 ms, igual que un PLC: el resultado no depende de los
 * FPS. No crea objetos durante el barrido (sin pausas del recolector de basura).
 */
export const PASO = 0.005;
export const T1 = 3; // s, pesaje con la báscula libre (T1_Pesaje, TON)
export const T2 = 2; // s, cinta tras detectar S5 (T2_Cinta, TON)
export const T_VIGILANCIA = 5; // s, vigilancia por etapa (cuestión 7 de la guía)
export const CONTEO_MAX = 32767; // PV de los CTU_INT
/* La guía simula la báscula con el conmutador S4. Para que el pesaje sea visible, el
   modelo genera un peso por pieza y activa S4 cuando cae dentro de la banda (supuesto). */
export const PESO_NOMINAL = 500; // g
export const TOLERANCIA = 10; // ± g
export const V_CINTA = 1.5; // u/s

/** Cotas compartidas con la escena (unidades del plano; z hacia arriba). */
export const GEO = {
  zMesa: 1.15, // plano de apoyo de las piezas
  radioPieza: 0.36,
  altoPieza: 0.55,
  zEje: 1.5, // eje de A, C y D
  zEjeB: 0.72, // eje del cilindro B
  // Alimentador (rodillos) y tope de espera dentro de la carcasa
  yAlimI: -5.8,
  yAlimF: -1.3,
  yTope: -0.8,
  pasoCola: 0.82,
  yAparicion: -5.0,
  zAparicion: 3.3,
  // Cilindro A
  caraA0: -1.8, // cara del empujador con A retraído (B1)
  carreraA: 3.37, // cara con A extendido (B2) = 1.57 -> pieza en x = 1.93
  // Báscula
  xPlato: 1.95,
  medioPlato: 0.6,
  // Cilindro C (empujador en U)
  caraC0: 3.2,
  carreraC: 2.84, // cara extendida (B5) = 0.36 -> pieza de vuelta en x = 0
  // Cilindro D (placa de empuje)
  caraD0: 0.85,
  carreraD: 1.55, // cara extendida (S3) = −0.70 -> pieza en la canaleta
  // Cilindro B (pasador de enclavamiento)
  carreraB: 0.6,
  // Canaleta NOK y contenedor de descarte
  xCan: 2.0,
  yCanI: -0.75,
  zCanI: 1.15,
  yCanF: -3.4,
  zCanF: 0.35,
  binNOK: { x0: 1.6, x1: 4.9, y0: -5.2, y1: -2.3, h: 0.6 },
  // Cinta H1 y contenedor de piezas buenas
  yCintaI: -0.4,
  yCintaF: 6.8,
  yS5: 4.4,
  binOK: { x0: -0.95, x1: 0.95, y0: 7.05, y1: 8.75, h: 0.7 },
  zFondo: 0.1,
};

export const ETAPAS = [
  { n: 0, accion: 'Reposo (condiciones iniciales)', salidas: '—', transicion: 'X21 · B1 · B4 · S1 · S2' },
  { n: 1, accion: 'A+ : pieza hacia la báscula', salidas: 'Y1', transicion: 'B2' },
  { n: 2, accion: 'A− y B− : libera la báscula', salidas: 'Y2, Y3', transicion: 'B1 · B3' },
  { n: 3, accion: 'Pesaje con báscula libre (T1)', salidas: 'Y3', transicion: 'T1.Q (3 s / X3)' },
  { n: 4, accion: 'B+ : bloqueo por muelle', salidas: '—', transicion: 'B4 · S4 → 5 | B4 · S4̅ → 9' },
  { n: 5, accion: 'C+ : pieza OK a la cinta', salidas: 'Y4', transicion: 'B5' },
  { n: 6, accion: 'C− : retorno por muelle', salidas: '—', transicion: 'S1' },
  { n: 7, accion: 'Cinta en marcha · C_OK +1', salidas: 'H1', transicion: 'S5' },
  { n: 8, accion: 'Cinta durante T2', salidas: 'H1', transicion: 'T2.Q (2 s / X8)' },
  { n: 9, accion: 'D+ : pieza NOK a la canaleta', salidas: 'Y5', transicion: 'S3' },
  { n: 10, accion: 'D− por muelle · C_NOK +1', salidas: '—', transicion: 'S2' },
];

/** Etapas vigiladas: actuador que debe alcanzar su detector (o S5) en T_VIGILANCIA. */
export const VIGILANCIA = {
  1: 'A no alcanza B2',
  2: 'A/B no alcanzan B1 · B3',
  4: 'B no alcanza B4 (báscula sin bloquear)',
  5: 'C no alcanza B5',
  6: 'C no alcanza S1',
  7: 'S5 no detecta la pieza en la cinta',
  9: 'D no alcanza S3',
  10: 'D no alcanza S2',
};

/* Estados de una pieza del grupo fijo (pool). */
export const P = {
  OCULTA: 0,
  COLA: 1, // en el alimentador (cayendo del almacén o sobre los rodillos)
  MESA: 2, // en el centro de la carcasa, en tránsito o sobre la báscula
  CINTA: 3, // sobre la cinta H1
  CAIDA_OK: 4,
  CAJA_OK: 5,
  RAMPA_NOK: 6,
  CAIDA_NOK: 7,
  CAJA_NOK: 8,
};
export const N_PIEZAS = 16;
const N_COLA = 4;
const HUECOS_OK = 4;
const HUECOS_NOK = 6;
const N_TENDENCIA = 160; // 16 s de historia a 10 Hz

const crearEje = () => ({ x: 0, prev: 0, v: 0 });

/** Movimiento con aceleración y amortiguación neumática de fin de carrera. */
function mover(c, dir, tiempo, h, atascado) {
  if (atascado) {
    c.v = 0;
    return;
  }
  const vmax = 1.15 / tiempo;
  const dist = dir > 0 ? 1 - c.x : c.x;
  const objetivo = dir * vmax * Math.min(1, 0.22 + dist / 0.16);
  const maxCambio = (vmax / 0.1) * h;
  c.v += Math.max(-maxCambio, Math.min(maxCambio, objetivo - c.v));
  c.x += c.v * h;
  if (c.x <= 0) {
    c.x = 0;
    c.v = 0;
  } else if (c.x >= 1) {
    c.x = 1;
    c.v = 0;
  }
}

/** Generador pseudoaleatorio reproducible (mulberry32). */
function rng(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sat = (v) => Math.min(1, Math.max(0, v));

export function createPlanta({ semilla = 12 } = {}) {
  const X = new Uint8Array(11); // GP
  const azar = rng(semilla);

  // Piezas: arreglos planos, sin objetos nuevos durante la simulación.
  const pz = {
    estado: new Uint8Array(N_PIEZAS),
    x: new Float32Array(N_PIEZAS),
    y: new Float32Array(N_PIEZAS),
    z: new Float32Array(N_PIEZAS),
    px: new Float32Array(N_PIEZAS),
    py: new Float32Array(N_PIEZAS),
    pzz: new Float32Array(N_PIEZAS),
    rx: new Float32Array(N_PIEZAS), // inclinación en la canaleta (giro sobre x)
    prx: new Float32Array(N_PIEZAS),
    s: new Float32Array(N_PIEZAS), // aparición o tiempo de caída
    v: new Float32Array(N_PIEZAS), // velocidad de traslación
    vz: new Float32Array(N_PIEZAS), // velocidad vertical
    x0: new Float32Array(N_PIEZAS), // punto de partida de una caída
    y0: new Float32Array(N_PIEZAS),
    z0: new Float32Array(N_PIEZAS),
    peso: new Float32Array(N_PIEZAS),
    orden: new Uint32Array(N_PIEZAS), // antigüedad (para reciclar los contenedores)
    hueco: new Uint8Array(N_PIEZAS), // posición dentro del contenedor
  };

  const p = {
    X,
    pz,
    A: crearEje(),
    B: crearEje(), // B.x = fracción de retracción (0 = extendido, báscula bloqueada)
    C: crearEje(),
    D: crearEje(),
    dirA: -1, // memoria de la 5/2 biestable
    y1: false,
    y2: false,
    y3: false,
    y4: false,
    y5: false,
    h1: false,
    // Mando
    marcha: false, // X21 del GRAFCET de modo
    s0Pendiente: false,
    s0: false,
    s6Pulsado: false, // orden de paro (pulsador NC accionado)
    cableS6Roto: false,
    // Fallas inyectables y supervisión
    sinTension: false, // corte de la tensión de mando (prueba 7 de la tabla de resultados)
    fallas: { A: false, B: false, C: false, D: false, S5: false },
    tEtapa: 0,
    alarma: '', // texto de la alarma de vigilancia (vacío = sin alarma)
    alarmaEtapa: -1,
    // Báscula
    peso: 0, // lectura del indicador (g)
    vPeso: 0,
    pPeso: 0,
    hundido: 0, // descenso visual del plato libre
    pHundido: 0,
    s4: false,
    modoTolerancia: 'aleatorio', // 'aleatorio' | 'ok' | 'nok'
    probNOK: 0.3,
    tendencia: new Float32Array(N_TENDENCIA),
    iTendencia: 0,
    tMuestra: 0,
    // Temporizadores y cinta
    t1: 0,
    t2: 0,
    cinta: 0, // desplazamiento acumulado de la banda (textura)
    pCinta: 0,
    // Contadores (CTU) y estadística
    ok: 0,
    nok: 0,
    ciclos: 0,
    tCiclo: 0,
    ultimoCiclo: 0,
    secuencia: 0,
    ultimoPeso: 0,
    liberada: -1, // pieza que el tope del alimentador ya dejó pasar hacia el centro
  };
  X[0] = 1;

  /* ── Piezas ── */
  function nuevoPeso() {
    const malo = p.modoTolerancia === 'nok' ? true : p.modoTolerancia === 'ok' ? false : azar() < p.probNOK;
    if (!malo) return PESO_NOMINAL + (azar() * 2 - 1) * (TOLERANCIA * 0.75);
    const d = TOLERANCIA * (1.4 + azar() * 2.2);
    return PESO_NOMINAL + (azar() < 0.5 ? -d : d);
  }
  function contar(estado) {
    let n = 0;
    for (let i = 0; i < N_PIEZAS; i++) if (pz.estado[i] === estado) n++;
    return n;
  }
  function libre() {
    for (let i = 0; i < N_PIEZAS; i++) if (pz.estado[i] === P.OCULTA) return i;
    let k = -1; // sin hueco: recicla la pieza más antigua de los contenedores
    for (let i = 0; i < N_PIEZAS; i++) {
      const e = pz.estado[i];
      if ((e === P.CAJA_OK || e === P.CAJA_NOK) && (k < 0 || pz.orden[i] < pz.orden[k])) k = i;
    }
    return k;
  }
  /** Primer hueco libre de un contenedor; si está lleno, retira la pieza más antigua. */
  function huecoCaja(estado, n) {
    let usados = 0;
    let viejo = -1;
    for (let i = 0; i < N_PIEZAS; i++) {
      if (pz.estado[i] !== estado) continue;
      usados |= 1 << pz.hueco[i];
      if (viejo < 0 || pz.orden[i] < pz.orden[viejo]) viejo = i;
    }
    for (let k = 0; k < n; k++) if (!(usados & (1 << k))) return k;
    pz.estado[viejo] = P.OCULTA;
    return pz.hueco[viejo];
  }
  const huecoOK = (k) => [k % 2 ? 0.45 : -0.45, GEO.binOK.y0 + 0.5 + Math.floor(k / 2) * 0.8];
  const huecoNOK = (k) => [2.4 + (k % 3) * 0.85, -3.75 - Math.floor(k / 3) * 0.85];

  function colocar(i, estado, x, y, z) {
    pz.estado[i] = estado;
    pz.x[i] = pz.px[i] = x;
    pz.y[i] = pz.py[i] = y;
    pz.z[i] = pz.pzz[i] = z;
    pz.rx[i] = pz.prx[i] = 0;
    pz.v[i] = 0;
    pz.vz[i] = 0;
    pz.s[i] = 1;
    pz.peso[i] = nuevoPeso();
    pz.orden[i] = ++p.secuencia;
  }
  function alimentar() {
    if (contar(P.COLA) >= N_COLA) return;
    const i = libre();
    if (i < 0) return;
    colocar(i, P.COLA, 0, GEO.yAparicion, GEO.zAparicion); // cae del almacén
    pz.s[i] = 0;
  }

  function s5() {
    if (p.fallas.S5) return false;
    for (let i = 0; i < N_PIEZAS; i++) {
      if (pz.estado[i] === P.CINTA && Math.abs(pz.y[i] - GEO.yS5) < GEO.radioPieza) return true;
    }
    return false;
  }

  const sensores = () => ({
    B1: p.A.x <= 0.01,
    B2: p.A.x >= 0.99,
    B3: p.B.x >= 0.99, // B retraído (báscula libre)
    B4: p.B.x <= 0.01, // B extendido (báscula bloqueada)
    S1: p.C.x <= 0.01,
    B5: p.C.x >= 0.99,
    S2: p.D.x <= 0.01,
    S3: p.D.x >= 0.99,
    S4: p.s4,
    S5: s5(),
    S0: p.s0,
    S6: !(p.s6Pulsado || p.cableS6Roto), // entrada NC: 1 = sin orden de paro
  });

  /** Barrido del FB_EstacionPeso (secciones 1 a 5 del SCL de la guía). */
  function barridoPLC(s, h) {
    /* 1. GRAFCET de modo (GM): el paro tiene prioridad y solo borra la marcha */
    if (!s.S6) p.marcha = false;
    else if (p.s0) p.marcha = true;

    /* 2. GRAFCET de producción (GP): receptividades con la situación previa */
    const t01 = X[0] && p.marcha && s.B1 && s.B4 && s.S1 && s.S2;
    const t12 = X[1] && s.B2;
    const t23 = X[2] && s.B1 && s.B3;
    const t34 = X[3] && p.t1 >= T1;
    const t45 = X[4] && s.B4 && s.S4;
    const t49 = X[4] && s.B4 && !s.S4;
    const t56 = X[5] && s.B5;
    const t67 = X[6] && s.S1;
    const t78 = X[7] && s.S5;
    const t80 = X[8] && p.t2 >= T2;
    const t910 = X[9] && s.S3;
    const t100 = X[10] && s.S2;
    const antes = p.etapa();
    if (t01) ((X[0] = 0), (X[1] = 1), (p.tCiclo = 0));
    if (t12) ((X[1] = 0), (X[2] = 1));
    if (t23) ((X[2] = 0), (X[3] = 1));
    if (t34) ((X[3] = 0), (X[4] = 1));
    if (t45) ((X[4] = 0), (X[5] = 1));
    if (t49) ((X[4] = 0), (X[9] = 1));
    if (t56) ((X[5] = 0), (X[6] = 1));
    if (t67) ((X[6] = 0), (X[7] = 1), (p.ok = Math.min(CONTEO_MAX, p.ok + 1))); // C_OK: CU = ↑X7
    if (t78) ((X[7] = 0), (X[8] = 1));
    if (t80) ((X[8] = 0), (X[0] = 1));
    if (t910) ((X[9] = 0), (X[10] = 1), (p.nok = Math.min(CONTEO_MAX, p.nok + 1))); // C_NOK: CU = ↑X10
    if (t100) ((X[10] = 0), (X[0] = 1));
    if (t80 || t100) {
      p.ciclos += 1;
      p.ultimoCiclo = p.tCiclo;
    }
    if (t34) p.ultimoPeso = p.peso;

    /* 3. Temporizadores TON (IN = X3 y X8) */
    p.t1 = X[3] ? p.t1 + h : 0;
    p.t2 = X[8] ? p.t2 + h : 0;
    if (!X[0]) p.tCiclo += h;

    /* Vigilancia por etapa (watchdog de la cuestión 7): solo señaliza, no altera GP */
    const ahora = p.etapa();
    p.tEtapa = ahora === antes ? p.tEtapa + h : 0;
    if (!p.alarma && VIGILANCIA[ahora] && p.tEtapa >= T_VIGILANCIA) {
      p.alarma = `Etapa ${ahora}: ${VIGILANCIA[ahora]} en ${T_VIGILANCIA} s`;
      p.alarmaEtapa = ahora;
    }

    /* 4. Acciones continuas */
    p.y1 = X[1] === 1;
    p.y2 = X[2] === 1;
    p.y3 = (X[2] || X[3]) === 1;
    p.y4 = X[5] === 1;
    p.y5 = X[9] === 1;
    p.h1 = (X[7] || X[8]) === 1;
  }

  /** Un barrido del PLC seguido de un paso de la planta. */
  p.paso = function paso() {
    const h = PASO;
    p.A.prev = p.A.x;
    p.B.prev = p.B.x;
    p.C.prev = p.C.x;
    p.D.prev = p.D.x;
    p.pPeso = p.peso;
    p.pHundido = p.hundido;
    p.pCinta = p.cinta;
    for (let i = 0; i < N_PIEZAS; i++) {
      pz.px[i] = pz.x[i];
      pz.py[i] = pz.y[i];
      pz.pzz[i] = pz.z[i];
      pz.prx[i] = pz.rx[i];
    }

    /* ── PLC: con la tensión de mando cortada no hay barrido y las salidas caen a 0 ── */
    const s = sensores();
    p.s0 = p.s0Pendiente;
    p.s0Pendiente = false;
    if (p.sinTension) {
      p.y1 = p.y2 = p.y3 = p.y4 = p.y5 = p.h1 = false;
    } else {
      barridoPLC(s, h);
    }

    /* ── Planta: actuadores ── */
    if (p.y1) p.dirA = 1; // 5/2 biestable: memoriza el último pulso (también sin tensión)
    if (p.y2) p.dirA = -1;
    mover(p.A, p.dirA, 0.9, h, p.fallas.A);
    mover(p.B, p.y3 ? 1 : -1, 0.45, h, p.fallas.B); // 5/2 monoestable: sin tensión, B extendido
    mover(p.C, p.y4 ? 1 : -1, 1.0, h, p.fallas.C); // 5/2 monoestable
    mover(p.D, p.y5 ? 1 : -1, p.y5 ? 0.75 : 0.6, h, p.fallas.D); // simple efecto, muelle

    /* ── Planta: báscula (2.º orden, ω = 7 rad/s, ζ = 0.32) ── */
    const libreB = p.B.x >= 0.6;
    let carga = 0;
    for (let i = 0; i < N_PIEZAS; i++) {
      if (pz.estado[i] === P.MESA && pz.x[i] > GEO.xPlato - GEO.medioPlato && Math.abs(pz.y[i]) < GEO.medioPlato) {
        carga = pz.peso[i];
      }
    }
    if (libreB) {
      const w = 7;
      p.vPeso += (w * w * (carga - p.peso) - 2 * 0.32 * w * p.vPeso) * h;
      p.peso += p.vPeso * h;
    } else {
      p.vPeso = 0; // bloqueada: el indicador retiene la última lectura
      if (carga === 0 && X[0]) p.peso += (0 - p.peso) * Math.min(1, h * 6); // tara tras la descarga
    }
    // S4: con el conmutador (modos 'ok' / 'nok') manda la posición elegida, como en la guía;
    // con la báscula simulada, S4 = 1 si la lectura está dentro de la tolerancia.
    p.s4 = p.modoTolerancia === 'aleatorio' ? Math.abs(p.peso - PESO_NOMINAL) <= TOLERANCIA : p.modoTolerancia === 'ok';
    const hObj = libreB ? 0.035 * (carga / PESO_NOMINAL) : 0;
    p.hundido += (hObj - p.hundido) * Math.min(1, h * 10);
    p.tMuestra += h;
    if (p.tMuestra >= 0.1) {
      p.tMuestra -= 0.1;
      p.tendencia[p.iTendencia] = p.peso;
      p.iTendencia = (p.iTendencia + 1) % N_TENDENCIA;
    }

    /* ── Planta: cinta ── */
    if (p.h1) p.cinta += V_CINTA * h;

    /* ── Planta: piezas ── */
    const R = GEO.radioPieza;
    const caraA = GEO.caraA0 + GEO.carreraA * p.A.x;
    const caraC = GEO.caraC0 - GEO.carreraC * p.C.x;
    const caraD = GEO.caraD0 - GEO.carreraD * p.D.x;
    // El tope del alimentador libera una pieza cuando el centro, la báscula y la cinta están
    // libres y A está atrás; una vez liberada, la pieza completa su recorrido (enclavamiento).
    let ocupado = p.liberada >= 0 || p.h1 || p.A.x > 0.02;
    let frente = -1;
    for (let i = 0; i < N_PIEZAS; i++) {
      const e = pz.estado[i];
      if (e === P.MESA || (e === P.CINTA && pz.y[i] < 1.4)) ocupado = true;
      if (e === P.COLA && pz.z[i] <= GEO.zMesa && (frente < 0 || pz.y[i] > pz.y[frente])) frente = i;
    }
    if (!ocupado && frente >= 0) p.liberada = frente;
    for (let i = 0; i < N_PIEZAS; i++) {
      const e = pz.estado[i];
      if (e === P.OCULTA) continue;
      if (e === P.COLA) {
        pz.s[i] = Math.min(1, pz.s[i] + h / 0.3); // aparición en el almacén
        if (pz.z[i] > GEO.zMesa) {
          // caída por gravedad desde el almacén hasta los rodillos
          pz.vz[i] -= 9.81 * h;
          pz.z[i] = Math.max(GEO.zMesa, pz.z[i] + pz.vz[i] * h);
          if (pz.z[i] === GEO.zMesa) pz.vz[i] = 0;
          continue;
        }
        const liberada = i === p.liberada;
        let rango = 0; // piezas en espera por delante (y mayor) sobre los rodillos
        for (let k = 0; k < N_PIEZAS; k++) {
          if (k !== i && k !== p.liberada && pz.estado[k] === P.COLA && pz.z[k] <= GEO.zMesa && pz.y[k] > pz.y[i]) {
            rango++;
          }
        }
        const objetivo = liberada ? 0 : GEO.yTope - rango * GEO.pasoCola;
        if (pz.y[i] < objetivo - 1e-4) {
          pz.v[i] = Math.min(liberada ? 4 : 2.2, pz.v[i] + 18 * h);
          pz.y[i] = Math.min(objetivo, pz.y[i] + pz.v[i] * h);
        } else pz.v[i] = 0;
        if (liberada && pz.y[i] >= -1e-3) {
          pz.y[i] = 0;
          pz.estado[i] = P.MESA;
          p.liberada = -1;
        }
      } else if (e === P.MESA) {
        if (pz.x[i] < caraA + R) pz.x[i] = Math.min(GEO.xPlato, caraA + R); // empuje de A (+x)
        if (pz.x[i] > caraC - R) pz.x[i] = Math.max(0, caraC - R); // empuje de C (−x)
        const enPlato = pz.x[i] > GEO.xPlato - GEO.medioPlato;
        pz.z[i] = GEO.zMesa - (enPlato ? p.hundido : 0);
        if (enPlato && pz.y[i] > caraD - R) pz.y[i] = caraD - R; // empuje de D (−y)
        if (pz.y[i] < -GEO.medioPlato - 0.12) {
          pz.estado[i] = P.RAMPA_NOK;
          pz.v[i] = 0.9;
        } else if (p.h1 && Math.abs(pz.x[i]) < 0.15) {
          pz.x[i] = 0;
          pz.estado[i] = P.CINTA; // la cinta arrastra la pieza devuelta por C
        }
      } else if (e === P.CINTA) {
        if (p.h1) pz.y[i] += V_CINTA * h;
        if (pz.y[i] > GEO.yCintaF) {
          pz.estado[i] = P.CAIDA_OK;
          pz.s[i] = 0;
          pz.x0[i] = pz.x[i];
          pz.y0[i] = pz.y[i];
          pz.z0[i] = pz.z[i];
          pz.hueco[i] = huecoCaja(P.CAJA_OK, HUECOS_OK);
        }
      } else if (e === P.CAIDA_OK) {
        pz.s[i] += h;
        const [xT, yT] = huecoOK(pz.hueco[i]);
        const u = sat(pz.s[i] / 0.55);
        const k = u * (2 - u);
        pz.x[i] = pz.x0[i] + (xT - pz.x0[i]) * k;
        pz.y[i] = pz.y0[i] + (yT - pz.y0[i]) * k;
        // La caída termina por tiempo: z se guarda en Float32 y no se compara con igualdad.
        const zc = pz.z0[i] - 4.9 * pz.s[i] * pz.s[i];
        pz.z[i] = Math.max(GEO.zFondo, zc);
        pz.rx[i] = -0.5 * Math.sin(Math.PI * u);
        if (u >= 1 && zc <= GEO.zFondo) {
          pz.rx[i] = 0;
          pz.estado[i] = P.CAJA_OK;
        }
      } else if (e === P.RAMPA_NOK) {
        // Desliza por la canaleta: z lineal entre (yCanI, zCanI) y (yCanF, zCanF)
        pz.v[i] = Math.min(3.5, pz.v[i] + 4.5 * h);
        pz.y[i] -= pz.v[i] * h;
        pz.x[i] += (GEO.xCan - pz.x[i]) * Math.min(1, h * 6);
        const u = sat((GEO.yCanI - pz.y[i]) / (GEO.yCanI - GEO.yCanF));
        pz.z[i] = GEO.zCanI + (GEO.zCanF - GEO.zCanI) * u;
        pz.rx[i] = 0.29 * sat((GEO.yCanI - pz.y[i]) / 0.25);
        if (pz.y[i] <= GEO.yCanF) {
          pz.estado[i] = P.CAIDA_NOK;
          pz.s[i] = 0;
          pz.x0[i] = pz.x[i];
          pz.y0[i] = pz.y[i];
          pz.z0[i] = pz.z[i];
          pz.hueco[i] = huecoCaja(P.CAJA_NOK, HUECOS_NOK);
        }
      } else if (e === P.CAIDA_NOK) {
        pz.s[i] += h;
        const [xT, yT] = huecoNOK(pz.hueco[i]);
        const u = sat(pz.s[i] / 0.45);
        const k = u * (2 - u);
        pz.x[i] = pz.x0[i] + (xT - pz.x0[i]) * k;
        pz.y[i] = pz.y0[i] + (yT - pz.y0[i]) * k;
        const zc = pz.z0[i] - 4.9 * pz.s[i] * pz.s[i];
        pz.z[i] = Math.max(GEO.zFondo, zc);
        pz.rx[i] *= 1 - Math.min(1, h * 8);
        if (u >= 1 && zc <= GEO.zFondo) {
          pz.rx[i] = 0;
          pz.estado[i] = P.CAJA_NOK;
        }
      }
    }
    alimentar();
  };

  /* ── Órdenes del operario ── */
  p.pulsarS0 = () => {
    p.s0Pendiente = true;
  };
  p.alternarS6 = () => {
    p.s6Pulsado = !p.s6Pulsado;
  };
  p.resetConteo = () => {
    // Reset_Conteo (%M10.0): pone a cero C_OK y C_NOK
    p.ok = 0;
    p.nok = 0;
  };
  /**
   * Cambia la fuente de S4 (conmutador de la guía): 'ok' / 'nok' fijan el resultado,
   * 'aleatorio' simula la báscula. Las piezas aún no pesadas reciben un peso coherente.
   */
  p.fijarModo = (modo) => {
    if (modo === p.modoTolerancia) return;
    p.modoTolerancia = modo;
    // Las piezas en espera o en la báscula reciben un peso coherente con la nueva posición
    // (si la báscula está libre, la lectura evoluciona hacia él con el filtro de 2.º orden).
    for (let i = 0; i < N_PIEZAS; i++) {
      const e = pz.estado[i];
      if (e === P.COLA || e === P.MESA) pz.peso[i] = nuevoPeso();
    }
  };
  p.reconocerAlarma = () => {
    p.alarma = '';
    p.alarmaEtapa = -1;
    p.tEtapa = 0;
  };
  /**
   * Corte / restablecimiento de la tensión de mando. Al volver la tensión, la CPU
   * arranca de nuevo: GP en la etapa 0 y GM en la etapa 20 (variables no remanentes).
   */
  p.cortarTension = (corte) => {
    if (p.sinTension && !corte) {
      X.fill(0);
      X[0] = 1;
      p.marcha = false;
      p.t1 = 0;
      p.t2 = 0;
      p.tEtapa = 0;
    }
    p.sinTension = corte;
  };
  /** Reinicia la estación: GRAFCET a la etapa 0, actuadores a reposo y contadores a cero. */
  p.reiniciar = () => {
    X.fill(0);
    X[0] = 1;
    p.marcha = false;
    p.s0Pendiente = false;
    p.s6Pulsado = false;
    p.dirA = -1;
    p.t1 = 0;
    p.t2 = 0;
    p.ok = 0;
    p.nok = 0;
    p.ciclos = 0;
    p.tCiclo = 0;
    p.ultimoCiclo = 0;
    p.peso = 0;
    p.vPeso = 0;
    p.reconocerAlarma();
    // Retira las piezas en tránsito; las del alimentador se conservan.
    if (p.liberada >= 0) pz.estado[p.liberada] = P.OCULTA;
    p.liberada = -1;
    for (let i = 0; i < N_PIEZAS; i++) {
      if (pz.estado[i] !== P.COLA) pz.estado[i] = P.OCULTA;
    }
  };

  /* ── Consultas ── */
  p.sensores = sensores;
  p.etapa = () => {
    for (let i = 0; i < X.length; i++) if (X[i]) return i;
    return -1;
  };
  p.etapaGM = () => (p.marcha ? 21 : 20);
  p.estado = () => {
    const e = p.etapa();
    if (p.sinTension) return 'Sin tensión de mando: salidas a 0';
    if (p.alarma) return 'ALARMA de vigilancia';
    if (p.cableS6Roto) return e === 0 ? 'Cable de S6 roto: estación detenida' : 'Cable de S6 roto: terminando ciclo';
    if (e === 0) return p.marcha ? 'Esperando condiciones iniciales' : 'Paro (etapa 20)';
    if (!p.marcha) return 'Paro de fin de ciclo solicitado';
    return 'Ciclo automático';
  };
  /** Sin movimiento pendiente: la escena puede dejar de dibujar. */
  p.quieta = () => {
    if (p.A.v || p.B.v || p.C.v || p.D.v || p.h1 || p.vPeso || p.s0Pendiente) return false;
    if (p.peso !== p.pPeso || p.hundido !== p.pHundido) return false;
    for (let i = 0; i < N_PIEZAS; i++) {
      if (pz.x[i] !== pz.px[i] || pz.y[i] !== pz.py[i] || pz.z[i] !== pz.pzz[i]) return false;
    }
    return true;
  };
  /** Resume el estado discreto en una cadena: la interfaz solo se actualiza cuando cambia. */
  p.firma = () => {
    const s = sensores();
    const bits = [
      s.B1,
      s.B2,
      s.B3,
      s.B4,
      s.S1,
      s.B5,
      s.S2,
      s.S3,
      s.S4,
      s.S5,
      s.S6,
      p.y1,
      p.y2,
      p.y3,
      p.y4,
      p.y5,
      p.h1,
      p.marcha,
      p.sinTension,
      p.fallas.A,
      p.fallas.B,
      p.fallas.C,
      p.fallas.D,
      p.fallas.S5,
    ];
    let b = 0;
    for (let i = 0; i < bits.length; i++) if (bits[i]) b |= 1 << i;
    return `${p.etapa()}|${b}|${p.ok}|${p.nok}|${p.alarma}`;
  };

  // Primera pieza en el centro de transferencia y el resto en el alimentador
  colocar(0, P.MESA, 0, 0, GEO.zMesa);
  for (let k = 1; k < N_COLA; k++) colocar(k, P.COLA, 0, GEO.yTope - (k - 1) * GEO.pasoCola, GEO.zMesa);
  return p;
}

/**
 * Ejecuta un ciclo completo sin interfaz y devuelve la duración de cada etapa.
 * @param {'ok'|'nok'} ruta  rama de la divergencia OR que se fuerza
 * @returns {{ etapa: number, inicio: number, fin: number }[]}
 */
export function medirCiclo(ruta = 'ok') {
  const p = createPlanta();
  p.modoTolerancia = ruta;
  // Las piezas ya creadas conservan su peso: se fija el de las que están en espera.
  for (let i = 0; i < N_PIEZAS; i++) {
    if (p.pz.estado[i] === P.COLA || p.pz.estado[i] === P.MESA) {
      p.pz.peso[i] = ruta === 'ok' ? PESO_NOMINAL + 2 : PESO_NOMINAL + 24;
    }
  }
  p.pulsarS0();
  const tramos = [];
  let actual = 0;
  let t0 = 0;
  let paroPedido = false;
  for (let i = 0; i < 40000; i++) {
    p.paso();
    const e = p.etapa();
    const t = (i + 1) * PASO;
    if (!paroPedido && e === 1) {
      p.s6Pulsado = true; // un solo ciclo: paro de fin de ciclo
      paroPedido = true;
    }
    if (e !== actual) {
      if (actual !== 0) tramos.push({ etapa: actual, inicio: t0, fin: t });
      actual = e;
      t0 = t;
      if (e === 0 && tramos.length) break;
    }
  }
  const origen = tramos[0]?.inicio ?? 0;
  return tramos.map((s) => ({ etapa: s.etapa, inicio: s.inicio - origen, fin: s.fin - origen }));
}
