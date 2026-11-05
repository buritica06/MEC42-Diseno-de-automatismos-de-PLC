/**
 * Lógica de la estación de dosificación de Alimentos Del Valle, sin dependencias de Three.js.
 *
 * Reproduce las ecuaciones Set/Reset de la sección 9 de la guía de laboratorio:
 *   GP (producción): M0 a M9.  GS (seguridad y rearme): M10 a M13.
 *
 * Avanza con un barrido fijo de 5 ms, igual que un PLC, así el resultado no depende de los FPS. No crea
 * objetos durante el barrido: evita pausas del recolector de basura mientras la escena se anima.
 */
export const PASO = 0.005;
export const TIEMPOS = { dosif: 3, freno: 0.2, rev: 0.6, exp: 1 };

/** Geometría compartida con la escena (unidades de escena). */
export const GEOMETRIA = {
  radioFrasco: 0.35,
  caraPusher: 0.37,
  carreraC: 1.35,
  inicioEntrada: -7.2,
  bordeBanda: 0.5,
  entradaTapadora: -5.6,
};

const VEL_BANDA = 1.3;
const SEPARACION = 0.82;
const ESPERA_ASIENTO = -0.85;
const MAX_FRASCOS = 7;
const INTERVALO_FRASCOS = 8;

export const ETAPAS = [
  { n: 0, accion: 'Reposo: espera de condiciones de inicio', transicion: 'AUTO · S_FRASCO · a0 · b0 · c0' },
  { n: 1, accion: 'Y1 (A+): sujeción y centrado del frasco', transicion: 'a1' },
  { n: 2, accion: 'Y3 (B+): inmersión de la boquilla', transicion: 'b1' },
  { n: 3, accion: 'KM1: dosificación en giro horario', transicion: '3.0 s/X3' },
  { n: 4, accion: 'Pausa: disipación de la inercia del husillo', transicion: '200 ms/X4' },
  { n: 5, accion: 'KM2: succión antigoteo en giro antihorario', transicion: '0.6 s/X5' },
  { n: 6, accion: 'Y4 (B−): ascenso de la boquilla', transicion: 'b0' },
  { n: 7, accion: 'Y2 (A−): apertura de la mordaza', transicion: 'a0' },
  { n: 8, accion: 'Y5 (C+): expulsión del frasco hacia la cinta', transicion: '1.0 s/X8' },
  { n: 9, accion: 'Y5 = 0: retorno del cilindro C por resorte', transicion: 'c0' },
];

const crearCilindro = (dir = -1) => ({ x: 0, prev: 0, v: 0, dir });

/** Movimiento con aceleración y amortiguación de fin de carrera: nunca hay saltos de velocidad. */
function mover(c, dir, tiempo, h) {
  const vmax = 1.15 / tiempo;
  const dist = dir > 0 ? 1 - c.x : c.x;
  const objetivo = dir * vmax * Math.min(1, 0.22 + dist / 0.18);
  const maxCambio = (vmax / 0.12) * h;
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

export function createPlanta() {
  const M = new Uint8Array(14);
  const S = new Uint8Array(14);
  const R = new Uint8Array(14);
  const frascos = Array.from({ length: MAX_FRASCOS }, () => ({
    estado: 'libre',
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    fill: 0,
    pfill: 0,
    escala: 0,
    pescala: 0,
  }));

  const p = {
    M,
    frascos,
    A: crearCilindro(),
    B: crearCilindro(),
    C: crearCilindro(),
    y1: false,
    y2: false,
    y3: false,
    y4: false,
    y5: false,
    km1: false,
    km2: false,
    w: 0,
    pw: 0,
    theta: 0,
    ptheta: 0,
    succion: 0,
    psuccion: 0,
    banda: 0,
    pbanda: 0,
    vBanda: 0,
    auto: false,
    estop: true,
    rt1: true,
    start: false,
    reset: false,
    primerBarrido: true,
    marchaPendiente: false,
    stopPulso: false,
    t3: 0,
    t4: 0,
    t5: 0,
    t8: 0,
    tProx: 0,
    tCiclo: 0,
    ultimoCiclo: 0,
    ciclos: 0,
    terminados: 0,
  };

  const asiento = () => {
    for (const f of frascos) if (f.estado === 'asiento') return f;
    return null;
  };
  const sensores = () => ({
    a0: p.A.x <= 0.01,
    a1: p.A.x >= 0.99,
    b0: p.B.x <= 0.01,
    b1: p.B.x >= 0.99,
    c0: p.C.x <= 0.01,
    sFrasco: asiento() !== null,
  });

  function retirar(condicion) {
    for (const f of frascos) if (f.estado !== 'libre' && condicion(f)) f.estado = 'retiro';
  }

  function nuevoFrasco() {
    for (const f of frascos) {
      if (f.estado === 'libre') {
        f.estado = 'entrada';
        f.x = f.px = GEOMETRIA.inicioEntrada;
        f.y = f.py = 0;
        f.fill = f.pfill = 0;
        f.escala = f.pescala = 0;
        return;
      }
    }
  }

  function moverFrascos(h, c0) {
    const avance = p.vBanda * h;
    const cara = GEOMETRIA.caraPusher - GEOMETRIA.carreraC * p.C.x;
    const hayAsiento = asiento() !== null;
    let libreDeEntrada = true;
    for (const f of frascos) {
      f.px = f.x;
      f.py = f.y;
      f.pfill = f.fill;
      f.pescala = f.escala;
      if (f.estado === 'libre') continue;
      if (f.estado === 'retiro') {
        f.escala = Math.max(0, f.escala - h / 0.25);
        if (f.escala === 0) f.estado = 'libre';
        continue;
      }
      if (f.escala < 1) f.escala = Math.min(1, f.escala + h / 0.25);
      if (f.estado === 'entrada') {
        let limite = hayAsiento || !c0 ? ESPERA_ASIENTO : 0;
        for (const o of frascos) {
          if (o !== f && o.estado === 'entrada' && o.x > f.x) limite = Math.min(limite, o.x - SEPARACION);
        }
        const freno = Math.min(1, 0.2 + (limite - f.x) / 0.6);
        f.x = Math.min(limite, f.x + avance * Math.max(0, freno));
        if (f.x >= -1e-3 && limite === 0) {
          f.x = 0;
          f.estado = 'asiento';
        }
        if (f.x < GEOMETRIA.inicioEntrada + SEPARACION + 0.1) libreDeEntrada = false;
      } else if (f.estado === 'asiento' || f.estado === 'expulsion') {
        const tope = cara - GEOMETRIA.radioFrasco;
        if (f.y < -GEOMETRIA.bordeBanda) f.y -= avance;
        f.y = Math.min(f.y, tope);
        if (f.estado === 'asiento' && f.y < -0.02) f.estado = 'expulsion';
        if (f.estado === 'expulsion' && f.y < -GEOMETRIA.bordeBanda - 0.7) f.estado = 'salida';
      } else if (f.estado === 'salida') {
        f.y -= avance;
        if (f.y < GEOMETRIA.entradaTapadora) {
          f.estado = 'retiro';
          p.terminados += 1;
        }
      }
    }
    p.tProx = Math.max(0, p.tProx - h);
    if (p.auto && p.vBanda > 0.5 && p.tProx === 0 && libreDeEntrada) {
      nuevoFrasco();
      p.tProx = INTERVALO_FRASCOS;
    }
  }

  /** Un barrido del PLC seguido de un paso de la planta. */
  p.paso = function paso() {
    const h = PASO;
    p.A.prev = p.A.x;
    p.B.prev = p.B.x;
    p.C.prev = p.C.x;
    p.pw = p.w;
    p.ptheta = p.theta;
    p.psuccion = p.succion;
    p.pbanda = p.banda;

    /* ── Órdenes de marcha ── */
    const falla = !p.estop || !p.rt1;
    if (falla) p.marchaPendiente = false;
    p.reset = p.marchaPendiente && M[10] === 1;
    if (p.reset) retirar((f) => f.estado === 'asiento' || f.estado === 'expulsion');
    p.start = p.marchaPendiente && M[13] === 1;
    if (p.start) p.marchaPendiente = false;
    const stop = !p.stopPulso;
    p.stopPulso = false;

    /* ── Entradas ── */
    const a0 = p.A.x <= 0.01;
    const a1 = p.A.x >= 0.99;
    const b0 = p.B.x <= 0.01;
    const b1 = p.B.x >= 0.99;
    const c0 = p.C.x <= 0.01;
    const sFrasco = asiento() !== null;
    const tDosif = p.t3 >= TIEMPOS.dosif;
    const tFreno = p.t4 >= TIEMPOS.freno;
    const tRev = p.t5 >= TIEMPOS.rev;
    const tExp = p.t8 >= TIEMPOS.exp;
    const condInicio = p.auto && sFrasco && a0 && b0 && c0;
    const rgp = M[10] || M[11] || M[12];

    /* ── Set / Reset (guía, sección 9); Reset tiene prioridad ── */
    S[0] = (M[9] && c0) || M[12] ? 1 : 0;
    S[1] = M[0] && condInicio ? 1 : 0;
    S[2] = M[1] && a1 ? 1 : 0;
    S[3] = M[2] && b1 ? 1 : 0;
    S[4] = M[3] && tDosif ? 1 : 0;
    S[5] = M[4] && tFreno ? 1 : 0;
    S[6] = M[5] && tRev ? 1 : 0;
    S[7] = M[6] && b0 ? 1 : 0;
    S[8] = M[7] && a0 ? 1 : 0;
    S[9] = M[8] && tExp ? 1 : 0;
    // M12 se incluye para que una falla en ese único barrido no deje GS sin etapa activa.
    S[10] = p.primerBarrido || ((M[11] || M[12] || M[13]) && falla) ? 1 : 0;
    S[11] = M[10] && p.reset && !falla ? 1 : 0;
    S[12] = M[11] && a0 && b0 && c0 && !falla ? 1 : 0;
    S[13] = M[12];

    R[0] = M[1] || M[10] || M[11] ? 1 : 0;
    for (let i = 1; i < 10; i++) R[i] = M[(i + 1) % 10] || rgp ? 1 : 0;
    R[10] = M[11];
    R[11] = M[12] || falla ? 1 : 0;
    R[12] = M[13] || falla ? 1 : 0;
    R[13] = falla ? 1 : 0;

    const veniaDe9 = M[9];
    const estaba0 = M[0];
    const estaba1 = M[1];
    for (let i = 0; i < 14; i++) {
      if (S[i]) M[i] = 1;
      if (R[i]) M[i] = 0;
    }
    p.primerBarrido = false;

    if (p.start && stop && M[13]) p.auto = true;
    if (!stop || !M[13]) p.auto = false;

    /* ── Temporizadores TON ── */
    p.t3 = M[3] ? p.t3 + h : 0;
    p.t4 = M[4] ? p.t4 + h : 0;
    p.t5 = M[5] ? p.t5 + h : 0;
    p.t8 = M[8] ? p.t8 + h : 0;
    if (M[1] && !estaba1) p.tCiclo = 0;
    else p.tCiclo += h;
    if (veniaDe9 && !estaba0 && M[0]) {
      p.ciclos += 1;
      p.ultimoCiclo = p.tCiclo;
    }

    /* ── Salidas; S0 corta por cableado KM1, KM2 e Y5, y RT1 corta KM1 y KM2 ── */
    p.y1 = M[1] === 1;
    p.y3 = M[2] === 1;
    p.y4 = M[6] === 1 || M[11] === 1;
    p.y2 = M[7] === 1 || (M[11] === 1 && b0);
    p.y5 = M[8] === 1 && p.estop;
    const q1 = M[3] === 1 && !p.km2;
    const q2 = M[5] === 1 && !p.km1;
    p.km1 = q1 && p.estop && p.rt1;
    p.km2 = q2 && p.estop && p.rt1;

    /* ── Planta ── */
    if (p.y1) p.A.dir = 1;
    if (p.y2) p.A.dir = -1;
    if (p.y3) p.B.dir = 1;
    if (p.y4) p.B.dir = -1;
    mover(p.A, p.A.dir, 0.75, h);
    mover(p.B, p.B.dir, 1.15, h);
    mover(p.C, p.y5 ? 1 : -1, p.y5 ? 0.38 : 0.6, h);

    const wObj = p.km1 ? 1 : p.km2 ? -1 : 0;
    p.w += (wObj - p.w) * (1 - Math.exp(-h / (wObj === 0 ? 0.06 : 0.12)));
    p.theta += p.w * 18 * h;

    const seat = asiento();
    if (p.km1 && seat) seat.fill = Math.min(1, seat.fill + h / TIEMPOS.dosif);
    if (p.km2) p.succion = Math.min(1, p.succion + h / TIEMPOS.rev);
    else if (p.km1) p.succion = Math.max(0, p.succion - h / 0.25);

    let salidaOcupada = false;
    for (const f of frascos) if (f.estado === 'salida' || f.estado === 'expulsion') salidaOcupada = true;
    const bandaObj = M[13] && p.estop && p.rt1 && (p.auto || salidaOcupada) ? VEL_BANDA : 0;
    p.vBanda += (bandaObj - p.vBanda) * (1 - Math.exp(-h / 0.3));
    if (bandaObj === 0 && p.vBanda < 1e-3) p.vBanda = 0;
    p.banda += p.vBanda * h;

    moverFrascos(h, c0);
  };

  /** Iniciar: si hace falta, pulsa RESET para el retorno a origen y después START. */
  p.iniciar = () => {
    if (p.estop && p.rt1) p.marchaPendiente = true;
  };
  /** STOP: el ciclo en curso termina y no se inicia otro. */
  p.parar = () => {
    p.stopPulso = true;
    p.marchaPendiente = false;
  };
  p.alternarEmergencia = () => {
    p.estop = !p.estop;
  };
  p.alternarTermico = () => {
    p.rt1 = !p.rt1;
  };
  /** Reiniciar: retira los frascos y lleva toda la planta a su estado inicial con movimiento continuo. */
  p.reiniciar = () => {
    M.fill(0);
    p.primerBarrido = true;
    p.auto = false;
    p.estop = true;
    p.rt1 = true;
    p.marchaPendiente = false;
    p.stopPulso = false;
    p.A.dir = -1;
    p.B.dir = -1;
    p.t3 = p.t4 = p.t5 = p.t8 = 0;
    p.tProx = 0;
    p.tCiclo = 0;
    p.ultimoCiclo = 0;
    p.ciclos = 0;
    p.terminados = 0;
    p.succion = 0;
    retirar(() => true);
  };

  p.sensores = sensores;
  p.etapa = () => {
    for (let i = 0; i < 10; i++) if (M[i]) return i;
    return -1;
  };
  p.estado = () => {
    if (!p.estop) return 'Paro de emergencia';
    if (!p.rt1) return 'Fallo térmico RT1';
    if (M[11] || M[12]) return 'Arranque: retorno a origen';
    if (M[13]) return p.auto ? 'Automático' : 'En espera';
    return 'Planta detenida';
  };
  /** Sin movimiento pendiente: la escena puede dejar de dibujar y no gastar GPU. */
  p.quieta = () =>
    p.A.v === 0 &&
    p.B.v === 0 &&
    p.C.v === 0 &&
    Math.abs(p.w) < 1e-3 &&
    p.vBanda === 0 &&
    frascos.every((f) => f.estado === 'libre' || f.estado === 'asiento');
  /** Resume el estado discreto en un entero: la interfaz solo se actualiza cuando cambia. */
  p.firma = () => {
    const s = sensores();
    let n = p.etapa() + 1;
    n = n * 16 + (M[10] ? 1 : M[11] ? 2 : M[12] ? 3 : M[13] ? 4 : 0);
    const bits = [
      s.a0,
      s.a1,
      s.b0,
      s.b1,
      s.c0,
      s.sFrasco,
      p.y1,
      p.y2,
      p.y3,
      p.y4,
      p.y5,
      p.km1,
      p.km2,
      p.auto,
      p.estop,
      p.rt1,
    ];
    return n * 65536 + bits.reduce((acc, b, i) => acc + (b ? 1 << i : 0), 0);
  };

  return p;
}
