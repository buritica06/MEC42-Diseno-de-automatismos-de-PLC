/**
 * Lógica del equipo de manipulación (Parcial Final, Semana 14), sin dependencias de Three.js.
 *
 * Reproduce el programa SCL del documento (IEC 60848 / IEC 61131-3):
 *   GP (producción, FB1): etapas 0 a 14, ciclo doble 1→2 y 1→3, T1 y T2 de 1,5 s, contador C1.
 *   GC (conducción, FB1): etapa 31 = marcha memorizada.
 *   GS (seguridad, FC1):  etapas 20 a 24, bloqueo, escape de D, retorno suave de D e inicialización.
 * y un modelo de la planta: cilindros A, B, C (5/2 monoestables), actuador giratorio D con dos 5/2
 * biestables (memoria neumática), relé de seguridad KS, zonas de aire Y8 (retardada 1 s) e Y9
 * (instantánea) y el flujo de piezas por las canaletas 1, 2 y 3.
 *
 * Barrido fijo de 5 ms (como un PLC): el resultado no depende de los FPS. El bucle no crea objetos.
 */
export const PASO = 0.005;
export const T_DESCARGA = 1.5; // s, temporizadores T1 (etapa 5) y T2 (etapa 12)
export const T_ESCAPE = 1.0; // s, etapa 21 de GS
export const T_VIGILANCIA = 5.0; // s, tiempo máximo de un movimiento
export const T_RETARDO_Y8 = 1.0; // s, desconexión retardada de la zona A-B-C

/** Geometría compartida con la escena (unidades de escena, z arriba). */
export const GEOMETRIA = {
  R1: 3.0, // radio de trabajo con C retraído (canaletas 1 y 2)
  carreraC: 0.9, // R2 = R1 + carreraC (canaleta 3)
  carreraB: 1.1, // descenso de la pinza
  phi1: 0, // dirección de la canaleta 1 (D−, S3)
  phi2: -Math.PI / 2, // dirección de las canaletas 2 y 3 (D+, B5)
  zs: 0.6, // cota del fondo de las canaletas en el punto de toma / descarga
  zPinza: 1.72, // cota de la base de la pieza sujeta con B arriba
  rPieza: 0.17,
  hPieza: 0.32,
  sep: 0.42, // separación entre piezas en un carril
};
const G = GEOMETRIA;
const R2 = G.R1 + G.carreraC;

/** Carriles: origen (punto de toma / descarga), dirección horizontal, pendiente y longitud. */
export const CARRILES = [
  null,
  { ox: G.R1, oy: 0, hx: 0, hy: 1, m: 0.2, L: 1.85, cap: 4 }, // 1: alimentación (sube hacia +Y)
  { ox: 0, oy: -G.R1, hx: -1, hy: 0, m: -0.16, L: 2.45, cap: 5 }, // 2: descarga con C retraído
  { ox: 0, oy: -R2, hx: -1, hy: 0, m: -0.16, L: 2.45, cap: 5 }, // 3: descarga con C extendido
];

/** Punto del fondo del carril c a la distancia horizontal s del origen. */
export function puntoCarril(c, s, out) {
  const k = CARRILES[c];
  out.x = k.ox + k.hx * s;
  out.y = k.oy + k.hy * s;
  out.z = G.zs + k.m * s;
  return out;
}

/** Etapas del GRAFCET de producción (GP). */
export const ETAPAS = [
  { n: 0, accion: 'Reposo en posición inicial', salidas: '—', transicion: 'X31 · B_PIEZA · /C1 · S1·B1·B3·S3' },
  { n: 1, accion: 'B+ : descenso a la canaleta 1', salidas: 'Y2', transicion: 'B2' },
  { n: 2, accion: 'A+ : sujeción de la pieza', salidas: 'Y2, Y1', transicion: 'S2' },
  { n: 3, accion: 'B− : ascenso con la pieza', salidas: 'Y1', transicion: 'B1' },
  { n: 4, accion: 'D+ : giro a canaletas 2/3', salidas: 'Y1, Y5, Y6', transicion: 'B5' },
  { n: 5, accion: 'T1 : estabilización de la carga', salidas: 'Y1', transicion: '1,5 s / X5' },
  { n: 6, accion: 'A− : pieza en canaleta 2', salidas: '—', transicion: 'S1' },
  { n: 7, accion: 'D− : retorno a canaleta 1', salidas: 'Y7, Y4', transicion: 'S3' },
  { n: 8, accion: 'B+ : descenso a la canaleta 1', salidas: 'Y2', transicion: 'B2' },
  { n: 9, accion: 'A+ : sujeción de la pieza', salidas: 'Y2, Y1', transicion: 'S2' },
  { n: 10, accion: 'B− : ascenso con la pieza', salidas: 'Y1', transicion: 'B1' },
  { n: 11, accion: 'C+ ∥ D+ : hacia canaleta 3', salidas: 'Y1, Y3, Y5, Y6', transicion: 'B4 · B5' },
  { n: 12, accion: 'T2 : estabilización de la carga', salidas: 'Y1, Y3', transicion: '1,5 s / X12' },
  { n: 13, accion: 'A− : pieza en canaleta 3', salidas: 'Y3', transicion: 'S1' },
  { n: 14, accion: 'C− ∥ D− : retorno (C1 + 1)', salidas: 'Y7, Y4', transicion: 'B3 · S3' },
];

/** Etapas del GRAFCET de seguridad (GS). */
export const ETAPAS_GS = {
  20: { accion: 'Bloqueo: F/GP:{ }', espera: 'KS_OK · S_EMG · ↑S_RESET · /F' },
  21: { accion: 'Escape de D (Y4 · Y6) mientras llena Y8', espera: '1 s / X21' },
  22: { accion: 'Retorno suave D− (Y7 · Y4)', espera: 'S1 · B1 · B3 · S3' },
  23: { accion: 'Inicialización F/GP:{0}', espera: 'X0' },
  24: { accion: 'Producción habilitada', espera: '/KS_OK + /S_EMG + F' },
};

/* ───────────────────────── Modelo de ejes ───────────────────────── */
const crearEje = () => ({ x: 0, prev: 0, v: 0 });

/**
 * Movimiento con aceleración y amortiguación de fin de carrera.
 * dir = 0 (sin presión o cámaras bloqueadas): el eje frena y queda detenido.
 */
function mover(c, dir, tiempo, h) {
  const vmax = 1.15 / tiempo;
  const dist = dir > 0 ? 1 - c.x : dir < 0 ? c.x : 0;
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

/* ───────────────────────── Piezas ───────────────────────── */
const N_PIEZAS = 20;
const crearPieza = () => ({ activa: false, lugar: '', carril: 0, s: 0, obj: 0, x: 0, y: 0, z: 0, vz: 0, escala: 0 });

export function createPlanta() {
  const p = {
    // GRAFCET
    gp: 0, // etapa GP (-1 = vacío)
    gpAnt: 0,
    marcha: false, // GC: X31
    gs: 20, // etapa GS
    resetMem: false,
    fallo: false,
    tEtapa: 0, // tiempo en la etapa GP actual
    tGS: 0, // tiempo en la etapa GS actual
    cv: 0, // contador C1
    lote: 10, // preselección N
    // Ejes (0 = posición inicial, 1 = posición de trabajo)
    A: crearEje(),
    B: crearEje(),
    C: crearEje(),
    D: crearEje(),
    v1Presion: false, // memoria de V1 (Y5 presión / Y4 escape) - cámara 1 de D
    v2Presion: true, // memoria de V2 (Y7 presión / Y6 escape) - cámara 2 de D
    // Salidas del PLC y bobinas físicas (con 3L+ alimentado por KS)
    y: new Uint8Array(8), // y[1..7]
    // Seguridad
    emgPulsada: false, // S_EMG enclavada
    ks: false, // relé de seguridad armado (arranque: requiere RESET)
    tDesconexion: 0, // retardo de Y8
    y8: false,
    y9: false,
    p1: 0, // presión zona A-B-C (0..1)
    p2: 0, // presión zona D
    // Mando
    pulsoStart: 0,
    pulsoStop: 0,
    pulsoReset: 0,
    resetAnt: false,
    suministro: true,
    tSinPieza: 0,
    falloB2: false,
    autoArranque: false,
    // Piezas
    piezas: Array.from({ length: N_PIEZAS }, crearPieza),
    enPinza: null,
    tAlimentar: 0,
    depositadas: 0,
    // Tiempos
    tCiclo: 0,
    ultimoCiclo: 0,
    ciclosDobles: 0,
  };
  const piezas = p.piezas;
  const tmp = { x: 0, y: 0, z: 0 };

  /* ── Sensores (finales de carrera y detectores) ── */
  const sens = {
    S1: true,
    S2: false,
    B1: true,
    B2: false,
    B3: true,
    B4: false,
    S3: true,
    B5: false,
    PIEZA: false,
  };
  function leerSensores() {
    sens.S1 = p.A.x <= 0.01;
    sens.S2 = p.A.x >= 0.99;
    sens.B1 = p.B.x <= 0.01;
    sens.B2 = p.B.x >= 0.99 && !p.falloB2;
    sens.B3 = p.C.x <= 0.01;
    sens.B4 = p.C.x >= 0.99;
    sens.S3 = p.D.x <= 0.01;
    sens.B5 = p.D.x >= 0.99;
    sens.PIEZA = piezaEnToma() !== null;
  }

  function piezaEnToma() {
    for (const z of piezas) if (z.activa && z.lugar === 'c1' && z.s < 0.03 && z.escala >= 0.99) return z;
    return null;
  }

  /** Posición de la base de la pieza sujeta, a partir de la cinemática A-B-C-D. */
  p.posPinza = (a, b, c, d, out) => {
    const phi = G.phi1 + d * (G.phi2 - G.phi1);
    const R = G.R1 + c * G.carreraC;
    out.x = R * Math.cos(phi);
    out.y = R * Math.sin(phi);
    out.z = G.zPinza - b * G.carreraB;
    out.phi = phi;
    return out;
  };

  /* ── Carriles: objetivos de las piezas en cola ── */
  function reordenar(c) {
    const k = CARRILES[c];
    const lista = piezas.filter((z) => z.activa && z.lugar === `c${c}`).sort((a, b) => (c === 1 ? a.s - b.s : b.s - a.s));
    if (c !== 1 && lista.length > k.cap) {
      // Canaleta llena: la pieza más antigua sale por el extremo (retirada por el operario).
      const vieja = lista.shift();
      vieja.lugar = 'sale';
    }
    lista.forEach((z, i) => {
      z.obj = c === 1 ? i * G.sep : k.L - 0.25 - i * G.sep;
    });
  }

  function alimentar(h) {
    const cola = piezas.filter((z) => z.activa && z.lugar === 'c1').length;
    p.tAlimentar += h;
    if (!p.suministro || cola >= CARRILES[1].cap || p.tAlimentar < 0.9) return;
    const libre = piezas.find((z) => !z.activa);
    if (!libre) return;
    p.tAlimentar = 0;
    Object.assign(libre, { activa: true, lugar: 'c1', carril: 1, s: CARRILES[1].L, obj: CARRILES[1].L, escala: 0, vz: 0 });
    reordenar(1);
  }

  function soltar() {
    const z = p.enPinza;
    p.enPinza = null;
    p.posPinza(p.A.x, p.B.x, p.C.x, p.D.x, tmp);
    Object.assign(z, { lugar: 'caida', carril: 0, x: tmp.x, y: tmp.y, z: tmp.z, vz: 0 });
  }

  /** Caída libre hasta el fondo de un carril o hasta el suelo. */
  function caer(z, h) {
    z.vz -= 14 * h;
    z.z += z.vz * h;
    for (let c = 1; c <= 3; c++) {
      const k = CARRILES[c];
      const dx = z.x - k.ox;
      const dy = z.y - k.oy;
      const s = dx * k.hx + dy * k.hy;
      const lat = -dx * k.hy + dy * k.hx;
      if (Math.abs(lat) < 0.28 && s > -0.2 && s < k.L) {
        const suelo = G.zs + k.m * s;
        if (z.z <= suelo) {
          Object.assign(z, { lugar: `c${c}`, carril: c, s: Math.max(0, s), obj: Math.max(0, s), vz: 0 });
          if (c !== 1) p.depositadas += 1;
          reordenar(c);
          return;
        }
      }
    }
    if (z.z <= 0) {
      z.z = 0;
      z.lugar = 'sale';
    }
  }

  function moverPiezas(h) {
    for (const z of piezas) {
      if (!z.activa) continue;
      if (z.lugar === 'caida') caer(z, h);
      else if (z.lugar === 'sale') {
        z.escala = Math.max(0, z.escala - h / 0.35);
        if (z.escala === 0) z.activa = false;
      } else if (z.lugar !== 'pinza') {
        if (z.escala < 1) z.escala = Math.min(1, z.escala + h / 0.3);
        const d = z.obj - z.s;
        const vmax = Math.min(1.8, 0.25 + 4 * Math.abs(d));
        z.s += Math.sign(d) * Math.min(Math.abs(d), vmax * h);
      }
    }
  }

  /* ── Un barrido del PLC seguido de un paso de la planta ── */
  p.paso = function paso() {
    const h = PASO;
    p.A.prev = p.A.x;
    p.B.prev = p.B.x;
    p.C.prev = p.C.x;
    p.D.prev = p.D.x;
    leerSensores();
    const { S1, S2, B1, B2, B3, B4, S3, B5, PIEZA } = sens;

    /* Hardware de seguridad: KS con rearme manual vigilado */
    const reset = p.pulsoReset > 0;
    if (p.emgPulsada) p.ks = false;
    else if (reset) p.ks = true;
    const start = p.pulsoStart > 0;
    const stopOk = !(p.pulsoStop > 0); // S_STOP es NC
    p.pulsoStart = Math.max(0, p.pulsoStart - h);
    p.pulsoStop = Math.max(0, p.pulsoStop - h);
    p.pulsoReset = Math.max(0, p.pulsoReset - h);

    /* ── FC1: GRAFCET de seguridad GS ── */
    const emergencia = !p.ks || p.emgPulsada;
    const ci = S1 && B1 && B3 && S3;
    if (reset && !p.resetAnt && p.gs === 20) p.resetMem = true;
    p.resetAnt = reset;
    const falloCiclo = p.gp >= 1 && p.tEtapa > T_VIGILANCIA;
    if (falloCiclo) p.fallo = true;
    const gsAnt = p.gs;
    if ((emergencia || p.fallo) && p.gs !== 20) {
      p.gs = 20;
      p.resetMem = false;
    } else if (p.gs === 20) {
      if (p.ks && !p.emgPulsada && p.resetMem && !falloCiclo) {
        p.fallo = false;
        p.resetMem = false;
        p.gs = 21;
      }
    } else if (p.gs === 21) {
      if (p.tGS >= T_ESCAPE) p.gs = 22;
    } else if (p.gs === 22) {
      if (ci) p.gs = 23;
      else if (p.tGS >= T_VIGILANCIA) {
        p.fallo = true;
        p.gs = 20;
      }
    } else if (p.gs === 23) {
      if (p.gp === 0) p.gs = 24;
    }
    p.tGS = p.gs === gsAnt ? p.tGS + h : 0;
    const forzarVacio = p.gs >= 20 && p.gs <= 22;
    const forzarInit = p.gs === 23;
    const habilitado = p.gs === 24;

    /* ── FB1: GRAFCET de conducción GC ── */
    // B_PIEZA filtrado (retardo a la desconexión de 2 s): el hueco que deja la pieza recién tomada
    // mientras la siguiente baja por la canaleta no se interpreta como falta de material.
    p.tSinPieza = PIEZA ? 0 : p.tSinPieza + h;
    const hayMaterial = p.tSinPieza < 2;
    const loteOk = p.cv >= p.lote;
    if (forzarVacio || !habilitado) p.marcha = false;
    else if (!p.marcha) {
      if (start && PIEZA && !loteOk) p.marcha = true;
    } else if (!stopOk || !hayMaterial || loteOk) p.marcha = false;

    /* ── FB1: GRAFCET de producción GP (máquina de estados) ── */
    const t = p.tEtapa;
    let fin = false;
    if (forzarVacio) p.gp = -1;
    else if (forzarInit) p.gp = 0;
    else {
      switch (p.gp) {
        case 0:
          if (p.marcha && PIEZA && !loteOk && ci) {
            p.gp = 1;
            p.tCiclo = 0;
          }
          break;
        case 1:
        case 8:
          if (B2) p.gp += 1;
          break;
        case 2:
        case 9:
          if (S2) p.gp += 1;
          break;
        case 3:
        case 10:
          if (B1) p.gp += 1;
          break;
        case 4:
          if (B5) p.gp = 5;
          break;
        case 5:
        case 12:
          if (t >= T_DESCARGA) p.gp += 1;
          break;
        case 6:
        case 13:
          if (S1) p.gp += 1;
          break;
        case 7:
          if (S3) p.gp = 8;
          break;
        case 11:
          if (B4 && B5) p.gp = 12;
          break;
        case 14:
          if (B3 && S3) {
            p.gp = 0;
            fin = true;
          }
          break;
        default:
          break; // -1: vacío
      }
    }
    p.tEtapa = p.gp === p.gpAnt ? p.tEtapa + h : 0;
    p.gpAnt = p.gp;
    p.tCiclo += h;
    if (fin) {
      p.cv += 1; // CTU (CU en el franqueo 14 → 0)
      p.ciclosDobles += 1;
      p.ultimoCiclo = p.tCiclo;
    }

    /* ── Acciones: GP + GS con enclavamientos (OB1) ── */
    const e = p.gp;
    const y = p.y;
    y[1] = (e >= 2 && e <= 5) || (e >= 9 && e <= 12) ? 1 : 0;
    y[2] = e === 1 || e === 2 || e === 8 || e === 9 ? 1 : 0;
    y[3] = e >= 11 && e <= 13 ? 1 : 0;
    const dMas = e === 4 || e === 11;
    const dMenos = e === 7 || e === 14 || p.gs === 22;
    const escape = p.gs === 21;
    const y4 = dMenos || escape;
    const y5 = dMas;
    const y6 = dMas || escape;
    const y7 = dMenos;
    // Una válvula biestable nunca recibe sus dos bobinas a la vez
    y[4] = y4 && !y5 ? 1 : 0;
    y[5] = y5 && !y4 ? 1 : 0;
    y[6] = y6 && !y7 ? 1 : 0;
    y[7] = y7 && !y6 ? 1 : 0;

    /* ── Planta ── */
    // Zonas de aire: Y9 cae al instante; Y8 cae 1 s después de abrir KS (parada categoría 1).
    p.y9 = p.ks;
    if (p.ks) {
      p.y8 = true;
      p.tDesconexion = 0;
    } else {
      p.tDesconexion += h;
      if (p.tDesconexion >= T_RETARDO_Y8) p.y8 = false;
    }
    p.p1 += ((p.y8 ? 1 : 0) - p.p1) * (1 - Math.exp(-h / (p.y8 ? 0.35 : 0.08)));
    p.p2 += ((p.y9 ? 1 : 0) - p.p2) * (1 - Math.exp(-h / (p.y9 ? 0.35 : 0.06)));
    // Las bobinas solo reciben tensión con KS armado (3L+).
    const bob = (i) => p.ks && y[i] === 1;
    if (bob(5)) p.v1Presion = true;
    if (bob(4)) p.v1Presion = false;
    if (bob(7)) p.v2Presion = true;
    if (bob(6)) p.v2Presion = false;

    const f1 = p.p1 > 0.3 ? p.p1 : 0;
    const f2 = p.p2 > 0.3 ? p.p2 : 0;
    mover(p.A, f1 ? (bob(1) ? 1 : -1) : 0, 0.45 / Math.max(f1, 0.3), h);
    mover(p.B, f1 ? (bob(2) ? 1 : -1) : 0, 0.65 / Math.max(f1, 0.3), h);
    mover(p.C, f1 ? (bob(3) ? 1 : -1) : 0, 0.75 / Math.max(f1, 0.3), h);
    const dirD = !f2 ? 0 : p.v1Presion && !p.v2Presion ? 1 : !p.v1Presion && p.v2Presion ? -1 : 0;
    mover(p.D, dirD, (p.gs === 22 ? 2.0 : 1.3) / Math.max(f2, 0.3), h);

    // Pinza: toma la pieza en la canaleta 1 y la suelta al abrir.
    if (!p.enPinza && p.A.x >= 0.8 && p.B.x >= 0.97 && p.D.x <= 0.02 && p.C.x <= 0.02) {
      const z = piezaEnToma();
      if (z) {
        z.lugar = 'pinza';
        p.enPinza = z;
        reordenar(1);
      }
    } else if (p.enPinza && p.A.x < 0.6) soltar();

    alimentar(h);
    moverPiezas(h);

    if (p.autoArranque && p.gs === 24 && p.gp === 0 && PIEZA) {
      p.autoArranque = false;
      p.pulsoStart = 0.05;
    }
  };

  /* ── Órdenes del operario ── */
  p.pulsarStart = () => (p.pulsoStart = 0.05);
  p.pulsarStop = () => (p.pulsoStop = 0.05);
  p.pulsarReset = () => {
    p.pulsoReset = 0.05;
    if (p.gp === 0 && !p.marcha) p.cv = 0; // RESET en reposo reinicia C1
  };
  p.alternarEmergencia = () => (p.emgPulsada = !p.emgPulsada);
  p.reiniciar = () => {
    Object.assign(p, {
      gp: -1,
      gpAnt: -1,
      marcha: false,
      gs: 20,
      resetMem: false,
      fallo: false,
      tEtapa: 0,
      tGS: 0,
      cv: 0,
      v1Presion: false,
      v2Presion: true,
      emgPulsada: false,
      ks: false,
      y8: false,
      y9: false,
      tDesconexion: T_RETARDO_Y8,
      enPinza: null,
      tCiclo: 0,
      ultimoCiclo: 0,
      ciclosDobles: 0,
      depositadas: 0,
      tSinPieza: 0,
    });
    p.y.fill(0);
    for (const ax of [p.A, p.B, p.C, p.D]) Object.assign(ax, { x: 0, prev: 0, v: 0 });
    for (const z of piezas) if (z.lugar !== 'c1') z.activa = false;
    reordenar(1);
  };

  /* ── Consultas ── */
  p.sensores = () => sens;
  p.estado = () => {
    if (p.emgPulsada) return 'Parada de emergencia';
    if (!p.ks) return 'Bloqueado: pulse S_RESET';
    if (p.gs === 20) return p.fallo ? 'Fallo: pulse S_RESET' : 'Bloqueado: pulse S_RESET';
    if (p.gs === 21 || p.gs === 22) return 'Reposición de D';
    if (p.gs === 23) return 'Inicializando';
    if (p.cv >= p.lote && p.gp === 0) return 'Lote completado';
    if (p.marcha) return 'Ciclo continuo';
    if (p.gp > 0) return 'Terminando ciclo';
    return sens.PIEZA ? 'Reposo: pulse S_START' : 'Reposo: sin pieza (B_PIEZA)';
  };
  /** Sin movimiento pendiente: la escena puede dejar de dibujar. */
  p.quieta = () => {
    if (p.A.v || p.B.v || p.C.v || p.D.v) return false;
    if (Math.abs(p.p1 - (p.y8 ? 1 : 0)) > 0.002 || Math.abs(p.p2 - (p.y9 ? 1 : 0)) > 0.002) return false;
    for (const z of piezas) {
      if (!z.activa) continue;
      if (z.lugar === 'caida' || z.lugar === 'sale' || z.escala < 1 || Math.abs(z.obj - z.s) > 1e-4) return false;
    }
    return true;
  };
  /** Estado discreto resumido en una cadena corta: la interfaz solo se repinta cuando cambia. */
  p.firma = () => {
    let bits = 0;
    let i = 0;
    for (const k in sens) bits |= (sens[k] ? 1 : 0) << i++;
    for (let j = 1; j <= 7; j++) bits |= (p.y[j] && p.ks ? 1 : 0) << i++;
    return `${p.gp}|${p.gs}|${p.marcha}|${p.ks}|${p.emgPulsada}|${p.y8}|${p.cv}|${p.fallo}|${bits}|${Boolean(p.enPinza)}`;
  };

  p.reiniciar();
  return p;
}

/**
 * Ejecuta un ciclo doble completo sin interfaz y devuelve la duración de cada etapa de GP.
 * Lo usan el diagrama de fases y las pruebas.
 * @returns {{ etapa: number, inicio: number, fin: number }[]}
 */
export function medirCiclo() {
  const p = createPlanta();
  // Deja que la canaleta 1 se llene y rearma el sistema
  for (let i = 0; i < 1200; i++) p.paso();
  p.pulsarReset();
  for (let i = 0; i < 2000 && p.gs !== 24; i++) p.paso();
  p.pulsarStart();
  const tramos = [];
  let actual = 0;
  let t0 = 0;
  for (let i = 0; i < 20000; i++) {
    p.paso();
    const e = p.gp;
    const t = i * PASO;
    if (e !== actual) {
      if (actual > 0) tramos.push({ etapa: actual, inicio: t0, fin: t });
      actual = e;
      t0 = t;
      if (e === 0 && tramos.length) break;
    }
  }
  const origen = tramos[0]?.inicio ?? 0;
  return tramos.map((s) => ({ etapa: s.etapa, inicio: s.inicio - origen, fin: s.fin - origen }));
}
