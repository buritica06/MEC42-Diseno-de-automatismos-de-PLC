/**
 * Lógica de la estación automática de giro temporizado (sin dependencias de Three.js).
 *
 * Reproduce el programa del S7-1200 descrito en la guía (sección 5.2):
 *   - GS  (M30–M36): seguridad, parada de emergencia D1 y reposición temporizada A5/A6.
 *   - GL/GM (M20–M23): lubricación central de 3.0 s y memorización de MARCHA_MEM.
 *   - GP  (M0–M9, M7w, M8w): producción con divergencia y convergencia en Y.
 *
 * Cada llamada a paso() es un ciclo de scan de PASO segundos con el orden de un OB1:
 *   1) física de la planta → 2) lectura de sensores → 3) evolución Set/Reset → 4) salidas.
 *
 * La planta se modela con los actuadores reales (A … K). Como en el banco de cuatro
 * cilindros, A y C comparten la válvula Y1, B y D la Y2, E la Y3 y F … K la Y4.
 */
import { CARRERAS, TEMPORIZADORES, ETAPAS_GP, ETAPAS_GS } from '../../content/secuencia.js';

export const PASO = 0.005; // s por scan
export const N_CUNAS = 6;
export const PASO_ANGULAR = 360 / N_CUNAS; // 60° por indexación
/** Posiciones angulares fijas de la bancada (grados, antihorario desde +X). */
export const ESTACIONES = { carga: 210, p1: 270, p2: 330, p3: 30, espera: 90, descarga: 150 };
/** Estación de mecanizado → nivel de proceso que deja en la pieza. */
const MECANIZADO = [
  ['p1', 1], // F, G: taladrado vertical y horizontal
  ['p2', 2], // H, I: taladro de asiento
  ['p3', 3], // J, K: desbarbado
];
const N_PIEZAS = 12;
const V_CINTA1 = 1 / 2.0; // recorrido completo de la cinta 1 en 2.0 s
const V_CINTA2 = 1 / 2.6;
const PULSO = 0.12; // duración de un pulso de botón (s)
const EPS = 1e-9;

/** Curva de posición con amortiguación en los finales de carrera. */
export const suave = (u) => u * u * (3 - 2 * u);

/** Cilindro neumático: biestable (memoriza la última orden) o monoestable con resorte. */
function crearCilindro({ ext, ret }, monoestable = false) {
  return {
    u: 0,
    prev: 0,
    dir: -1,
    monoestable,
    mover() {
      this.prev = this.u;
      if (this.dir > 0 && this.u < 1) this.u = Math.min(1, this.u + PASO / ext);
      else if (this.dir < 0 && this.u > 0) this.u = Math.max(0, this.u - PASO / ret);
      if (this.u > 1 - EPS) this.u = 1;
      if (this.u < EPS) this.u = 0;
    },
    /** Bobina + o − de una válvula 5/2 biestable; ambas a 0 conserva el estado. */
    ordenar(mas, menos) {
      if (mas && !menos) this.dir = 1;
      else if (menos && !mas) this.dir = -1;
    },
    get atras() {
      return this.u === 0;
    },
    get adelante() {
      return this.u === 1;
    },
    get quieto() {
      return this.u === 0 || this.u === 1;
    },
  };
}

/** Temporizador TON de IEC 61131-3. */
function crearTON(pt) {
  return {
    et: 0,
    q: false,
    run(entrada) {
      this.et = entrada ? Math.min(pt, this.et + PASO) : 0;
      this.q = entrada && this.et >= pt - EPS;
      return this.q;
    },
  };
}

const norm = (a) => ((a % 360) + 360) % 360;

export function createPlanta({ precarga = true } = {}) {
  const p = {};

  function inicial() {
    p.t = 0;
    p.primerScan = true;
    // Marcas de etapa: GP (0–9 y '7w', '8w'), GL (20–23) y GS (30–36)
    p.M = {};
    // Actuadores (A=C, B=D, E, F…K comparten válvula; la cinemática es la misma)
    p.AC = crearCilindro(CARRERAS.AC);
    p.BD = crearCilindro(CARRERAS.BD);
    p.E = crearCilindro(CARRERAS.E);
    p.FK = crearCilindro(CARRERAS.FK, true);
    // Mesa revólver
    p.mesa = { ang: ESTACIONES.carga, prev: ESTACIONES.carga, inicioGiro: ESTACIONES.carga, girando: false };
    p.cunas = new Array(N_CUNAS).fill(-1); // índice de pieza o −1
    // Señales y memorias
    p.V = false; // V_SUCCION (remanente)
    p.estop = true; // seta: 1 = normal (NC)
    p.rtLub = true; // relé térmico: 1 = sano
    p.selAuto = true;
    p.botones = { MARCHA: 0, PARADA: 0, REPOS: 0, PULSO_MAN: 0 };
    p.marchaPendiente = false;
    p.salidas = { Y1p: 0, Y1m: 0, Y2p: 0, Y2m: 0, Y3p: 0, Y3m: 0, Y4: 0, YB: 0, KM_LUB: 0, H_MARCHA: 0 };
    p.T = Object.fromEntries(Object.entries(TEMPORIZADORES).map(([k, v]) => [k, crearTON(v)]));
    // Cintas y piezas
    p.cinta1 = { offset: 0, prev: 0, marcha: false };
    p.cinta2 = { offset: 0, prev: 0, marcha: false };
    p.piezas = Array.from({ length: N_PIEZAS }, (_, id) => ({
      id,
      estado: 'libre',
      s: 0,
      ps: 0,
      nivel: 0,
      escala: 0,
      pescala: 0,
      cuna: -1,
    }));
    // Indicadores
    p.ciclos = 0;
    p.terminadas = 0;
    p.inicioCiclo = null;
    p.ultimoCiclo = 0;
    p.aviso = '';
    p.indexado = false;

    // Estado inicial: una pieza bruta lista en la cinta 1 y (opcional) mesa en régimen
    colocarEnCinta1(1);
    if (precarga) {
      const niveles = { carga: 0, p1: 1, p2: 2, p3: 3, espera: 3, descarga: 3 };
      for (const [est, nivel] of Object.entries(niveles)) {
        const pz = libre();
        pz.estado = 'cuna';
        pz.nivel = nivel;
        pz.escala = pz.pescala = 1;
        pz.cuna = cunaEn(ESTACIONES[est]);
        p.cunas[pz.cuna] = pz.id;
      }
    }
  }

  /* ───────────── Piezas ───────────── */
  const libre = () => p.piezas.find((x) => x.estado === 'libre');
  function cunaEn(grados) {
    const k = Math.round(norm(grados - p.mesa.ang) / PASO_ANGULAR) % N_CUNAS;
    return k;
  }
  function colocarEnCinta1(s = 0) {
    const pz = libre();
    if (!pz) return;
    pz.estado = s >= 1 ? 'espera' : 'cinta1';
    pz.s = pz.ps = s;
    pz.nivel = 0;
    pz.escala = pz.pescala = 1;
  }
  const piezaEn = (estado) => p.piezas.find((x) => x.estado === estado);

  /** Flanco de V_SUCCION: las ventosas toman o sueltan según dónde estén los carros. */
  function tomarPiezas() {
    if (!p.AC.adelante) return;
    // Transporte 1: toma en el final de la cinta 1
    if (p.BD.atras) {
      const pz = piezaEn('espera');
      if (pz) pz.estado = 'A';
    }
    // Transporte 2: toma en la cuna de descarga
    if (p.BD.atras) {
      const k = cunaEn(ESTACIONES.descarga);
      const id = p.cunas[k];
      if (id >= 0) {
        p.cunas[k] = -1;
        const pz = p.piezas[id];
        pz.estado = 'C';
        pz.cuna = -1;
      }
    }
  }

  function soltarPiezas() {
    const enA = piezaEn('A');
    const enC = piezaEn('C');
    if (enA) {
      if (p.BD.adelante) {
        const k = cunaEn(ESTACIONES.carga);
        if (p.cunas[k] >= 0) retirar(p.piezas[p.cunas[k]], 'Cuna de carga ocupada: pieza retirada');
        p.cunas[k] = enA.id;
        enA.estado = 'cuna';
        enA.cuna = k;
      } else {
        enA.estado = 'espera'; // reposición: vuelve al final de la cinta 1
        enA.s = enA.ps = 1;
      }
    }
    if (enC) {
      if (p.BD.adelante) {
        enC.estado = 'cinta2';
        enC.s = enC.ps = 0;
        p.terminadas += 1;
      } else {
        const k = cunaEn(ESTACIONES.descarga);
        if (p.cunas[k] >= 0) {
          // Tras un giro completado durante la emergencia la cuna de descarga ya trae otra pieza.
          retirar(enC, 'Cuna de descarga ocupada tras el giro: el operario retira la pieza retenida');
        } else {
          p.cunas[k] = enC.id;
          enC.estado = 'cuna';
          enC.cuna = k;
        }
      }
    }
  }

  function retirar(pz, motivo) {
    if (pz.cuna >= 0 && p.cunas[pz.cuna] === pz.id) p.cunas[pz.cuna] = -1;
    pz.estado = 'retirada';
    pz.cuna = -1;
    p.aviso = motivo;
  }

  /* ───────────── 1) Física ───────────── */
  function fisica() {
    p.AC.mover();
    p.BD.mover();
    p.FK.mover();
    // Giro: el trinquete de E arrastra la mesa solo en la carrera de avance.
    const eAntes = p.E.u;
    p.E.mover();
    p.mesa.prev = p.mesa.ang;
    if (p.E.dir > 0 && p.E.u > eAntes) {
      if (!p.mesa.girando) {
        p.mesa.girando = true;
        p.mesa.inicioGiro = p.mesa.ang;
      }
      p.mesa.ang = p.mesa.inicioGiro + PASO_ANGULAR * suave(p.E.u);
      if (p.E.adelante) {
        p.mesa.ang = p.mesa.inicioGiro + PASO_ANGULAR;
        p.mesa.girando = false;
        p.indexado = true;
      }
    }

    // Cintas y piezas sueltas
    const falla = !p.estop || !p.rtLub;
    const marchaMem = Boolean(p.M[22]);
    const hayEnCinta1 = p.piezas.some((x) => x.estado === 'cinta1' || x.estado === 'espera');
    // Alimentación: solo con marcha memorizada y con el transporte 1 libre de pieza.
    if (marchaMem && !falla && !p.V && !hayEnCinta1) colocarEnCinta1(0);
    p.cinta1.marcha = !falla && p.piezas.some((x) => x.estado === 'cinta1');
    p.cinta2.marcha = !falla && p.piezas.some((x) => x.estado === 'cinta2');
    p.cinta1.prev = p.cinta1.offset;
    p.cinta2.prev = p.cinta2.offset;
    if (p.cinta1.marcha) p.cinta1.offset += PASO * V_CINTA1;
    if (p.cinta2.marcha) p.cinta2.offset += PASO * V_CINTA2;

    for (const pz of p.piezas) {
      pz.ps = pz.s;
      pz.pescala = pz.escala;
      if (pz.estado === 'cinta1' && p.cinta1.marcha) {
        pz.s = Math.min(1, pz.s + PASO * V_CINTA1);
        if (pz.s >= 1) pz.estado = 'espera';
      } else if (pz.estado === 'cinta2' && p.cinta2.marcha) {
        pz.s = Math.min(1, pz.s + PASO * V_CINTA2);
        if (pz.s >= 1) pz.estado = 'saliendo';
      } else if (pz.estado === 'saliendo' || pz.estado === 'retirada') {
        pz.escala = Math.max(0, pz.escala - PASO * 2.5);
        if (pz.escala === 0) {
          pz.estado = 'libre';
          pz.s = pz.ps = 0;
        }
      }
    }
  }

  /* ───────────── 2) Sensores ───────────── */
  function sensores() {
    return {
      B1: p.AC.atras, // S1 · S5
      B2: p.AC.adelante, // S2 · S6
      B3: p.BD.atras, // S3 · S7
      B4: p.BD.adelante, // S4 · S8
      S1: p.E.atras, // S9: mesa bloqueada
      S2: p.E.adelante, // S10: mesa indexada
      S3: p.FK.atras, // S11 … S21
      B5: p.FK.adelante, // S12 … S22
      S_CINTA1: Boolean(piezaEn('espera')),
    };
  }

  /* ───────────── 3) Evolución (Set/Reset con prioridad al Reset) ───────────── */
  function evolucionar(s) {
    const M = p.M;
    const b = p.botones;
    const MARCHA = b.MARCHA > 0;
    const PARADA = !(b.PARADA > 0); // NC: 1 = sin paro
    const REPOS = b.REPOS > 0;
    const falla = !p.estop || !p.rtLub;
    const mHab = p.selAuto || b.PULSO_MAN > 0;
    const quietos = p.AC.quieto && p.E.quieto;
    const T = p.T;
    const nuevo = {};
    const set = (k, cond) => cond && (nuevo[k] = true);
    const on = (k) => Boolean(M[k]);

    // Temporizadores (leen la imagen de etapas del scan anterior)
    T.lub.run(on(21));
    T.vac.run(on(2));
    T.lib.run(on(6));
    T.sinc.run(on('7w') && on('8w'));
    T.rep1.run(on(31) && s.B1 && s.S1 && s.S3);
    T.rep2.run(on(32) && s.B3);
    T.rel34.run(on('34r'));

    /* GS */
    const enGS = on(31) || on(32) || on(33) || on('34b') || on('34r') || on('34s') || on(36);
    const setM30 = p.primerScan || (falla && enGS);
    const setM31 = on(30) && !falla && REPOS && quietos;
    const setM32 = on(31) && T.rep1.q;
    const setM33 = on(32) && T.rep2.q && p.V;
    const set34b = on(33) && MARCHA;
    const set34r = on('34b') && s.B2;
    const set34s = on('34r') && T.rel34.q;
    const setM35 = ((on(32) && T.rep2.q) || (on('34s') && s.B1)) && !p.V;
    const setM36 = on(35);

    /* GL / GM */
    const setM20 = p.primerScan || (on(23) && (on(0) || !on(36))) || (on(21) && !on(36));
    const setM21 = on(20) && MARCHA && PARADA && on(36);
    const setM22 = on(21) && T.lub.q;
    const setM23 = on(22) && (!PARADA || !on(36));

    /* GP */
    const rGP = on(30) || on(31) || on(32) || on(33) || on('34b') || on('34r') || on('34s') || setM30;
    const setM0 = (on(9) && s.S3 && s.B3) || on(35);
    const setM1 = on(0) && on(22) && s.S_CINTA1 && s.B1 && s.B3 && s.S1 && s.S3 && mHab;
    const setM2 = on(1) && s.B2;
    const setM3 = on(2) && T.vac.q;
    const setM4 = on(3) && s.B1;
    const setM5 = on(4) && s.S2 && s.B4;
    const setM6 = on(5) && s.S1 && s.B2;
    const setM7 = on(6) && T.lib.q;
    const setM7w = on(7) && s.B1;
    const setM8w = on(8) && s.B5;
    const setM9 = on('7w') && on('8w') && T.sinc.q;

    // Activación de etapas siguientes y desactivación de las precedentes
    const reglas = [
      // [etapa, set, reset]
      [30, setM30, setM31],
      [31, setM31, setM32 || setM30],
      [32, setM32, setM33 || setM35 || setM30],
      [33, setM33, set34b || setM30],
      ['34b', set34b, set34r || setM30],
      ['34r', set34r, set34s || setM30],
      ['34s', set34s, setM35 || setM30],
      [35, setM35, setM36],
      [36, setM36, setM30],
      [20, setM20, setM21],
      [21, setM21, setM22 || setM20],
      [22, setM22, setM23],
      [23, setM23, setM20],
      [0, setM0, setM1 || rGP],
      [1, setM1, setM2 || rGP],
      [2, setM2, setM3 || rGP],
      [3, setM3, setM4 || rGP],
      [4, setM4, setM5 || rGP],
      [5, setM5, setM6 || rGP],
      [6, setM6, setM7 || rGP], // Reset(M6) = M7 · M8: ambas ramas se activan juntas
      [7, setM7, setM7w || rGP],
      ['7w', setM7w, setM9 || rGP],
      [8, setM7, setM8w || rGP],
      ['8w', setM8w, setM9 || rGP],
      [9, setM9, setM0 || rGP],
    ];
    const finCiclo = setM0 && on(9); // se lee antes de aplicar los Reset de este scan
    for (const [k, st, rs] of reglas) {
      set(k, st);
      if (rs) nuevo[k] = false; // prioridad al Reset
    }
    for (const [k, v] of Object.entries(nuevo)) M[k] = v;

    // Memoria remanente de ventosas
    const vAntes = p.V;
    if (on(2)) p.V = true;
    if (on(6) || on('34r')) p.V = false;
    if (!vAntes && p.V) tomarPiezas();
    if (vAntes && !p.V) soltarPiezas();

    // Métricas de ciclo
    if (setM1) {
      p.inicioCiclo = p.t;
      p.indexado = false;
      p.aviso = '';
    }
    if (finCiclo) {
      p.ciclos += 1;
      if (p.inicioCiclo != null) p.ultimoCiclo = p.t - p.inicioCiclo;
    }
    // Mecanizado: al alcanzar el fondo (B5) cada estación deja su huella en la pieza.
    if (setM8w) {
      for (const [est, nivel] of MECANIZADO) {
        const id = p.cunas[cunaEn(ESTACIONES[est])];
        if (id >= 0) p.piezas[id].nivel = Math.max(p.piezas[id].nivel, nivel);
      }
    }
    p.primerScan = false;
  }

  /* ───────────── 4) Salidas (sin doble bobina) ───────────── */
  function salidas(s) {
    const on = (k) => Boolean(p.M[k]);
    const q = p.salidas;
    q.Y1p = on(1) || on(5) || on('34b');
    q.Y1m = on(3) || on(7) || on(31) || on('34s');
    q.Y2p = on(4);
    q.Y2m = on(9) || on(32) || (on(30) && s.B1);
    q.Y3p = on(4);
    q.Y3m = on(5) || on(31);
    q.Y4 = on(8) || on('8w');
    q.YB = on(8) || on('8w') || on(9);
    q.KM_LUB = on(21) && p.rtLub;
    q.H_MARCHA = on(22);
    p.AC.ordenar(q.Y1p, q.Y1m);
    p.BD.ordenar(q.Y2p, q.Y2m);
    p.E.ordenar(q.Y3p, q.Y3m);
    p.FK.dir = q.Y4 ? 1 : -1; // monoestable 3/2: sin señal, retorno por resorte
  }

  function botonesYPendientes() {
    for (const k of Object.keys(p.botones)) p.botones[k] = Math.max(0, p.botones[k] - PASO);
    if (!p.marchaPendiente) return;
    const M = p.M;
    if (M[21] || M[22]) p.marchaPendiente = false;
    else if (M[30] && p.botones.REPOS === 0)
      p.botones.REPOS = PULSO; // espera a que A, C y E terminen
    else if ((M[33] || (M[36] && M[20])) && p.botones.MARCHA === 0) p.botones.MARCHA = PULSO;
  }

  inicial();

  /* ───────────── API ───────────── */
  Object.assign(p, {
    paso() {
      p.t += PASO;
      fisica();
      const s = sensores();
      evolucionar(s);
      salidas(s);
      botonesYPendientes();
    },
    sensores,
    pulsar(boton) {
      if (boton in p.botones) p.botones[boton] = PULSO;
    },
    /** MARCHA del operador: tras energizar o tras una emergencia ejecuta antes la reposición. */
    iniciar() {
      if (!p.estop || !p.rtLub) return;
      if (p.M[30]) {
        p.pulsar('REPOS');
        p.marchaPendiente = true;
      } else if (p.M[33]) {
        p.pulsar('MARCHA');
        p.marchaPendiente = true;
      } else if (p.M[22] && !p.selAuto) {
        p.pulsar('PULSO_MAN');
      } else {
        p.pulsar('MARCHA');
      }
    },
    parar() {
      p.marchaPendiente = false;
      p.pulsar('PARADA');
    },
    alternarEmergencia() {
      p.estop = !p.estop;
      p.marchaPendiente = false;
    },
    alternarTermico() {
      p.rtLub = !p.rtLub;
      p.marchaPendiente = false;
    },
    setModo(auto) {
      p.selAuto = Boolean(auto);
    },
    reiniciar(opts) {
      if (opts && 'precarga' in opts) precarga = opts.precarga;
      inicial();
    },
    cunaEn,
    /** Etapa activa de GP (las de la rama en Y se informan juntas). */
    etapasGP() {
      const act = [];
      for (const k of [0, 1, 2, 3, 4, 5, 6, 7, '7w', 8, '8w', 9]) if (p.M[k]) act.push(String(k));
      return act;
    },
    etapaGS() {
      for (const k of [30, 31, 32, 33, '34b', '34r', '34s', 35, 36]) if (p.M[k]) return String(k);
      return '';
    },
    etapaGL() {
      for (const k of [20, 21, 22, 23]) if (p.M[k]) return k;
      return null;
    },
    /** Intervalo del diagrama espacio-fase (0 … 5) en curso, o −1. */
    fase() {
      for (const k of [9, 8, '8w', 7, '7w', 6, 5, 4, 3, 2, 1]) {
        if (!p.M[k]) continue;
        const base = String(k).replace('w', '');
        return ETAPAS_GP[base]?.fase ?? -1;
      }
      return -1;
    },
    accion() {
      const gs = p.etapaGS();
      if (gs && gs !== '36') return ETAPAS_GS[parseInt(gs, 10)];
      if (p.M[21]) return 'GL 21: lubricación central M_LUB';
      const gp = p.etapasGP();
      if (!gp.length) return 'Sin etapa activa';
      if (gp.length > 1) return `Paralelismo en Y: etapas ${gp.join(' ∥ ')}`;
      const k = gp[0];
      if (k === '0') return p.M[22] ? ETAPAS_GP[0].accion : 'Reposo: pulse MARCHA';
      return ETAPAS_GP[k.replace('w', '')].accion;
    },
    estado() {
      const M = p.M;
      if (!p.estop) return 'Emergencia (D1)';
      if (!p.rtLub) return 'Falla térmica RT_LUB';
      if (M[30]) return 'Parada · pendiente reposición';
      if (M[31] || M[32] || M[33] || M['34b'] || M['34r'] || M['34s'] || M[35]) return 'Reposición (A5/A6)';
      if (M[21]) return 'Lubricación central';
      if (M[22]) return p.selAuto ? 'Producción automática (F1)' : 'Producción manual';
      if (M[23]) return 'Parada a fin de ciclo (A2)';
      return 'Detenida (A1)';
    },
    /** Firma del estado discreto: cambia solo cuando hay que repintar LED o paneles. */
    firma() {
      const M = p.M;
      let f = '';
      for (const k of Object.keys(M)) if (M[k]) f += `${k},`;
      const s = sensores();
      for (const k of Object.keys(s)) f += s[k] ? '1' : '0';
      for (const k of Object.keys(p.salidas)) f += p.salidas[k] ? '1' : '0';
      return `${f}|${p.V}|${p.estop}|${p.rtLub}|${p.selAuto}|${p.terminadas}|${p.aviso}`;
    },
    /** Sin ningún movimiento pendiente: el render puede dormir. */
    quieta() {
      const cil = [p.AC, p.BD, p.E, p.FK].every((c) => c.u === c.prev && c.quieto);
      const piezas = p.piezas.every((x) => x.s === x.ps && x.escala === x.pescala);
      return cil && piezas && !p.cinta1.marcha && !p.cinta2.marcha && !p.M[21];
    },
  });
  return p;
}
