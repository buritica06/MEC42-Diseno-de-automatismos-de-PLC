/**
 * Plano de situación (lámina 1) en 3D: estación de control de peso y clasificación.
 *
 * Disposición idéntica a la del plano isométrico y la vista en planta de la guía
 * (mismas cotas que estacionPesoLogica.js, eje z hacia arriba):
 *  - Alimentador de rodillos con almacén por el lado −y; centro de transferencia en la carcasa.
 *  - Cilindro A (doble efecto, 5/2 biestable Y1/Y2): empuja la pieza según +x hasta la báscula.
 *  - Báscula con indicador digital y tendencia del peso; bloqueo por el pasador del cilindro B
 *    (doble efecto, 5/2 monoestable Y3, extendido en reposo: B4 = 1).
 *  - Cilindro C (doble efecto, 5/2 monoestable Y4): empujador en U que devuelve la pieza OK a la línea.
 *  - Cilindro D (simple efecto, 3/2 NC Y5): placa de empuje hacia la canaleta y el contenedor NOK.
 *  - Cinta H1 según +y con fotocélula S5 y contenedor de piezas buenas.
 *  - Cada cilindro lleva dos mordazas de sujeción (soporte de brida) y tuercas hexagonales.
 *  - Armario S7-1200 (CPU 1214C DC/DC/DC) con LED de E/S, baliza y botonera S0 / S6.
 *
 * Rendimiento:
 *  - Lo estático se fusiona en una malla por material (crearLote) y los LED son un InstancedMesh.
 *  - La planta avanza con barridos fijos de 5 ms; la escena interpola entre barridos (delta time).
 *  - El indicador de la báscula se redibuja como máximo a 15 Hz y solo si cambia.
 */
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFShadowMap,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  RepeatWrapping,
  ShadowMaterial,
  SphereGeometry,
  SRGBColorSpace,
  BoxGeometry,
  Vector3,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createStage } from './three-utils.js';
import { bloque, cilindro, crearLote, v3 } from './geometria.js';
import {
  createPlanta,
  ETAPAS,
  GEO,
  N_PIEZAS,
  P,
  PASO,
  PESO_NOMINAL,
  T1,
  T2,
  TOLERANCIA,
} from './estacionPesoLogica.js';

export const defaults = {
  velocidad: 1,
  modoTolerancia: 'aleatorio',
  cableS6Roto: false,
  sinTension: false,
  fallaA: false,
  fallaB: false,
  fallaC: false,
  fallaD: false,
  fallaS5: false,
  etiquetas: true,
  autoInicio: true,
};

export const controls = [
  { label: 'S0: marcha', type: 'button', folder: 'Ciclo', action: (p) => p.acciones?.marcha() },
  { label: 'S6: paro de fin de ciclo (alterna)', type: 'button', folder: 'Ciclo', action: (p) => p.acciones?.paro() },
  { label: 'Pausar / reanudar simulación', type: 'button', folder: 'Ciclo', action: (p) => p.acciones?.pausar() },
  { label: 'Reiniciar estación', type: 'button', folder: 'Ciclo', action: (p) => p.acciones?.reiniciar() },
  { label: 'Reset_Conteo (%M10.0)', type: 'button', folder: 'Ciclo', action: (p) => p.acciones?.resetConteo() },
  {
    key: 'modoTolerancia',
    label: 'Señal S4',
    type: 'select',
    options: {
      'Báscula simulada (70 % OK / 30 % NOK)': 'aleatorio',
      'Conmutador S4 = 1 (pieza OK)': 'ok',
      'Conmutador S4 = 0 (pieza NOK)': 'nok',
    },
    folder: 'Báscula y tolerancia',
  },
  { key: 'cableS6Roto', label: 'Rotura del cable de S6 (NC)', type: 'boolean', folder: 'Pruebas y fallas' },
  { key: 'sinTension', label: 'Corte de tensión de mando', type: 'boolean', folder: 'Pruebas y fallas' },
  { key: 'fallaA', label: 'Atasco del cilindro A', type: 'boolean', folder: 'Pruebas y fallas' },
  { key: 'fallaB', label: 'Atasco del cilindro B', type: 'boolean', folder: 'Pruebas y fallas' },
  { key: 'fallaC', label: 'Atasco del cilindro C', type: 'boolean', folder: 'Pruebas y fallas' },
  { key: 'fallaD', label: 'Atasco del cilindro D', type: 'boolean', folder: 'Pruebas y fallas' },
  { key: 'fallaS5', label: 'Falla de la fotocélula S5', type: 'boolean', folder: 'Pruebas y fallas' },
  { label: 'Reconocer alarma', type: 'button', folder: 'Pruebas y fallas', action: (p) => p.acciones?.reconocer() },
  { key: 'velocidad', label: 'Velocidad', min: 0.25, max: 3, step: 0.25, unit: '×', folder: 'Ajustes' },
  { key: 'etiquetas', label: 'Etiquetas 3D', type: 'boolean', folder: 'Ajustes' },
];

/* ──────────────────── Constantes de visualización ──────────────────── */
const LED_APAGADO = new Color(0x20242a);
const LED_VERDE = new Color(0x27e870);
const LED_AMBAR = new Color(0xffaa1e);
const LED_ROJO = new Color(0xff2a3a);
const DI = ['S0', 'S6', 'B1', 'B2', 'B3', 'B4', 'S1', 'B5', 'S2', 'S3', 'S4', 'S5']; // %I0.0 … %I1.3
const DQ = ['y1', 'y2', 'y3', 'y4', 'y5', 'h1']; // %Q0.0 … %Q0.5

const suave = (t) => {
  const s = Math.min(1, Math.max(0, t));
  return s * s * (3 - 2 * s);
};

/** Textura animable de la banda: franjas transversales que se desplazan según +y. */
function texturaCinta() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#23272f';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#3a404c';
  ctx.fillRect(0, 0, 64, 10);
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(1, 9);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Indicador de la báscula: lectura, estado de S4 y tendencia con la banda de tolerancia. */
function crearIndicador() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, texture, clave: '' };
}

function dibujarIndicador(ind, planta, enPesaje, peso) {
  const ctx = ind.canvas.getContext('2d');
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, 512, 256);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#334155';
  ctx.strokeRect(3, 3, 506, 250);

  ctx.font = 'bold 22px "JetBrains Mono", monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('BÁSCULA · S4', 20, 36);
  ctx.textAlign = 'right';
  ctx.fillText(`${PESO_NOMINAL} ± ${TOLERANCIA} g`, 492, 36);
  ctx.textAlign = 'left';

  const color = enPesaje ? '#38bdf8' : peso < 5 ? '#64748b' : planta.s4 ? '#4ade80' : '#f87171';
  ctx.font = 'bold 58px "JetBrains Mono", monospace';
  ctx.fillStyle = color;
  ctx.fillText(`${Math.max(0, peso).toFixed(1)} g`, 20, 100);
  ctx.font = 'bold 22px "JetBrains Mono", monospace';
  const estado = planta.sinTension
    ? 'SIN TENSIÓN'
    : enPesaje
      ? `PESANDO T1 ${Math.min(planta.t1, T1).toFixed(1)} s`
      : peso < 5
        ? 'TARA · BLOQUEADA'
        : planta.s4
          ? 'S4 = 1 · DENTRO'
          : 'S4 = 0 · FUERA';
  ctx.fillText(estado, 20, 134);

  // Tendencia (16 s): banda de tolerancia y curva del peso
  const x0 = 20;
  const y0 = 150;
  const w = 472;
  const hgt = 92;
  const zMin = PESO_NOMINAL - 60;
  const zMax = PESO_NOMINAL + 40;
  const yDe = (g) => y0 + hgt - ((Math.min(zMax, Math.max(0, g)) - zMin) / (zMax - zMin)) * hgt;
  ctx.fillStyle = '#111c2e';
  ctx.fillRect(x0, y0, w, hgt);
  ctx.fillStyle = 'rgba(74, 222, 128, 0.18)';
  const yTolS = yDe(PESO_NOMINAL + TOLERANCIA);
  ctx.fillRect(x0, yTolS, w, yDe(PESO_NOMINAL - TOLERANCIA) - yTolS);
  ctx.strokeStyle = 'rgba(74, 222, 128, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, yDe(PESO_NOMINAL));
  ctx.lineTo(x0 + w, yDe(PESO_NOMINAL));
  ctx.stroke();
  const n = planta.tendencia.length;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, hgt);
  ctx.clip();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const g = planta.tendencia[(planta.iTendencia + k) % n];
    const xx = x0 + (k / (n - 1)) * w;
    const yy = g < zMin ? y0 + hgt + 4 : yDe(g);
    if (k === 0) ctx.moveTo(xx, yy);
    else ctx.lineTo(xx, yy);
  }
  ctx.stroke();
  ctx.restore();
  ind.texture.needsUpdate = true;
}

/* ──────────────────── Constructor de cilindros con mordazas ──────────────────── */
/**
 * Cilindro neumático fijo como en el plano: tuerca trasera, mordaza, camisa, mordaza y
 * tuerca delantera (prensaestopas). Devuelve un mapeador de coordenadas a lo largo del eje.
 * @param {{eje:'x'|'y', s0:number, dir:1|-1, c:number, z:number, zApoyo:number, L:number}} d
 */
function crearCilindro(lote, mat, matCamisa, d) {
  const P3 = (s, t, zz) => (d.eje === 'x' ? v3(d.s0 + d.dir * s, d.c + t, zz) : v3(d.c + t, d.s0 + d.dir * s, zz));
  const caja = (sA, sB, tA, tB, zA, zB) => {
    const a = P3(sA, tA, zA);
    const b = P3(sB, tB, zB);
    return bloque(Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.y, b.y), Math.max(a.y, b.y), zA, zB);
  };
  const eje = (sA, sB, r, seg = 24) => cilindro(P3(sA, 0, d.z), P3(sB, 0, d.z), r, seg);
  const L = d.L;
  // Tuercas hexagonales (6 lados) y camisa
  lote.add(mat.acero, eje(0, 0.16, 0.24, 6), eje(L - 0.16, L, 0.21, 6));
  lote.add(matCamisa, eje(0.44, L - 0.44, 0.15));
  // Mordazas de sujeción: placa base con pernos, cuerpo, sombrerete y culata
  for (const sm of [0.16, L - 0.44]) {
    const sc = sm + 0.14;
    lote.add(
      mat.mordaza,
      caja(sm, sm + 0.28, -0.5, 0.5, d.zApoyo, d.zApoyo + 0.08),
      caja(sm, sm + 0.28, -0.3, 0.3, d.zApoyo + 0.08, d.z),
      eje(sm, sm + 0.28, 0.3)
    );
    lote.add(mat.culata, eje(sm - 0.02, sm + 0.3, 0.21));
    lote.add(
      mat.acero,
      cilindro(P3(sc, -0.4, d.zApoyo + 0.08), P3(sc, -0.4, d.zApoyo + 0.14), 0.055, 6),
      cilindro(P3(sc, 0.4, d.zApoyo + 0.08), P3(sc, 0.4, d.zApoyo + 0.14), 0.055, 6),
      cilindro(P3(sc, 0, d.z + 0.27), P3(sc, 0, d.z + 0.37), 0.065, 6)
    );
  }
  return P3;
}

export function createScene(container, { params, onInfo, ariaLabel }) {
  let stage;
  let mundo;
  let planta;
  let pmrem;
  let sol;
  let pausado = false;
  let acumulado = 0;
  let firmaPrevia = '';
  let forzarDibujo = true;
  let tPublicar = 0;
  let tIndicador = 0;
  let tPrevio = 0;
  let emaMs = 16;
  let lento = 0;
  let nivelCalidad = 0;
  let textoEstado = '';
  let reloj = 0;
  const piezas = {};
  const etiquetas = [];

  /* ──────────────────── Materiales PBR ──────────────────── */
  function crearMateriales() {
    const std = (color, metalness, roughness, extra = {}) =>
      new MeshStandardMaterial({ color, metalness, roughness, ...extra });
    piezas.texCinta = texturaCinta();
    piezas.indicador = crearIndicador();
    return {
      pedestal: std(0x8a8f98, 0.15, 0.75),
      bastidor: std(0x5b6470, 0.4, 0.55),
      mordaza: std(0x4a5260, 0.55, 0.45),
      culata: std(0xb8c2cc, 0.85, 0.3),
      acero: std(0xe2e8f0, 0.95, 0.18),
      camisaA: std(0x0b5bd3, 0.55, 0.32, { emissive: 0x0b5bd3, emissiveIntensity: 0 }),
      camisaB: std(0xc22626, 0.55, 0.32, { emissive: 0xc22626, emissiveIntensity: 0 }),
      camisaC: std(0x16a34a, 0.55, 0.32, { emissive: 0x16a34a, emissiveIntensity: 0 }),
      camisaD: std(0xea580c, 0.55, 0.32, { emissive: 0xea580c, emissiveIntensity: 0 }),
      carcasa: std(0x4b6584, 0.35, 0.5),
      bascula: std(0x64748b, 0.75, 0.28),
      empujador: std(0x1e293b, 0.5, 0.4),
      banda: std(0x2a2f38, 0.05, 0.9, { map: piezas.texCinta }),
      chapa: std(0xa3aebb, 0.85, 0.3),
      cajaOK: std(0x15803d, 0.3, 0.6),
      cajaNOK: std(0xc2410c, 0.3, 0.6),
      gabinete: std(0xd8dce3, 0.3, 0.5),
      panel: std(0x1f2937, 0.4, 0.5),
      pantalla: new MeshBasicMaterial({ map: piezas.indicador.texture, toneMapped: false }),
      haz: new MeshBasicMaterial({
        color: 0xff2244,
        transparent: true,
        opacity: 0.55,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      pieza: std(0xd99a1e, 0.45, 0.4),
      verde: std(0x22c55e, 0.2, 0.4),
      rojo: std(0xef4444, 0.2, 0.4),
      suelo: new ShadowMaterial({ opacity: 0.25 }),
    };
  }

  /* ──────────────────── LED en un único InstancedMesh ──────────────────── */
  const ledDefs = [];
  const ledIdx = new Map();
  const registrarLed = (id, pos, escala = 1) => {
    ledIdx.set(id, ledDefs.length);
    ledDefs.push({ pos, escala });
  };
  function crearLeds() {
    const m = new InstancedMesh(
      new SphereGeometry(0.05, 12, 8),
      new MeshBasicMaterial({ toneMapped: false }),
      ledDefs.length
    );
    const mtx = new Matrix4();
    const q = new Quaternion();
    const esc = new Vector3();
    ledDefs.forEach((d, i) => {
      esc.setScalar(d.escala);
      m.setMatrixAt(i, mtx.compose(d.pos, q, esc));
      m.setColorAt(i, LED_APAGADO);
    });
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    piezas.leds = m;
    mundo.add(m);
  }
  const fijarLed = (id, color) => {
    const i = ledIdx.get(id);
    if (i !== undefined) piezas.leds.setColorAt(i, color);
  };

  /* ──────────────────── Elementos estáticos ──────────────────── */
  function crearBancadas(lote, mat) {
    lote.add(
      mat.pedestal,
      bloque(-7.1, -1.45, -1, 1, 0, 1.0), // A
      bloque(6.3, 10.1, -1, 1, 0, 1.0), // C
      bloque(1.1, 5.4, 1.3, 5.4, 0, 0.35), // bancada baja de B
      bloque(1.1, 2.8, 1.3, 4.5, 0.35, 1.0) // pedestal de D, apilado
    );
  }

  function crearCarcasa(lote, mat) {
    // Base (piso del centro de transferencia), cuatro columnas y techo: túnel en cruz
    lote.add(
      mat.carcasa,
      bloque(-1.3, 1.3, -1.3, 1.3, 0, 1.13),
      bloque(-1.3, -0.62, -1.3, -0.62, 1.13, 2.05),
      bloque(0.62, 1.3, -1.3, -0.62, 1.13, 2.05),
      bloque(-1.3, -0.62, 0.62, 1.3, 1.13, 2.05),
      bloque(0.62, 1.3, 0.62, 1.3, 1.13, 2.05),
      bloque(-1.3, 1.3, -1.3, 1.3, 2.05, 2.6)
    );
    // Poste del indicador de la báscula
    lote.add(mat.bastidor, cilindro(v3(0.7, 0.7, 2.6), v3(0.7, 0.7, 3.0), 0.06, 12));
  }

  function crearAlimentador(lote, mat) {
    const y0 = GEO.yAlimI;
    const y1 = GEO.yAlimF;
    lote.add(
      mat.bastidor,
      bloque(-1.1, -0.95, y0, y1, 0.75, 1.22),
      bloque(0.95, 1.1, y0, y1, 0.75, 1.22),
      bloque(-1.1, -0.95, y0, y0 + 0.2, 0, 0.75),
      bloque(0.95, 1.1, y0, y0 + 0.2, 0, 0.75),
      bloque(-1.1, -0.95, y1 - 0.2, y1, 0, 0.75),
      bloque(0.95, 1.1, y1 - 0.2, y1, 0, 0.75)
    );
    for (let y = y0 + 0.2; y < y1 - 0.05; y += 0.42) {
      lote.add(mat.acero, cilindro(v3(-0.95, y, 1.03), v3(0.95, y, 1.03), 0.12, 16));
    }
    // Almacén de caída (cuatro guías verticales sobre el alimentador)
    const ya = GEO.yAparicion;
    for (const [dx, dy] of [
      [-0.45, -0.45],
      [0.45, -0.45],
      [-0.45, 0.45],
      [0.45, 0.45],
    ]) {
      lote.add(mat.acero, cilindro(v3(dx, ya + dy, 1.7), v3(dx, ya + dy, 4.0), 0.035, 8));
    }
    lote.add(mat.bastidor, bloque(-0.55, 0.55, ya - 0.55, ya + 0.55, 4.0, 4.08));
  }

  function crearCinta(lote, mat) {
    const y0 = 1.3;
    const y1 = GEO.yCintaF;
    lote.add(
      mat.bastidor,
      bloque(-1.1, -0.95, y0, y1, 0.75, 1.22),
      bloque(0.95, 1.1, y0, y1, 0.75, 1.22),
      bloque(-1.1, -0.95, y0, y0 + 0.2, 0, 0.75),
      bloque(0.95, 1.1, y0, y0 + 0.2, 0, 0.75),
      bloque(-1.1, -0.95, y1 - 0.2, y1, 0, 0.75),
      bloque(0.95, 1.1, y1 - 0.2, y1, 0, 0.75)
    );
    lote.add(mat.acero, cilindro(v3(-0.95, y1 - 0.12, 1.02), v3(0.95, y1 - 0.12, 1.02), 0.13, 20));
    // Motor de la cinta (H1)
    lote.add(
      mat.bastidor,
      cilindro(v3(1.1, y1 - 0.12, 1.02), v3(1.75, y1 - 0.12, 1.02), 0.24, 20),
      bloque(1.2, 1.65, y1 - 0.35, y1 + 0.1, 0, 0.8)
    );
    registrarLed('lH1', v3(1.8, y1 - 0.12, 1.3), 1.6);
    // Fotocélula de barrera S5
    const yS = GEO.yS5;
    lote.add(
      mat.bastidor,
      bloque(-1.32, -1.2, yS - 0.06, yS + 0.06, 0.75, 1.62),
      bloque(1.2, 1.32, yS - 0.06, yS + 0.06, 0.75, 1.62),
      bloque(-1.3, -1.1, yS - 0.1, yS + 0.1, 1.3, 1.6),
      bloque(1.1, 1.3, yS - 0.1, yS + 0.1, 1.3, 1.6)
    );
    registrarLed('sS5', v3(1.36, yS, 1.55));
    // Contenedor de piezas buenas al final de la cinta
    const b = GEO.binOK;
    lote.add(
      mat.cajaOK,
      bloque(b.x0, b.x1, b.y0, b.y1, 0, GEO.zFondo),
      bloque(b.x0, b.x0 + 0.08, b.y0, b.y1, 0, b.h),
      bloque(b.x1 - 0.08, b.x1, b.y0, b.y1, 0, b.h),
      bloque(b.x0, b.x1, b.y0, b.y0 + 0.08, 0, b.h),
      bloque(b.x0, b.x1, b.y1 - 0.08, b.y1, 0, b.h)
    );
  }

  function crearBascula(lote, mat) {
    // Celda de carga fija bajo el plato y mesa intermedia hasta el empujador de C
    lote.add(
      mat.bastidor,
      bloque(1.5, 2.4, -0.45, 0.45, 0, 0.3),
      cilindro(v3(1.95, 0, 0.3), v3(1.95, 0, 0.84), 0.16, 20),
      bloque(2.95, 3.25, -0.2, 0.2, 0, 1.05),
      bloque(4.35, 4.55, -0.15, 0.15, 0, 0.84)
    );
    lote.add(mat.chapa, bloque(2.6, 3.65, -0.6, 0.6, 1.05, 1.13));
  }

  function crearCanaleta(lote, mat) {
    const { xCan, yCanI, zCanI, yCanF, zCanF } = GEO;
    const len = Math.hypot(yCanI - yCanF, zCanI - zCanF);
    const dir = v3(0, yCanF - yCanI, zCanF - zCanI).normalize();
    const q = new Quaternion().setFromUnitVectors(v3(0, 1, 0), dir);
    const rampa = (x0, x1, dz, esp) => {
      const g = new BoxGeometry(x1 - x0, len, esp);
      g.applyMatrix4(
        new Matrix4().compose(v3((x0 + x1) / 2, (yCanI + yCanF) / 2, (zCanI + zCanF) / 2 + dz), q, v3(1, 1, 1))
      );
      return g;
    };
    lote.add(
      mat.cajaNOK,
      rampa(xCan - 0.4, xCan + 0.4, -0.04, 0.06),
      rampa(xCan - 0.44, xCan - 0.38, 0.06, 0.24),
      rampa(xCan + 0.38, xCan + 0.44, 0.06, 0.24)
    );
    lote.add(mat.bastidor, bloque(xCan - 0.06, xCan + 0.06, -1.2, -1.08, 0, 1.0));
    const b = GEO.binNOK;
    lote.add(
      mat.cajaNOK,
      bloque(b.x0, b.x1, b.y0, b.y1, 0, GEO.zFondo),
      bloque(b.x0, b.x0 + 0.1, b.y0, b.y1, 0, b.h),
      bloque(b.x1 - 0.1, b.x1, b.y0, b.y1, 0, b.h),
      bloque(b.x0, b.x1, b.y0, b.y0 + 0.1, 0, b.h),
      bloque(b.x0, b.x1, b.y1 - 0.1, b.y1, 0, b.h)
    );
  }

  function crearCilindros(lote, mat) {
    // A: eje x, avanza hacia +x
    let P3 = crearCilindro(lote, mat, mat.camisaA, {
      eje: 'x',
      s0: -6.75,
      dir: 1,
      c: 0,
      z: GEO.zEje,
      zApoyo: 1.0,
      L: 3.4,
    });
    registrarLed('sB1', P3(0.3, 0.34, 1.75));
    registrarLed('sB2', P3(3.1, 0.34, 1.75));
    // C: eje x, avanza hacia −x
    P3 = crearCilindro(lote, mat, mat.camisaC, { eje: 'x', s0: 9.75, dir: -1, c: 0, z: GEO.zEje, zApoyo: 1.0, L: 3.0 });
    registrarLed('sS1', P3(0.3, 0.34, 1.75));
    registrarLed('sB5', P3(2.7, 0.34, 1.75));
    // D: eje y, avanza hacia −y
    P3 = crearCilindro(lote, mat, mat.camisaD, {
      eje: 'y',
      s0: 4.3,
      dir: -1,
      c: GEO.xPlato,
      z: GEO.zEje,
      zApoyo: 1.0,
      L: 2.3,
    });
    registrarLed('sS2', P3(0.3, 0.34, 1.75));
    registrarLed('sS3', P3(2.0, 0.34, 1.75));
    // B: eje y, pasador hacia −y (extendido en reposo)
    P3 = crearCilindro(lote, mat, mat.camisaB, {
      eje: 'y',
      s0: 5.05,
      dir: -1,
      c: 3.95,
      z: GEO.zEjeB,
      zApoyo: 0.35,
      L: 2.3,
    });
    registrarLed('sB3', P3(0.3, 0.34, 0.97));
    registrarLed('sB4', P3(2.0, 0.34, 0.97));
  }

  function crearArmario(lote, mat) {
    // Junto al banco, entre el pedestal de A y la cinta; frente (+y) hacia la vista isométrica
    const x0 = -9.6;
    const x1 = -7.4;
    const y0 = 2.4;
    const y1 = 3.6;
    lote.add(mat.gabinete, bloque(x0, x1, y0, y1, 0, 3.6));
    lote.add(mat.panel, bloque(x0 + 0.12, x1 - 0.12, y1, y1 + 0.03, 1.9, 3.4));
    DI.forEach((id, i) =>
      registrarLed(`di_${id}`, v3(x0 + 0.35 + (i % 6) * 0.3, y1 + 0.07, 3.15 - Math.floor(i / 6) * 0.25))
    );
    DQ.forEach((id, i) => registrarLed(`dq_${id}`, v3(x0 + 0.35 + i * 0.3, y1 + 0.07, 2.35)));
    lote.add(mat.bastidor, cilindro(v3(x1 - 0.3, y0 + 0.6, 3.6), v3(x1 - 0.3, y0 + 0.6, 3.85), 0.07, 16));
    registrarLed('balizaVerde', v3(x1 - 0.3, y0 + 0.6, 3.93), 2.2);
    registrarLed('balizaAmbar', v3(x1 - 0.3, y0 + 0.6, 4.15), 2.2);
    registrarLed('balizaRojo', v3(x1 - 0.3, y0 + 0.6, 4.37), 2.2);
    // Botonera: S0 (NA, verde) y S6 (NC, rojo)
    lote.add(mat.gabinete, bloque(-7.0, -5.9, 2.9, 3.45, 0, 1.75));
    lote.add(mat.verde, cilindro(v3(-6.7, 3.45, 1.45), v3(-6.7, 3.57, 1.45), 0.14, 20));
    lote.add(mat.rojo, cilindro(v3(-6.2, 3.45, 1.45), v3(-6.2, 3.57, 1.45), 0.16, 20));
    registrarLed('btnS0', v3(-6.7, 3.6, 1.45), 1.1);
    registrarLed('btnS6', v3(-6.2, 3.6, 1.45), 1.1);
  }

  /* ──────────────────── Partes móviles ──────────────────── */
  function grupoMovil(construir) {
    const g = new Group();
    const lote = crearLote();
    construir(lote);
    lote.construir(g);
    mundo.add(g);
    return g;
  }
  function crearPartesMoviles(mat) {
    const z = GEO.zEje;
    // A: vástago (entra en la camisa a lo largo de toda la carrera) y placa de empuje
    piezas.rodA = grupoMovil((l) => {
      l.add(mat.acero, cilindro(v3(-3.35 - GEO.carreraA, 0, z), v3(GEO.caraA0 - 0.1, 0, z), 0.06, 16));
      l.add(mat.acero, cilindro(v3(GEO.caraA0 - 0.22, 0, z), v3(GEO.caraA0 - 0.1, 0, z), 0.11, 6));
      l.add(mat.empujador, bloque(GEO.caraA0 - 0.1, GEO.caraA0, -0.4, 0.4, 1.2, 1.85));
    });
    // C: vástago y empujador en U abierto hacia −x
    const cC = GEO.caraC0;
    piezas.rodC = grupoMovil((l) => {
      l.add(mat.acero, cilindro(v3(cC + 0.12, 0, z), v3(6.75 + GEO.carreraC, 0, z), 0.06, 16));
      l.add(mat.acero, cilindro(v3(cC + 0.12, 0, z), v3(cC + 0.24, 0, z), 0.11, 6));
      l.add(
        mat.empujador,
        bloque(cC, cC + 0.12, -0.46, 0.46, 1.17, 1.85),
        bloque(cC - 0.36, cC, 0.38, 0.46, 1.17, 1.75),
        bloque(cC - 0.36, cC, -0.46, -0.38, 1.17, 1.75)
      );
    });
    // D: vástago y placa de empuje frente al plato
    const cD = GEO.caraD0;
    piezas.rodD = grupoMovil((l) => {
      l.add(mat.acero, cilindro(v3(GEO.xPlato, cD + 0.1, z), v3(GEO.xPlato, 2.0 + GEO.carreraD, z), 0.06, 16));
      l.add(mat.acero, cilindro(v3(GEO.xPlato, cD + 0.1, z), v3(GEO.xPlato, cD + 0.2, z), 0.11, 6));
      l.add(mat.empujador, bloque(GEO.xPlato - 0.33, GEO.xPlato + 0.33, cD, cD + 0.1, 1.2, 1.8));
    });
    // B: pasador de enclavamiento (extendido = dentro del bloque bajo la guía)
    piezas.rodB = grupoMovil((l) => {
      l.add(mat.acero, cilindro(v3(3.95, 0.05, GEO.zEjeB), v3(3.95, 2.75 + GEO.carreraB, GEO.zEjeB), 0.06, 16));
    });
    // Plato de la báscula, palanca y bloque de enclavamiento (descienden juntos con la carga)
    piezas.plato = grupoMovil((l) => {
      l.add(mat.bascula, bloque(1.35, 2.55, -0.6, 0.6, 1.03, 1.13));
      l.add(mat.carcasa, bloque(1.85, 4.45, -0.17, 0.17, 0.84, 0.96), bloque(3.63, 4.27, -0.25, 0.3, 0.5, 0.84));
      l.add(mat.panel, cilindro(v3(3.95, 0.3, GEO.zEjeB), v3(3.95, 0.32, GEO.zEjeB), 0.1, 16));
    });
    // Banda de la cinta H1 (desde el centro de la carcasa hasta el tambor final)
    const largo = GEO.yCintaF - GEO.yCintaI;
    piezas.banda = new Mesh(new PlaneGeometry(1.9, largo), mat.banda);
    piezas.banda.position.set(0, (GEO.yCintaF + GEO.yCintaI) / 2, 1.135);
    piezas.banda.receiveShadow = true;
    mundo.add(piezas.banda);
    // Haz de la fotocélula S5
    const gh = new CylinderGeometry(0.018, 0.018, 2.4, 8);
    gh.rotateZ(Math.PI / 2);
    piezas.haz = new Mesh(gh, mat.haz);
    piezas.haz.position.set(0, GEO.yS5, 1.45);
    mundo.add(piezas.haz);
    // Indicador de la báscula: fuera del grupo reflejado para que el texto se lea bien
    piezas.pantalla = new Mesh(new PlaneGeometry(2.1, 1.05), mat.pantalla);
    piezas.pantalla.position.set(0.7, -0.7, 3.5);
    piezas.pantalla.up.set(0, 0, 1);
    piezas.pantalla.lookAt(20.7, -20.7, 8);
    stage.scene.add(piezas.pantalla);
  }

  function crearPiezas(mat) {
    const g = new CylinderGeometry(GEO.radioPieza, GEO.radioPieza, GEO.altoPieza, 28);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, GEO.altoPieza / 2);
    piezas.pool = [];
    for (let i = 0; i < N_PIEZAS; i++) {
      const m = new Mesh(g, mat.pieza);
      m.castShadow = true;
      m.receiveShadow = true;
      m.visible = false;
      mundo.add(m);
      piezas.pool.push(m);
    }
  }

  function crearEtiquetas() {
    const texto = (cadena, x, y, z, size = 0.32) => {
      const t = stage.makeLabel(cadena, { size: size * 1.2, anchorX: 'center' });
      t.outlineWidth = '14%';
      t.position.set(x, -y, z); // las etiquetas viven fuera del grupo reflejado
      stage.scene.add(t);
      etiquetas.push(t);
      return t;
    };
    texto('A · alimentación', -5.0, 0, 2.35);
    texto('C · clasificación OK', 8.3, 0, 2.35);
    texto('D · rechazo NOK', 1.95, 3.4, 2.3);
    texto('B · bloqueo de báscula', 3.95, 4.7, 1.45);
    texto('Báscula', 3.1, -0.9, 1.55, 0.28);
    texto('Alimentador', -0.2, -3.4, 1.85);
    texto('Cinta H1', -0.2, 5.6, 1.75);
    texto('S5', 1.6, GEO.yS5, 1.95, 0.26);
    texto('Canaleta', 1.2, -2.4, 1.2, 0.26);
    texto('Contenedor NOK', 4.3, -4.9, 1.0, 0.28);
    texto('Contenedor OK', 0, 8.0, 1.25);
    texto('PLC S7-1200', -8.5, 3.0, 4.3);
    piezas.rotulos = etiquetas.slice();
    piezas.rotuloEstado = texto('', 1.5, -1.5, 6.4, 0.55);
    piezas.rotuloEtapa = texto('', 1.5, -1.5, 5.6, 0.38);
  }

  /* ──────────────────── Pose interpolada ──────────────────── */
  function aplicarPose(alfa) {
    const lerp = (a, b) => a + (b - a) * alfa;
    const a = lerp(planta.A.prev, planta.A.x);
    const b = lerp(planta.B.prev, planta.B.x);
    const c = lerp(planta.C.prev, planta.C.x);
    const d = lerp(planta.D.prev, planta.D.x);
    piezas.rodA.position.x = GEO.carreraA * a;
    piezas.rodB.position.y = GEO.carreraB * b; // b = fracción de retracción del pasador
    piezas.rodC.position.x = -GEO.carreraC * c;
    piezas.rodD.position.y = -GEO.carreraD * d;
    piezas.plato.position.z = -lerp(planta.pHundido, planta.hundido);
    piezas.texCinta.offset.y = -lerp(planta.pCinta, planta.cinta) / ((GEO.yCintaF - GEO.yCintaI) / 9);

    const pz = planta.pz;
    for (let i = 0; i < N_PIEZAS; i++) {
      const e = pz.estado[i];
      const m = piezas.pool[i];
      if (e === P.OCULTA) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      m.position.set(lerp(pz.px[i], pz.x[i]), lerp(pz.py[i], pz.y[i]), lerp(pz.pzz[i], pz.z[i]));
      m.rotation.set(lerp(pz.prx[i], pz.rx[i]), 0, 0);
      const sc = e === P.COLA && pz.s[i] < 1 ? suave(pz.s[i]) : 1;
      m.scale.setScalar(sc);
    }
  }

  function refrescarIndicador(dt, forzar) {
    tIndicador += dt;
    const peso = planta.peso;
    const enPesaje = planta.etapa() === 3 && !planta.sinTension;
    const clave = `${peso.toFixed(1)}|${planta.s4}|${enPesaje}|${planta.t1.toFixed(1)}|${planta.sinTension}|${planta.iTendencia}`;
    if (!forzar && (tIndicador < 1 / 15 || clave === piezas.indicador.clave)) return false;
    tIndicador = 0;
    piezas.indicador.clave = clave;
    dibujarIndicador(piezas.indicador, planta, enPesaje, peso);
    return true;
  }

  /* ──────────────────── LED, baliza y realce de actuadores ──────────────────── */
  function sincronizarLeds() {
    const s = planta.sensores();
    const on = (v, color = LED_VERDE) => (v ? color : LED_APAGADO);
    const plc = !planta.sinTension;
    for (const k of ['B1', 'B2', 'B3', 'B4', 'S1', 'B5', 'S2', 'S3', 'S5']) fijarLed(`s${k}`, on(s[k]));
    fijarLed('lH1', on(planta.h1, LED_AMBAR));
    fijarLed('btnS0', on(planta.s0));
    fijarLed('btnS6', on(!s.S6, LED_ROJO));
    for (const id of DI) fijarLed(`di_${id}`, on(plc && s[id]));
    for (const id of DQ) fijarLed(`dq_${id}`, on(plc && planta[id], LED_AMBAR));
    const enCiclo = plc && planta.etapa() > 0 && !pausado;
    const parpadeo = Math.floor(reloj * 3) % 2 === 0;
    fijarLed('balizaVerde', on(enCiclo && !planta.alarma));
    fijarLed('balizaAmbar', on(plc && planta.marcha && !enCiclo, LED_AMBAR));
    fijarLed('balizaRojo', on(plc && (planta.alarma ? parpadeo : !planta.marcha), LED_ROJO));
    piezas.leds.instanceColor.needsUpdate = true;
    // Realce de la camisa del cilindro cuyo solenoide está energizado
    piezas.mat.camisaA.emissiveIntensity = planta.y1 || planta.y2 ? 0.35 : 0;
    piezas.mat.camisaB.emissiveIntensity = planta.y3 ? 0.35 : 0;
    piezas.mat.camisaC.emissiveIntensity = planta.y4 ? 0.35 : 0;
    piezas.mat.camisaD.emissiveIntensity = planta.y5 ? 0.35 : 0;
    piezas.haz.material.opacity = s.S5 ? 0.95 : 0.4;
  }

  function publicar() {
    const s = planta.sensores();
    const estado = pausado ? 'Simulación en pausa' : planta.estado();
    const etapa = planta.etapa();
    const accion = ETAPAS[etapa]?.accion ?? 'En reposo';
    const espera = ETAPAS[etapa]?.transicion ?? '—';
    const activos = ['B1', 'B2', 'B3', 'B4', 'S1', 'B5', 'S2', 'S3', 'S4', 'S5'].filter((k) => s[k]).join(', ');
    const solenoides = DQ.filter((k) => planta[k])
      .map((k) => k.toUpperCase())
      .join(', ');
    const textoGP = `Etapa ${etapa} · ${accion}`;
    if (estado + textoGP !== textoEstado) {
      textoEstado = estado + textoGP;
      stage.setLabel(piezas.rotuloEstado, estado);
      stage.setLabel(piezas.rotuloEtapa, textoGP);
    }
    const total = planta.ok + planta.nok;
    const rend = total > 0 ? `${((planta.ok / total) * 100).toFixed(1)} %` : '—';
    const fallas = Object.entries(planta.fallas)
      .filter(([, v]) => v)
      .map(([k]) => (k === 'S5' ? 'S5' : `atasco ${k}`));
    if (planta.cableS6Roto) fallas.push('cable S6');
    if (planta.sinTension) fallas.push('sin tensión');
    const estadoVis =
      planta.alarma || planta.sinTension ? 'inestable' : planta.etapa() > 0 && !pausado ? 'estable' : 'marginal';
    onInfo?.({
      readouts: [
        { label: 'Estado', value: estado, state: estadoVis },
        { label: 'Alarma', value: planta.alarma || 'Sin alarmas', state: planta.alarma ? 'inestable' : undefined },
        { label: 'EtapaActiva (GP) / GM', value: `${etapa} / ${planta.etapaGM()}` },
        { label: 'Acción activa', value: accion },
        { label: 'Receptividad de avance', value: espera },
        { label: 'Solenoides activos (%Q)', value: solenoides || 'Ninguno' },
        { label: 'Sensores activos (%I)', value: activos || 'Ninguno' },
        { label: 'Báscula (lectura)', value: `${Math.max(0, planta.peso).toFixed(1)} g · S4 = ${planta.s4 ? 1 : 0}` },
        { label: 'Tolerancia de la báscula', value: `${PESO_NOMINAL} ± ${TOLERANCIA} g` },
        { label: 'T1_Pesaje.ET', value: `${Math.min(planta.t1, T1).toFixed(2)} / ${T1.toFixed(1)} s` },
        { label: 'T2_Cinta.ET', value: `${Math.min(planta.t2, T2).toFixed(2)} / ${T2.toFixed(1)} s` },
        { label: 'PiezasOK (C_OK)', value: String(planta.ok) },
        { label: 'PiezasNOK (C_NOK)', value: String(planta.nok) },
        { label: 'PiezasTotal', value: String(total) },
        { label: 'Rendimiento', value: rend },
        { label: 'Tiempo del último ciclo', value: planta.ultimoCiclo ? `${planta.ultimoCiclo.toFixed(2)} s` : '—' },
        {
          label: 'Fallas inyectadas',
          value: fallas.join(', ') || 'Ninguna',
          state: fallas.length ? 'marginal' : undefined,
        },
      ],
      aria: `${estado}. ${textoGP}. Solenoides: ${solenoides || 'ninguno'}. Sensores activos: ${activos || 'ninguno'}. ${planta.alarma}`,
    });
  }

  function publicarTabla() {
    onInfo?.({
      table: {
        caption: 'Secuencia del GRAFCET de producción (GP)',
        columns: ['Etapa', 'Acción', 'Salidas activas', 'Receptividad de transición'],
        rows: ETAPAS.map((e) => [String(e.n), e.accion, e.salidas, e.transicion]),
      },
    });
  }

  function vigilarCalidad(ahora) {
    const ms = ahora - tPrevio;
    tPrevio = ahora;
    if (ms <= 0 || ms > 200) return;
    emaMs += (ms - emaMs) * 0.05;
    lento = emaMs > 22 ? lento + ms : 0;
    if (lento < 1200 || nivelCalidad >= 3) return;
    lento = 0;
    emaMs = 16;
    nivelCalidad += 1;
    if (nivelCalidad === 1) {
      const pr = Math.min(window.devicePixelRatio, 1.25);
      stage.renderer.setPixelRatio(pr);
      stage.composer.setPixelRatio(pr);
    } else if (nivelCalidad === 2) {
      stage.renderer.setPixelRatio(1);
      stage.composer.setPixelRatio(1);
      stage.composer.passes[2].enabled = false; // SMAA
    } else {
      stage.renderer.shadowMap.enabled = false;
      sol.castShadow = false;
      piezas.suelo.visible = false;
    }
    stage.resize();
  }

  /* ──────────────────── Bucle: barridos fijos + interpolación ──────────────────── */
  function tick(dt) {
    reloj += dt;
    let alfa = 1;
    let mueve = forzarDibujo;
    const forzar = forzarDibujo;
    forzarDibujo = false;
    if (!pausado) {
      acumulado += dt * params.velocidad;
      const n = Math.min(Math.floor(acumulado / PASO), 240);
      if (n > 0) {
        if (!planta.quieta()) mueve = true;
        for (let i = 0; i < n; i++) planta.paso();
        acumulado -= n * PASO;
        if (acumulado > PASO) acumulado = 0;
        if (!planta.quieta()) mueve = true;
        const firma = planta.firma();
        tPublicar += dt;
        if (firma !== firmaPrevia) {
          firmaPrevia = firma;
          tPublicar = 0;
          sincronizarLeds();
          publicar();
          mueve = true;
        } else if (mueve && tPublicar > 0.15) {
          tPublicar = 0;
          publicar();
        }
      }
      alfa = acumulado / PASO;
    }
    if (planta.alarma) {
      sincronizarLeds(); // parpadeo de la baliza roja
      mueve = true;
    }
    if (refrescarIndicador(dt, forzar)) mueve = true;
    if (mueve) {
      aplicarPose(alfa);
      vigilarCalidad(performance.now());
    } else {
      tPrevio = performance.now();
    }
    return mueve;
  }

  /* ──────────────────── Órdenes ──────────────────── */
  const refrescar = () => {
    firmaPrevia = '';
    forzarDibujo = true;
  };
  const acciones = {
    marcha() {
      pausado = false;
      planta.pulsarS0();
      refrescar();
    },
    paro() {
      planta.alternarS6();
      refrescar();
    },
    pausar() {
      pausado = !pausado;
      sincronizarLeds();
      publicar();
      forzarDibujo = true;
    },
    reiniciar() {
      pausado = false;
      acumulado = 0;
      planta.reiniciar();
      refrescar();
    },
    resetConteo() {
      planta.resetConteo();
      refrescar();
    },
    reconocer() {
      planta.reconocerAlarma();
      refrescar();
    },
  };

  const onTecla = (e) => {
    const alternarS4 = () => {
      params.modoTolerancia = params.modoTolerancia === 'ok' ? 'nok' : 'ok';
      aplicarParametros();
    };
    const teclas = {
      ' ': () => (pausado || planta.etapa() > 0 ? acciones.pausar() : acciones.marcha()),
      0: acciones.reiniciar,
      6: acciones.paro,
      t: alternarS4,
      T: alternarS4,
      a: acciones.reconocer,
      A: acciones.reconocer,
    };
    if (teclas[e.key]) {
      e.preventDefault();
      teclas[e.key]();
    }
  };

  function aplicarParametros() {
    planta.fijarModo(params.modoTolerancia);
    planta.cableS6Roto = params.cableS6Roto;
    planta.cortarTension(params.sinTension);
    planta.fallas.A = params.fallaA;
    planta.fallas.B = params.fallaB;
    planta.fallas.C = params.fallaC;
    planta.fallas.D = params.fallaD;
    planta.fallas.S5 = params.fallaS5;
    for (const t of piezas.rotulos) t.visible = params.etiquetas;
    refrescar();
  }

  function crearRejilla() {
    piezas.rejilla = stage.makeGrid(40, 40);
    piezas.rejilla.position.set(0, 0, 0.004);
    stage.scene.add(piezas.rejilla);
  }

  function restyle() {
    const theme = stage.refreshTheme();
    for (const t of etiquetas) {
      t.color = theme.text;
      t.sync(stage.requestRender);
    }
    stage.scene.remove(piezas.rejilla);
    piezas.rejilla.geometry.dispose();
    piezas.rejilla.material.dispose();
    crearRejilla();
    forzarDibujo = true;
  }

  return {
    mount() {
      stage = createStage(container, {
        ariaLabel,
        camera: [13.6, -14.2, 12.0],
        target: [0.6, -0.4, 0.9],
        fov: 38,
        minDistance: 4,
        maxDistance: 48,
      });
      planta = createPlanta();
      params.acciones = acciones;
      // Solo en desarrollo: acceso para pruebas automáticas desde la consola del navegador.
      if (import.meta.env?.DEV) window.__lab12 = { planta, params, acciones, aplicarParametros, stage };

      pmrem = new PMREMGenerator(stage.renderer);
      piezas.entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      stage.scene.environment = piezas.entorno;
      stage.scene.environmentIntensity = 0.45;
      stage.renderer.shadowMap.enabled = true;
      stage.renderer.shadowMap.type = PCFShadowMap;
      sol = stage.scene.children.find((o) => o.isDirectionalLight);
      sol.position.set(12, -8, 20);
      /* La lámina usa una proyección isométrica especular (+x abajo a la derecha, +y abajo a
         la izquierda). Para verla igual con una cámara diestra se refleja el eje y del mundo:
         la geometría se modela con las cotas del plano y se dibuja dentro de este grupo. */
      mundo = new Group();
      mundo.scale.y = -1;
      stage.scene.add(mundo);
      sol.castShadow = true;
      sol.shadow.mapSize.set(2048, 2048);
      sol.shadow.bias = -0.0004;
      sol.shadow.normalBias = 0.04;
      Object.assign(sol.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
      sol.shadow.camera.updateProjectionMatrix();

      const mat = crearMateriales();
      piezas.mat = mat;
      const lote = crearLote();
      crearBancadas(lote, mat);
      crearCarcasa(lote, mat);
      crearAlimentador(lote, mat);
      crearCinta(lote, mat);
      crearBascula(lote, mat);
      crearCanaleta(lote, mat);
      crearCilindros(lote, mat);
      crearArmario(lote, mat);
      lote.construir(mundo);

      crearPartesMoviles(mat);
      crearPiezas(mat);
      crearLeds();
      crearEtiquetas();

      piezas.suelo = new Mesh(new PlaneGeometry(60, 60), mat.suelo);
      piezas.suelo.position.z = 0.002;
      piezas.suelo.receiveShadow = true;
      stage.scene.add(piezas.suelo);
      crearRejilla();

      aplicarParametros();
      planta.paso();
      sincronizarLeds();
      firmaPrevia = planta.firma();
      publicar();
      publicarTabla();
      refrescarIndicador(0, true);
      aplicarPose(1);

      stage.renderer.domElement.addEventListener('keydown', onTecla);
      stage.onTick(tick);
      tPrevio = performance.now();
      stage.start();
      if (params.autoInicio && !stage.reducedMotion) acciones.marcha();
    },
    update(p) {
      Object.assign(params, p);
      aplicarParametros();
    },
    resize: () => stage.resize(),
    restyle,
    dispose() {
      if (!stage) return;
      stage.renderer.domElement.removeEventListener('keydown', onTecla);
      piezas.leds?.dispose();
      piezas.entorno?.dispose();
      pmrem?.dispose();
      delete params.acciones;
      if (import.meta.env?.DEV && window.__lab12?.planta === planta) delete window.__lab12;
      stage.dispose();
    },
    get renderer() {
      return stage?.renderer;
    },
    /** Acceso de solo lectura para pruebas automáticas en el navegador. */
    get planta() {
      return planta;
    },
  };
}
