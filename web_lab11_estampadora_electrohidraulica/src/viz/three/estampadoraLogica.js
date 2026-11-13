/**
 * Lógica de la estampadora electrohidráulica (Semana 11), sin dependencias de Three.js.
 *
 * Reproduce los dos GRAFCET de la guía (IEC 60848):
 *   GP (producción): etapas 0 a 7.   GS (seguridad): etapas 10, 11 y 12.
 * y un modelo sencillo de la planta: cilindros A, B y C, motor D con volante,
 * presión de sujeción (presostato B7), guarda frontal y pieza.
 *
 * Avanza con un barrido fijo de 5 ms, igual que un PLC: el resultado no depende
 * de los FPS. No crea objetos durante el barrido (sin pausas del recolector).
 */
export const PASO = 0.005;
export const T1 = 3; // s, tiempo de estampado
export const GOLPES_POR_S = 2; // cadencia visual del troquel
export const P_NOMINAL = 100; // bar, red de alta presión (cilindro A)
export const P_REDUCIDA = 40; // bar, red reducida (B, C y D)
export const P_UMBRAL_B7 = 85; // bar, conmutación del presostato

/** Geometría compartida con la escena (unidades de escena). */
export const GEOMETRIA = {
  carreraA: 0.45,
  carreraB: 2.6,
  carreraC: 1.2,
  holguraC: 0.3, // recorrido en vacío del expulsor antes de tocar la pieza
  excentrica: 0.3, // radio de la muñequilla: carrera del troquel = 2·e
  biela: 1.9,
};

export const ETAPAS = [
  { n: 0, accion: 'Reposo en origen', salidas: '—', transicion: 'S1 · B1 · B3 · B5 · GUARDA' },
  { n: 1, accion: 'A+ : sujeción de la pieza', salidas: 'Y1', transicion: 'B2 · B7' },
  { n: 2, accion: 'B+ : avance del carro', salidas: 'Y1, Y2', transicion: 'B4' },
  { n: 3, accion: 'D : estampado durante t1', salidas: 'Y1, Y6', transicion: 't1 = 3 s / X3' },
  { n: 4, accion: 'B− : retroceso del carro', salidas: 'Y1, Y3', transicion: 'B3' },
  { n: 5, accion: 'A− : apertura por muelle', salidas: '—', transicion: 'B1' },
  { n: 6, accion: 'C+ : ascenso del expulsor', salidas: 'Y4', transicion: 'B6' },
  { n: 7, accion: 'C− : descenso del expulsor', salidas: 'Y5', transicion: 'B5' },
];

const DOS_PI = Math.PI * 2;
const crearEje = () => ({ x: 0, prev: 0, v: 0 });

/**
 * Movimiento con aceleración y amortiguación de fin de carrera (sin saltos de velocidad).
 * dir = 0 modela el centro cerrado de la válvula 4/3: el eje frena y queda bloqueado.
 */
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
  const X = new Uint8Array(8); // GP
  const G = new Uint8Array(3); // GS: 10, 11, 12

  const p = {
    X,
    G,
    A: crearEje(),
    B: crearEje(),
    C: crearEje(),
    dirC: -1, // memoria de la válvula biestable
    y1: false,
    y2: false,
    y3: false,
    y4: false,
    y5: false,
    y6: false,
    // Mando
    estop: true, // S0 es NC: true = no pulsado
    s1: false,
    s2: false,
    marchaPendiente: false,
    rearmePendiente: false,
    continuo: true,
    // Guarda frontal (0 = cerrada, 1 = abierta)
    guardaAbrir: false,
    guarda: 0,
    pguarda: 0,
    // Fallas didácticas
    fallaB7: false, // fuga: la presión de sujeción no alcanza el umbral
    atascoB: false, // el carro se traba entre B3 y B4
    // Planta
    pA: 0,
    ppA: 0,
    w: 0,
    theta: 0,
    ptheta: 0,
    flash: 0,
    pflash: 0,
    t1: 0,
    golpes: 0,
    pieza: { estado: 'lista', escala: 1, pescala: 1, u: 0, pu: 0, marca: 0, pmarca: 0 },
    tCarga: 0,
    // Contadores
    piezas: 0,
    ciclos: 0,
    tCiclo: 0,
    ultimoCiclo: 0,
  };
  X[0] = 1;
  G[0] = 1;

  const sensores = () => ({
    B1: p.A.x <= 0.01,
    B2: p.A.x >= 0.99,
    B3: p.B.x <= 0.01,
    B4: p.B.x >= 0.99,
    B5: p.C.x <= 0.01,
    B6: p.C.x >= 0.99,
    B7: p.pA > P_UMBRAL_B7,
    guardaOk: p.guarda <= 0.01,
  });

  /** Un barrido del PLC seguido de un paso de la planta. */
  p.paso = function paso() {
    const h = PASO;
    const pz = p.pieza;
    p.A.prev = p.A.x;
    p.B.prev = p.B.x;
    p.C.prev = p.C.x;
    p.ppA = p.pA;
    p.ptheta = p.theta;
    p.pflash = p.flash;
    p.pguarda = p.guarda;
    pz.pescala = pz.escala;
    pz.pu = pz.u;
    pz.pmarca = pz.marca;

    /* ── Entradas ── */
    const B1 = p.A.x <= 0.01;
    const B2 = p.A.x >= 0.99;
    const B3 = p.B.x <= 0.01;
    const B4 = p.B.x >= 0.99;
    const B5 = p.C.x <= 0.01;
    const B6 = p.C.x >= 0.99;
    const B7 = p.pA > P_UMBRAL_B7;
    const guardaOk = p.guarda <= 0.01;
    const origen = B1 && B3 && B5;
    const piezaLista = pz.estado === 'lista' && pz.escala >= 1;
    // El operario pulsa S1 cuando la pieza ya está cargada en el dispositivo.
    p.s1 = p.marchaPendiente && piezaLista && X[0] === 1;
    p.s2 = p.rearmePendiente && p.estop && G[1] === 1 && origen;

    /* ── GRAFCET de seguridad (GS) ── */
    const g10 = G[0];
    const g11 = G[1];
    const g12 = G[2];
    if (g10 && !p.estop) {
      G[0] = 0;
      G[1] = 1;
    }
    if (g11 && p.s2) {
      G[1] = 0;
      G[2] = 1;
      p.rearmePendiente = false;
    }
    if (g12) {
      G[2] = 0;
      G[0] = 1;
    }
    if (!p.estop) p.rearmePendiente = false;

    /* ── GRAFCET de producción (GP) ── */
    const inicio = X[0] && p.s1 && origen && guardaOk;
    const fin = X[7] && B5;
    if (G[1]) {
      X.fill(0); // F/GP:{ }
      p.marchaPendiente = false;
    } else if (g12) {
      X.fill(0); // F/GP:{0}
      X[0] = 1;
    } else {
      const t12 = X[1] && B2 && B7;
      const t23 = X[2] && B4;
      const t34 = X[3] && p.t1 >= T1;
      const t45 = X[4] && B3;
      const t56 = X[5] && B1;
      const t67 = X[6] && B6;
      if (inicio) ((X[0] = 0), (X[1] = 1));
      if (t12) ((X[1] = 0), (X[2] = 1));
      if (t23) ((X[2] = 0), (X[3] = 1));
      if (t34) ((X[3] = 0), (X[4] = 1));
      if (t45) ((X[4] = 0), (X[5] = 1));
      if (t56) ((X[5] = 0), (X[6] = 1));
      if (t67) ((X[6] = 0), (X[7] = 1));
      if (fin) ((X[7] = 0), (X[0] = 1));
      if (inicio) {
        p.marchaPendiente = false;
        p.tCiclo = 0;
        p.golpes = 0;
      }
      if (fin) {
        p.ciclos += 1;
        p.ultimoCiclo = p.tCiclo;
        if (p.continuo) p.marchaPendiente = true;
      }
    }
    p.t1 = X[3] ? p.t1 + h : 0;
    p.tCiclo += h;

    /* ── Salidas (acciones continuas; la etapa 11 fuerza Y3 e Y5) ── */
    const em = G[1] === 1;
    p.y1 = (X[1] || X[2] || X[3] || X[4]) === 1;
    p.y2 = X[2] === 1;
    p.y3 = X[4] === 1 || em;
    p.y4 = X[6] === 1;
    p.y5 = X[7] === 1 || em;
    p.y6 = X[3] === 1;

    /* ── Planta ── */
    // A: 4/2 monoestable (el muelle abre la mordaza). La presión solo sube con la pieza apretada.
    mover(p.A, p.y1 ? 1 : -1, 0.8, h);
    const pObj = p.y1 ? (p.A.x >= 0.99 ? (p.fallaB7 ? 62 : P_NOMINAL) : 14) : 0;
    p.pA += (pObj - p.pA) * (1 - Math.exp(-h / (p.y1 ? 0.11 : 0.07)));
    if (Math.abs(pObj - p.pA) < 0.05) p.pA = pObj;

    // B: 4/3 de centro cerrado (sin señal queda bloqueado).
    let dirB = p.y2 ? 1 : p.y3 ? -1 : 0;
    if (p.atascoB && dirB > 0 && p.B.x >= 0.55) dirB = 0;
    mover(p.B, dirB, 1.5, h);

    // C: 4/2 biestable (memoriza el último pulso).
    if (p.y4) p.dirC = 1;
    if (p.y5) p.dirC = -1;
    mover(p.C, p.dirC, 0.85, h);

    // D: motor con volante. Al cortar Y6 la contrapresión lo frena hasta el punto muerto superior.
    const thetaPrev = p.theta;
    if (p.y6) {
      p.w = Math.min(1, p.w + h / 0.25);
    } else if (p.w > 0) {
      const resto = Math.ceil(p.theta / DOS_PI - 1e-6) * DOS_PI - p.theta;
      p.w = Math.max(Math.min(p.w, 0.16 + resto * 0.5), 0.16);
      if (resto <= p.w * GOLPES_POR_S * DOS_PI * h) {
        p.theta += resto;
        p.w = 0;
      }
    }
    p.theta += p.w * GOLPES_POR_S * DOS_PI * h;
    // Golpe: el troquel pasa por el punto muerto inferior (θ = π + 2πk).
    if (Math.floor((p.theta - Math.PI) / DOS_PI) > Math.floor((thetaPrev - Math.PI) / DOS_PI)) {
      p.golpes += 1;
      p.flash = 1;
      if (pz.estado === 'lista' && B4) pz.marca = Math.min(1, pz.marca + 0.2);
    } else {
      p.flash = Math.max(0, p.flash - h / 0.16);
    }

    // Guarda con enclavamiento: solo se puede mover con GP en reposo o vacío.
    const guardaLibre = X[0] === 1 || em;
    if (guardaLibre) p.guarda = Math.max(0, Math.min(1, p.guarda + (p.guardaAbrir ? h : -h) / 0.6));

    // Pieza: carga en reposo, expulsión por la rampa al llegar C a su cota superior.
    if (pz.estado === 'ninguna') {
      if (X[0] && B3 && B5) {
        p.tCarga += h;
        if (p.tCarga >= 0.45) {
          pz.estado = 'lista';
          pz.escala = 0;
          pz.marca = 0;
          pz.u = 0;
        }
      }
    } else if (pz.estado === 'lista') {
      if (pz.escala < 1) pz.escala = Math.min(1, pz.escala + h / 0.3);
      if (B6 && B3 && p.dirC > 0) {
        pz.estado = 'salida';
        pz.u = 0;
      }
    } else {
      pz.u = Math.min(1, pz.u + h / 1.15);
      if (pz.u >= 1) {
        pz.estado = 'ninguna';
        pz.escala = 0;
        p.piezas += 1;
        p.tCarga = 0;
      }
    }
  };

  /* ── Órdenes del operario ── */
  p.marcha = () => {
    if (G[0]) p.marchaPendiente = true;
  };
  p.alternarEmergencia = () => {
    p.estop = !p.estop;
  };
  p.rearme = () => {
    if (p.estop && G[1]) p.rearmePendiente = true;
  };
  p.alternarGuarda = () => {
    if (X[0] || G[1]) p.guardaAbrir = !p.guardaAbrir;
  };
  p.reiniciar = () => {
    X.fill(0);
    G.fill(0);
    X[0] = 1;
    G[0] = 1;
    p.estop = true;
    p.marchaPendiente = false;
    p.rearmePendiente = false;
    p.guardaAbrir = false;
    p.dirC = -1;
    p.t1 = 0;
    p.golpes = 0;
    p.piezas = 0;
    p.ciclos = 0;
    p.tCiclo = 0;
    p.ultimoCiclo = 0;
    p.tCarga = 0;
    if (p.pieza.estado !== 'lista') {
      p.pieza.estado = 'ninguna';
      p.pieza.escala = 0;
    }
    p.pieza.marca = 0;
  };

  /* ── Consultas ── */
  p.sensores = sensores;
  p.etapa = () => {
    for (let i = 0; i < 8; i++) if (X[i]) return i;
    return -1;
  };
  p.etapaGS = () => (G[0] ? 10 : G[1] ? 11 : 12);
  p.estado = () => {
    if (!p.estop) return 'Paro de emergencia';
    if (G[1]) return 'Emergencia: esperando rearme S2';
    if (X[0]) return p.marchaPendiente ? 'Esperando condiciones de inicio' : 'Reposo en origen';
    return 'Ciclo automático';
  };
  /** Sin movimiento pendiente: la escena puede dejar de dibujar y no gastar GPU. */
  p.quieta = () =>
    p.A.v === 0 &&
    p.B.v === 0 &&
    p.C.v === 0 &&
    p.w === 0 &&
    p.flash === 0 &&
    p.pA === p.ppA &&
    p.guarda === p.pguarda &&
    p.pieza.estado === 'lista' &&
    p.pieza.escala === 1 &&
    !p.marchaPendiente;
  /** Resume el estado discreto en un entero: la interfaz solo se actualiza cuando cambia. */
  p.firma = () => {
    const s = sensores();
    const bits = [
      s.B1,
      s.B2,
      s.B3,
      s.B4,
      s.B5,
      s.B6,
      s.B7,
      s.guardaOk,
      p.y1,
      p.y2,
      p.y3,
      p.y4,
      p.y5,
      p.y6,
      p.estop,
      p.marchaPendiente,
      p.rearmePendiente,
    ];
    let n = (p.etapa() + 1) * 4 + (G[0] ? 0 : G[1] ? 1 : 2);
    n = n * 64 + (p.golpes % 64);
    return n * 131072 + bits.reduce((acc, b, i) => acc + (b ? 1 << i : 0), 0) + p.piezas * 1e9;
  };

  return p;
}

/**
 * Ejecuta un ciclo completo sin interfaz y devuelve la duración real de cada etapa.
 * Lo usan el diagrama de fases y las pruebas.
 * @returns {{ etapa: number, inicio: number, fin: number }[]}
 */
export function medirCiclo() {
  const p = createPlanta();
  p.continuo = false;
  p.marcha();
  const tramos = [];
  let actual = 0;
  let t0 = 0;
  for (let i = 0; i < 20000; i++) {
    p.paso();
    const e = p.etapa();
    const t = (i + 1) * PASO;
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
