/**
 * Figura 1 en 3D: estación automática de giro temporizado (mesa revólver indexada).
 *
 * Disposición (eje Z vertical, unidades ≈ dm):
 *   - Mesa revólver de 6 cunas en el origen; indexa 60° por ciclo con el cilindro E.
 *   - Estaciones fijas: carga 210°, taladrado 270° (F, G), asiento 330° (H, I),
 *     desbarbado 30° (J, K), espera 90° y descarga 150°.
 *   - Cinta 1 (alimentación) y cinta 2 (salida) sobre x = −5; los transportes 1 y 2
 *     (elevación A/C + carro sin vástago B/D) cruzan entre las cintas y la mesa.
 *
 * Fluidez:
 *   - La geometría estática se fusiona por material; los LED son un único InstancedMesh.
 *   - La lógica avanza a 5 ms fijos y cada cuadro interpola entre los dos últimos scans.
 *   - Sin movimiento no se dibuja; la calidad baja de forma escalonada si el equipo no
 *     sostiene unos 45 cuadros por segundo (resolución, luego sombras y SMAA).
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Points,
  PointsMaterial,
  Quaternion,
  RepeatWrapping,
  RingGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createStage, damp } from './three-utils.js';
import { createPlanta, ESTACIONES, N_CUNAS, PASO, PASO_ANGULAR, suave } from './giroLogica.js';
import { FASES } from '../../content/secuencia.js';

export const defaults = { velocidad: 1, modo: 'auto', rotulos: true, precarga: true };
export const carpetasCerradas = ['Simulación', 'Vista'];

export const controls = [
  { label: 'MARCHA: iniciar', type: 'button', folder: 'Mando', action: (p) => p.acciones?.iniciar() },
  { label: 'PARADA: fin de ciclo', type: 'button', folder: 'Mando', action: (p) => p.acciones?.parar() },
  {
    key: 'modo',
    label: 'Régimen (SEL_AUTO)',
    type: 'select',
    options: { Automático: 'auto', 'Manual (ciclo único)': 'manual' },
    folder: 'Mando',
  },
  {
    label: 'PULSO_MAN: un ciclo',
    type: 'button',
    folder: 'Mando',
    action: (p) => p.acciones?.pulsoManual(),
    visibleIf: (p) => p.modo === 'manual',
  },
  { label: 'ESTOP: activar o liberar', type: 'button', folder: 'Seguridad', action: (p) => p.acciones?.emergencia() },
  { label: 'REPOS: reposición', type: 'button', folder: 'Seguridad', action: (p) => p.acciones?.reposicion() },
  { label: 'RT_LUB: disparar o rearmar', type: 'button', folder: 'Seguridad', action: (p) => p.acciones?.termico() },
  { key: 'velocidad', label: 'Velocidad', min: 0.25, max: 3, step: 0.25, unit: '×', folder: 'Simulación' },
  { label: 'Pausar o reanudar', type: 'button', folder: 'Simulación', action: (p) => p.acciones?.pausar() },
  { label: 'Reiniciar planta', type: 'button', folder: 'Simulación', action: (p) => p.acciones?.reiniciar() },
  { key: 'precarga', label: 'Mesa precargada al reiniciar', type: 'boolean', folder: 'Simulación' },
  { key: 'rotulos', label: 'Rótulos 3D', type: 'boolean', folder: 'Vista' },
  { label: 'Vista general', type: 'button', folder: 'Vista', action: (p) => p.acciones?.vista('general') },
  { label: 'Vista de la mesa', type: 'button', folder: 'Vista', action: (p) => p.acciones?.vista('mesa') },
  { label: 'Vista de transportes', type: 'button', folder: 'Vista', action: (p) => p.acciones?.vista('transporte') },
];

/* ───────────────────────── Constantes geométricas ───────────────────────── */
const COLORES = {
  estructura: 0x5d6678,
  acero: 0xc4cad4,
  oscuro: 0x2a2e38,
  bandaLateral: 0x3a4150,
  mesa: 0x8f99aa,
  azul: 0x2467c4,
  naranja: 0xd9822b,
  verdeAzul: 0x12877a,
  rojo: 0xc2323a,
  gabinete: 0xd5d8df,
  amarillo: 0xffcc1a,
  verde: 0x2f9e5f,
  cian: 0x1aa6c4,
};
/** Colores de M_LUB y Y_BARRIDO: reposo neutro y activo muy contrastado (verde / cian). */
const AUX = {
  reposo: 0x5b6472,
  lub: { color: 0x22c55e, emisivo: 0x19ff6a },
  barrido: { color: 0x22d3ee, emisivo: 0x1ad8ff },
};
const LED_APAGADO = new Color(0x252832);
const LED_VERDE = new Color(0x2bff7a);
const LED_AMBAR = new Color(0xffb020);
const LED_ROJO = new Color(0xff2e3e);
const LED_MORADO = new Color(0xc86bff);

const R_CUNA = 1.7; // radio de las cunas
const R_MESA = 2.3;
const Z_MESA = 1.0;
const Z_PIEZA = 1.06; // apoyo de la pieza (cunas y cintas a la misma altura)
const PIEZA = { radial: 0.34, tang: 0.5, alto: 0.28 };
const X_CINTA = -5;
const Y_TOMA = -0.85; // final de la cinta 1 = línea del transporte 1
const Y_DEJA = 0.85; // inicio de la cinta 2 = línea del transporte 2
const X_MESA_T = R_CUNA * Math.cos((ESTACIONES.carga * Math.PI) / 180); // −1.47
const Z_RIEL = 3.6;
const ANG_E = 105; // el cilindro E empuja la corona en el sector libre junto a la estación de espera
const Z_VENTOSA = 2.3; // fondo de la ventosa con A/C arriba
const CARRERA_AC = Z_VENTOSA - (Z_PIEZA + PIEZA.alto);
const CARRERA_H = 0.55; // herramientas horizontales
const CARRERA_V = 0.59; // herramientas verticales
const DEG = Math.PI / 180;

const VISTAS = {
  general: { pos: [4.4, -12.6, 10.0], target: [-1.3, 0.6, 0.8] },
  mesa: { pos: [4.6, -5.6, 5.4], target: [0.2, 0, 1.2] },
  transporte: { pos: [-1.4, -7.6, 4.6], target: [-3.4, 0, 1.9] },
};

const UNO = new Vector3(1, 1, 1);
const Y_UP = new Vector3(0, 1, 0);
const v3 = (x, y, z) => new Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;

const caja = (w, d, h, x, y, z, rotZ = 0) => {
  const g = new BoxGeometry(w, d, h);
  g.translate(x, y, z);
  if (rotZ) g.rotateZ(rotZ);
  return g;
};

/** Cilindro entre dos puntos; r2 es el radio en el extremo b. */
function cilindro(a, b, r, seg = 18, r2 = r) {
  const d = new Vector3().subVectors(b, a);
  const g = new CylinderGeometry(r2, r, d.length(), seg);
  const q = new Quaternion().setFromUnitVectors(Y_UP, d.clone().normalize());
  g.applyMatrix4(new Matrix4().compose(new Vector3().addVectors(a, b).multiplyScalar(0.5), q, UNO));
  return g;
}

/** Agrupa geometrías por material y las fusiona: una llamada de dibujo por material. */
function crearLote() {
  const grupos = new Map();
  return {
    add(material, ...geometrias) {
      if (!grupos.has(material)) grupos.set(material, []);
      grupos.get(material).push(...geometrias);
    },
    construir(padre, { sombras = true } = {}) {
      for (const [material, geometrias] of grupos) {
        const mesh = new Mesh(mergeGeometries(geometrias, false), material);
        mesh.matrixAutoUpdate = false;
        mesh.castShadow = sombras && !material.transparent;
        mesh.receiveShadow = sombras;
        padre.add(mesh);
        geometrias.forEach((g) => g.dispose());
      }
      grupos.clear();
    },
  };
}

function texturaBanda() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#23262e';
  x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#464b58';
  x.fillRect(0, 0, 64, 12);
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}

/* ═════════════════════════════════════════════════════════════════════════ */
export function createScene(container, { params, onInfo, ariaLabel }) {
  let stage;
  let planta;
  let pmrem;
  let pausado = false;
  let acumulado = 0;
  let firmaPrevia = '';
  let forzarDibujo = true;
  let tPrevio = 0;
  let emaMs = 16;
  let lento = 0;
  let nivelCalidad = 0;
  let giroHerr = 0;
  let vista = null;
  const piezas = {};
  const etiquetas = [];

  /* ──────────────────── Materiales ──────────────────── */
  function crearMateriales() {
    const std = (color, metalness, roughness, extra = {}) =>
      new MeshStandardMaterial({ color, metalness, roughness, ...extra });
    piezas.texCinta1 = texturaBanda();
    piezas.texCinta2 = texturaBanda();
    return {
      estructura: std(COLORES.estructura, 0.55, 0.5),
      acero: std(COLORES.acero, 0.9, 0.28),
      oscuro: std(COLORES.oscuro, 0.4, 0.6),
      lateral: std(COLORES.bandaLateral, 0.5, 0.5),
      mesa: std(COLORES.mesa, 0.75, 0.35),
      cinta1: std(0xffffff, 0, 0.85, { map: piezas.texCinta1 }),
      cinta2: std(0xffffff, 0, 0.85, { map: piezas.texCinta2 }),
      azul: std(COLORES.azul, 0.35, 0.42),
      naranja: std(COLORES.naranja, 0.35, 0.42),
      verdeAzul: std(COLORES.verdeAzul, 0.35, 0.42),
      rojo: std(COLORES.rojo, 0.4, 0.42),
      gabinete: std(COLORES.gabinete, 0.3, 0.55),
      amarillo: std(COLORES.amarillo, 0.25, 0.5),
      // Auxiliares: gris en reposo; color saturado y emisivo (con pulso) cuando el PLC los activa.
      cian: std(AUX.reposo, 0.4, 0.45, { emissive: 0x000000 }),
      lub: std(AUX.reposo, 0.4, 0.45, { emissive: 0x000000 }),
      ventosa: std(0x3a2a48, 0.1, 0.6, { emissive: 0x000000 }),
      haz: new MeshBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0.55, depthWrite: false }),
      suelo: std(0xffffff, 0, 0.95),
      // Piezas: bruta → taladrada → asiento → terminada
      pieza: [0x8a94a3, 0xa9b3c2, 0xc0c9d6, 0xdde3ec].map((c) => std(c, 0.55, 0.38)),
      agujero: new MeshBasicMaterial({ color: 0x0b0c10 }),
      asiento: std(0x50565f, 0.9, 0.3, { side: DoubleSide }),
      chaflan: std(0xf2f5fa, 1, 0.12, { side: DoubleSide }),
    };
  }

  /* ──────────────────── LED (un único InstancedMesh) ──────────────────── */
  const ledDefs = [];
  const ledIdx = new Map();
  const led = (id, x, y, z, escala = 1) => {
    ledIdx.set(id, ledDefs.length);
    ledDefs.push({ pos: v3(x, y, z), escala });
  };
  function crearLeds() {
    const m = new InstancedMesh(
      new SphereGeometry(0.05, 10, 8),
      new MeshBasicMaterial({ toneMapped: false }),
      ledDefs.length
    );
    const mat = new Matrix4();
    const q = new Quaternion();
    ledDefs.forEach((d, i) => {
      m.setMatrixAt(i, mat.compose(d.pos, q, new Vector3(d.escala, d.escala, d.escala)));
      m.setColorAt(i, LED_APAGADO);
    });
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    piezas.leds = m;
    stage.scene.add(m);
  }
  const fijarLed = (id, color) => piezas.leds.setColorAt(ledIdx.get(id), color);

  /* ──────────────────── Planta estática ──────────────────── */
  function crearSuelo(mat) {
    const suelo = new Mesh(new PlaneGeometry(30, 26), mat.suelo);
    suelo.position.set(-1, 0, 0);
    suelo.receiveShadow = true;
    piezas.suelo = suelo;
    stage.scene.add(suelo);
    pintarSuelo();
  }
  function pintarSuelo() {
    const oscuro = stage.theme.isDark;
    piezas.suelo.material.color.set(oscuro ? 0x1a1830 : 0xe9ebf2);
  }

  function crearCintas(lote, mat) {
    const largo = 6.1;
    const banda = (yIni, material) => {
      const g = new PlaneGeometry(0.8, largo);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) * largo) / 0.45);
      g.translate(X_CINTA, yIni + largo / 2, Z_PIEZA);
      lote.add(material, g);
      const yc = yIni + largo / 2;
      lote.add(
        mat.lateral,
        caja(0.08, largo, 0.3, X_CINTA - 0.44, yc, Z_PIEZA - 0.11),
        caja(0.08, largo, 0.3, X_CINTA + 0.44, yc, Z_PIEZA - 0.11),
        caja(0.8, largo, 0.18, X_CINTA, yc, Z_PIEZA - 0.12),
        cilindro(v3(X_CINTA - 0.45, yIni, Z_PIEZA - 0.1), v3(X_CINTA + 0.45, yIni, Z_PIEZA - 0.1), 0.1),
        cilindro(v3(X_CINTA - 0.45, yIni + largo, Z_PIEZA - 0.1), v3(X_CINTA + 0.45, yIni + largo, Z_PIEZA - 0.1), 0.1)
      );
      const patas = [];
      for (const y of [yIni + 0.4, yc, yIni + largo - 0.4]) {
        for (const dx of [-0.36, 0.36])
          patas.push(caja(0.09, 0.09, Z_PIEZA - 0.2, X_CINTA + dx, y, (Z_PIEZA - 0.2) / 2));
      }
      lote.add(mat.estructura, ...patas);
      lote.add(
        mat.acero,
        caja(0.03, largo - 0.3, 0.05, X_CINTA - 0.37, yc, Z_PIEZA + 0.2),
        caja(0.03, largo - 0.3, 0.05, X_CINTA + 0.37, yc, Z_PIEZA + 0.2)
      );
    };
    banda(-6.6, mat.cinta1); // termina en y = −0.5
    banda(0.5, mat.cinta2);
    // Tope mecánico al final de la cinta 1
    lote.add(mat.amarillo, caja(0.8, 0.06, 0.2, X_CINTA, -0.47, Z_PIEZA + 0.1));
    // Sensor S_C1 de barrera (emisor + reflector)
    const zs = Z_PIEZA + 0.16;
    lote.add(mat.amarillo, caja(0.16, 0.2, 0.24, X_CINTA - 0.58, Y_TOMA, zs));
    lote.add(mat.oscuro, caja(0.05, 0.2, 0.24, X_CINTA + 0.5, Y_TOMA, zs));
    lote.add(
      mat.estructura,
      caja(0.07, 0.07, zs, X_CINTA - 0.58, Y_TOMA, zs / 2),
      caja(0.07, 0.07, zs, X_CINTA + 0.5, Y_TOMA, zs / 2)
    );
    led('sc1', X_CINTA - 0.58, Y_TOMA - 0.12, zs + 0.15);
    const haz = new Mesh(cilindro(v3(X_CINTA - 0.5, Y_TOMA, zs), v3(X_CINTA + 0.47, Y_TOMA, zs), 0.011, 6), mat.haz);
    haz.matrixAutoUpdate = false;
    stage.scene.add(haz);
  }

  function crearPedestalMesa(lote, mat) {
    lote.add(mat.estructura, cilindro(v3(0, 0, 0), v3(0, 0, 0.12), 1.2, 32));
    lote.add(mat.oscuro, cilindro(v3(0, 0, 0.12), v3(0, 0, Z_MESA - 0.24), 0.85, 32));
    // Cubo central fijo: lubricación M_LUB y colector de barrido
    lote.add(mat.oscuro, cilindro(v3(0, 0, Z_MESA), v3(0, 0, Z_MESA + 0.08), 0.5, 28));
    // Toberas de barrido apuntando a las tres estaciones de mecanizado
    for (const est of ['p1', 'p2', 'p3']) {
      const a = ESTACIONES[est] * DEG;
      const d = v3(Math.cos(a), Math.sin(a), 0);
      const p0 = d
        .clone()
        .multiplyScalar(0.5)
        .setZ(Z_MESA + 0.52);
      const p1 = d
        .clone()
        .multiplyScalar(0.78)
        .setZ(Z_MESA + 0.46);
      lote.add(mat.cian, cilindro(p0, p1, 0.035, 10, 0.05));
    }
  }

  function crearMesaMovil(mat) {
    piezas.mesa = new Group();
    const lote = crearLote();
    lote.add(mat.mesa, cilindro(v3(0, 0, Z_MESA - 0.24), v3(0, 0, Z_MESA), R_MESA, 64));
    lote.add(mat.oscuro, new TorusGeometry(R_MESA, 0.035, 8, 64).translate(0, 0, Z_MESA - 0.03));
    const dientes = [];
    const cunas = [];
    for (let k = 0; k < N_CUNAS; k++) {
      const a = k * PASO_ANGULAR * DEG;
      // Corona dentada: un diente entre cunas, lo arrastra el trinquete de E
      dientes.push(caja(0.22, 0.14, 0.18, R_MESA + 0.06, 0, Z_MESA - 0.12, a + 30 * DEG));
      // Cuna en V con mordazas laterales
      cunas.push(
        caja(0.5, 0.64, 0.06, R_CUNA, 0, Z_MESA + 0.03, a),
        caja(0.42, 0.06, 0.16, R_CUNA, 0.29, Z_PIEZA + 0.08, a),
        caja(0.42, 0.06, 0.16, R_CUNA, -0.29, Z_PIEZA + 0.08, a)
      );
    }
    lote.add(mat.acero, ...dientes);
    lote.add(mat.estructura, ...cunas);
    lote.construir(piezas.mesa);
    stage.scene.add(piezas.mesa);
  }

  function crearLubricacion(mat) {
    const g = new Group();
    const cuerpo = new Mesh(new CylinderGeometry(0.34, 0.4, 0.42, 28).rotateX(Math.PI / 2), mat.lub);
    cuerpo.position.z = Z_MESA + 0.29;
    const tapa = new Mesh(
      new SphereGeometry(0.34, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2),
      mat.lub
    );
    tapa.position.z = Z_MESA + 0.5;
    const anillo = new Mesh(new TorusGeometry(0.42, 0.03, 8, 40), mat.acero);
    anillo.position.z = Z_MESA + 0.18;
    g.add(cuerpo, tapa, anillo);
    for (const m of [cuerpo, tapa, anillo]) m.castShadow = true;
    piezas.lubAnillo = anillo;
    stage.scene.add(g);
  }

  /** Portal, rieles y cilindros sin vástago B y D de los dos transportes. */
  function crearPortal(lote, mat) {
    for (const x of [-5.9, -3.0]) {
      for (const y of [-1.5, 1.5]) lote.add(mat.estructura, caja(0.2, 0.2, Z_RIEL + 0.35, x, y, (Z_RIEL + 0.35) / 2));
      lote.add(mat.estructura, caja(0.2, 3.2, 0.2, x, 0, Z_RIEL + 0.35));
    }
    const xa = -5.85;
    const xb = -0.95;
    for (const [y, color, ids] of [
      [Y_TOMA, mat.azul, ['b0', 'b1']],
      [Y_DEJA, mat.naranja, ['d1', 'd0']],
    ]) {
      lote.add(mat.estructura, caja(xb - xa, 0.2, 0.22, (xa + xb) / 2, y, Z_RIEL + 0.1));
      // Cuerpo del cilindro sin vástago a lo largo del riel
      lote.add(color, cilindro(v3(xa + 0.1, y, Z_RIEL + 0.3), v3(xb - 0.1, y, Z_RIEL + 0.3), 0.075, 14));
      lote.add(
        mat.oscuro,
        caja(0.16, 0.2, 0.2, xa + 0.08, y, Z_RIEL + 0.3),
        caja(0.16, 0.2, 0.2, xb - 0.08, y, Z_RIEL + 0.3)
      );
      // Finales de carrera en los extremos (B3/B4 en T1, S7/S8 en T2)
      led(ids[0], X_CINTA, y - 0.14, Z_RIEL + 0.03);
      led(ids[1], X_MESA_T, y - 0.14, Z_RIEL + 0.03);
      lote.add(
        mat.oscuro,
        caja(0.08, 0.06, 0.1, X_CINTA, y - 0.12, Z_RIEL + 0.06),
        caja(0.08, 0.06, 0.1, X_MESA_T, y - 0.12, Z_RIEL + 0.06)
      );
    }
  }

  /** Cilindro E: empuja tangencialmente la corona (giro) y retrocede para bloquear. */
  function crearCilindroE(lote, mat) {
    const a = ANG_E * DEG;
    const rE = R_MESA + 0.42;
    const c = v3(rE * Math.cos(a), rE * Math.sin(a), Z_MESA - 0.12);
    const t = v3(-Math.sin(a), Math.cos(a), 0); // sentido antihorario
    piezas.dirE = t;
    const ini = c.clone().addScaledVector(t, -1.45);
    const fin = c.clone().addScaledVector(t, -0.45);
    lote.add(mat.verdeAzul, cilindro(ini, fin, 0.15, 18));
    lote.add(
      mat.oscuro,
      cilindro(ini, ini.clone().addScaledVector(t, 0.08), 0.17),
      cilindro(fin, fin.clone().addScaledVector(t, -0.08), 0.17)
    );
    lote.add(
      mat.estructura,
      caja(0.3, 0.3, Z_MESA - 0.27, (ini.x + fin.x) / 2, (ini.y + fin.y) / 2, (Z_MESA - 0.27) / 2)
    );
    const n = v3(Math.cos(a), Math.sin(a), 0).multiplyScalar(0.2);
    led('e0', ini.x + n.x + t.x * 0.35, ini.y + n.y + t.y * 0.35, c.z + 0.12);
    led('e1', fin.x + n.x - t.x * 0.2, fin.y + n.y - t.y * 0.2, c.z + 0.12);
    // Vástago y trinquete (móviles)
    piezas.rodE = new Group();
    const l = crearLote();
    l.add(mat.acero, cilindro(fin.clone().addScaledVector(t, -0.2), fin.clone().addScaledVector(t, 0.08), 0.05, 12));
    const pawl = fin.clone().addScaledVector(t, 0.14);
    l.add(mat.oscuro, caja(0.14, 0.22, 0.16, 0, 0, 0, a).translate(pawl.x, pawl.y, pawl.z));
    l.construir(piezas.rodE);
    stage.scene.add(piezas.rodE);
  }

  /**
   * Unidades de mecanizado: una vertical (columna + brazo) y una horizontal (radial)
   * por estación. Las partes fijas se fusionan; los husillos son grupos móviles.
   */
  const HERRAMIENTAS = [
    { est: 'p1', v: 'F', h: 'G', tipo: 'taladro' },
    { est: 'p2', v: 'H', h: 'I', tipo: 'asiento' },
    { est: 'p3', v: 'J', h: 'K', tipo: 'desbarbado' },
  ];
  function geoBroca(tipo, largo) {
    // Broca orientada en +X local desde 0 (punta) hasta `largo`
    const g = [];
    if (tipo === 'taladro') g.push(cilindro(v3(0, 0, 0), v3(largo, 0, 0), 0.028, 10));
    if (tipo === 'asiento')
      g.push(
        cilindro(v3(0, 0, 0), v3(largo * 0.4, 0, 0), 0.03, 10),
        cilindro(v3(largo * 0.4, 0, 0), v3(largo, 0, 0), 0.07, 14)
      );
    if (tipo === 'desbarbado')
      g.push(
        cilindro(v3(0, 0, 0), v3(largo * 0.45, 0, 0), 0.02, 14, 0.1),
        cilindro(v3(largo * 0.45, 0, 0), v3(largo, 0, 0), 0.04, 10)
      );
    return g;
  }
  function crearHerramientas(lote, mat) {
    piezas.herrH = [];
    piezas.herrV = [];
    piezas.brocas = [];
    for (const h of HERRAMIENTAS) {
      const a = ESTACIONES[h.est] * DEG;
      const rot = (g) => g.rotateZ(a);
      const zH = Z_PIEZA + PIEZA.alto / 2;
      // Unidad horizontal (G, I, K)
      lote.add(mat.rojo, rot(caja(0.9, 0.44, 0.44, 3.2, 0, zH)));
      lote.add(mat.oscuro, rot(caja(0.3, 0.46, 0.46, 3.75, 0, zH)), rot(caja(0.08, 0.48, 0.48, 2.73, 0, zH)));
      lote.add(
        mat.estructura,
        rot(caja(0.7, 0.36, zH - 0.22, 3.2, 0, (zH - 0.22) / 2)),
        rot(caja(1.1, 0.7, 0.05, 3.2, 0, 0.025))
      );
      // Unidad vertical (F, H, J): columna, brazo y cabezal
      lote.add(mat.estructura, rot(caja(0.28, 0.28, 3.05, 4.15, 0, 1.525)), rot(caja(0.8, 0.8, 0.06, 4.15, 0, 0.03)));
      lote.add(mat.estructura, rot(caja(2.6, 0.22, 0.2, 2.9, 0, 2.95)));
      lote.add(mat.rojo, rot(caja(0.4, 0.4, 0.42, R_CUNA, 0, 2.66)));
      lote.add(mat.oscuro, rot(cilindro(v3(R_CUNA, 0, 3.05), v3(R_CUNA, 0, 3.4), 0.15, 16)));
      // Finales de carrera (S11 … S22): pares de LED en cada unidad
      const pos = (r, t, z) => [r * Math.cos(a) - t * Math.sin(a), r * Math.sin(a) + t * Math.cos(a), z];
      led(`${h.h}0`, ...pos(3.45, -0.25, zH + 0.1));
      led(`${h.h}1`, ...pos(3.05, -0.25, zH + 0.1));
      led(`${h.v}0`, ...pos(R_CUNA + 0.22, -0.12, 2.8));
      led(`${h.v}1`, ...pos(R_CUNA + 0.22, -0.12, 2.55));

      // Husillo horizontal móvil (eje −radial)
      const gH = new Group();
      gH.rotation.z = a;
      const lh = crearLote();
      const punta = 2.35;
      lh.add(
        mat.acero,
        cilindro(v3(punta + 0.45, 0, zH), v3(punta + 0.8, 0, zH), 0.1, 14),
        cilindro(v3(punta + 0.3, 0, zH), v3(punta + 0.45, 0, zH), 0.07, 12, 0.08)
      );
      lh.construir(gH);
      const brocaH = new Group();
      const lbh = crearLote();
      lbh.add(mat.acero, ...geoBroca(h.tipo, 0.3));
      lbh.construir(brocaH, { sombras: false });
      brocaH.position.set(punta, 0, zH);
      gH.add(brocaH);
      stage.scene.add(gH);
      piezas.herrH.push(gH);
      piezas.brocas.push({ g: brocaH, eje: 'x' });

      // Husillo vertical móvil (eje −Z)
      const gV = new Group();
      gV.rotation.z = a;
      const lv = crearLote();
      const puntaV = 1.85;
      lv.add(
        mat.acero,
        cilindro(v3(R_CUNA, 0, puntaV + 0.45), v3(R_CUNA, 0, puntaV + 0.8), 0.1, 14),
        cilindro(v3(R_CUNA, 0, puntaV + 0.3), v3(R_CUNA, 0, puntaV + 0.45), 0.07, 12, 0.08)
      );
      lv.construir(gV);
      const brocaV = new Group();
      const lbv = crearLote();
      const gb = geoBroca(h.tipo, 0.3).map((g) => g.rotateY(-Math.PI / 2));
      lbv.add(mat.acero, ...gb);
      lbv.construir(brocaV, { sombras: false });
      brocaV.position.set(R_CUNA, 0, puntaV);
      gV.add(brocaV);
      stage.scene.add(gV);
      piezas.herrV.push(gV);
      piezas.brocas.push({ g: brocaV, eje: 'z' });
    }
  }

  function crearGabinete(lote, mat) {
    const x0 = 3.7;
    const y0 = 5.3;
    const yf = y0 - 0.36; // cara frontal (mira hacia −Y)
    lote.add(mat.gabinete, caja(2.4, 0.7, 3.0, x0, y0, 1.7));
    lote.add(mat.oscuro, caja(2.2, 0.03, 1.5, x0, yf - 0.01, 2.35), caja(2.4, 0.5, 0.2, x0, y0, 0.1));
    lote.add(mat.rojo, cilindro(v3(x0 + 0.85, yf, 1.05), v3(x0 + 0.85, yf - 0.12, 1.05), 0.13, 20));
    lote.add(mat.amarillo, cilindro(v3(x0 + 0.85, yf + 0.01, 1.05), v3(x0 + 0.85, yf - 0.02, 1.05), 0.22, 20));
    const entradas = [
      'MARCHA',
      'PARADA',
      'SEL_AUTO',
      'PULSO_MAN',
      'S_CINTA1',
      'REPOS',
      'B1',
      'B2',
      'B3',
      'B4',
      'S1',
      'S2',
      'S3',
      'B5',
      'ESTOP',
      'RT_LUB',
    ];
    const salidas = ['Y1p', 'Y1m', 'Y2p', 'Y2m', 'Y3p', 'Y3m', 'Y4', 'YB', 'KM_LUB', 'H_MARCHA', 'H_PIEZA', 'H_VENT'];
    entradas.forEach((id, i) => led(`i${id}`, x0 - 0.95 + i * 0.125, yf - 0.05, 2.9));
    salidas.forEach((id, i) => led(`q${id}`, x0 - 0.95 + i * 0.125, yf - 0.05, 2.45));
    // Pilotos H_MARCHA, H_PIEZA, H_VENTOSA
    led('pMarcha', x0 - 0.7, yf - 0.06, 1.25, 1.8);
    led('pPieza', x0 - 0.3, yf - 0.06, 1.25, 1.8);
    led('pVent', x0 + 0.1, yf - 0.06, 1.25, 1.8);
    // Baliza de estado
    lote.add(mat.oscuro, cilindro(v3(x0 + 0.95, y0, 3.2), v3(x0 + 0.95, y0, 3.4), 0.06));
    led('verde', x0 + 0.95, y0, 3.48, 2);
    led('ambar', x0 + 0.95, y0, 3.7, 2);
    led('rojo', x0 + 0.95, y0, 3.92, 2);
  }

  /* ──────────────────── Piezas móviles ──────────────────── */
  function crearTransportes(mat) {
    piezas.carros = [];
    for (const [y, color, ids] of [
      [Y_TOMA, mat.azul, ['a0', 'a1']],
      [Y_DEJA, mat.naranja, ['c0', 'c1']],
    ]) {
      const carro = new Group();
      const l = crearLote();
      l.add(mat.oscuro, caja(0.5, 0.34, 0.3, 0, 0, Z_RIEL + 0.3));
      // Cuerpo del cilindro vertical: su longitud cubre toda la carrera del vástago
      l.add(
        color,
        caja(0.36, 0.36, 0.1, 0, 0, Z_RIEL - 0.06),
        cilindro(v3(0, 0, Z_RIEL - 0.1), v3(0, 0, Z_VENTOSA + 0.18), 0.13, 18)
      );
      l.add(mat.oscuro, cilindro(v3(0, 0, Z_VENTOSA + 0.18), v3(0, 0, Z_VENTOSA + 0.12), 0.15));
      l.construir(carro);
      const vastago = new Group();
      const lv = crearLote();
      lv.add(mat.acero, cilindro(v3(0, 0, Z_VENTOSA + 0.08), v3(0, 0, Z_RIEL - 0.15), 0.045, 12));
      lv.add(mat.oscuro, caja(0.22, 0.22, 0.05, 0, 0, Z_VENTOSA + 0.1));
      lv.construir(vastago);
      const ventosa = new Mesh(new CylinderGeometry(0.08, 0.13, 0.08, 20).rotateX(Math.PI / 2), mat.ventosa);
      ventosa.position.z = Z_VENTOSA + 0.04;
      vastago.add(ventosa);
      carro.add(vastago);
      carro.position.y = y;
      stage.scene.add(carro);
      piezas.carros.push({ carro, vastago, ids });
    }
  }

  function crearPiezas(mat) {
    const cuerpo = new BoxGeometry(PIEZA.radial, PIEZA.tang, PIEZA.alto).translate(0, 0, PIEZA.alto / 2);
    const disco = (r) => new CircleGeometry(r, 20);
    const anillo = (r1, r2) => new RingGeometry(r1, r2, 24);
    const top = (g) => g.translate(0, 0, PIEZA.alto + 0.002);
    const lado = (g) => g.rotateY(Math.PI / 2).translate(PIEZA.radial / 2 + 0.002, 0, PIEZA.alto / 2);
    const geo = {
      agujeroT: top(disco(0.05)),
      asientoT: top(anillo(0.05, 0.085)),
      chaflanT: top(anillo(0.085, 0.105)),
      agujeroL: lado(disco(0.04)),
      asientoL: lado(anillo(0.04, 0.07)),
      chaflanL: lado(anillo(0.07, 0.088)),
    };
    piezas.geoPieza = [cuerpo, ...Object.values(geo)];
    piezas.piezas = planta.piezas.map(() => {
      const g = new Group();
      const body = new Mesh(cuerpo, mat.pieza[0]);
      body.castShadow = body.receiveShadow = true;
      const marcas = [
        [new Mesh(geo.agujeroT, mat.agujero), new Mesh(geo.agujeroL, mat.agujero)],
        [new Mesh(geo.asientoT, mat.asiento), new Mesh(geo.asientoL, mat.asiento)],
        [new Mesh(geo.chaflanT, mat.chaflan), new Mesh(geo.chaflanL, mat.chaflan)],
      ];
      g.add(body, ...marcas.flat());
      g.visible = false;
      stage.scene.add(g);
      return { g, body, marcas, nivel: -1 };
    });
  }

  function crearViruta() {
    const N = 180;
    const pos = new Float32Array(N * 3);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    const pts = new Points(
      geo,
      new PointsMaterial({
        color: 0xd9dee8,
        size: 0.05,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      })
    );
    pts.frustumCulled = false;
    stage.scene.add(pts);
    piezas.viruta = { pts, pos, vel: new Float32Array(N * 3), vida: new Float32Array(N), N, siguiente: 0, vivas: 0 };
    for (let i = 0; i < N; i++) pos[i * 3 + 2] = -10;
  }

  /**
   * Rótulos 3D. Se declaran en orden de prioridad: si dos se solapan en pantalla,
   * se oculta el de menor prioridad (ver ordenarRotulos). Se dibujan siempre por
   * encima de la geometría, con contorno del color de fondo, para que ninguna pieza los tape.
   * El estado del PLC no se rotula en 3D: vive en el panel y en la barra de fases.
   */
  function crearEtiquetas() {
    const matGuia = new LineBasicMaterial({ color: stage.theme.axis, transparent: true, opacity: 0.55 });
    piezas.matGuia = matGuia;
    /** Rótulo en (x, y, z); si se da `ancla`, una línea guía lo une con el elemento que nombra. */
    const texto = (cadena, x, y, z, size = 0.24, anchorX = 'center', ancla = null) => {
      const t = stage.makeLabel(cadena, { size, anchorX });
      t.position.set(x, y, z);
      // Material base propio (troika deriva de él su shader SDF): sin prueba de profundidad.
      t.material = new MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false });
      t.renderOrder = 10;
      // Cuando troika termina de maquetar el texto ya se conoce su tamaño: recalcular solapes.
      t.sync(() => {
        rotulosPendientes = true;
        stage.requestRender();
      });
      stage.scene.add(t);
      if (ancla) {
        const g = new BufferGeometry().setFromPoints([v3(x, y, z - size * 0.6), v3(...ancla)]);
        const guia = new Line(g, matGuia);
        guia.renderOrder = 9;
        stage.scene.add(guia);
        t.userData.guia = guia;
      }
      etiquetas.push(t);
      return t;
    };
    const polar = (grados, r, z) => [r * Math.cos(grados * DEG), r * Math.sin(grados * DEG), z];
    // Unidades de mecanizado: rótulo sobre el suelo, por fuera de la unidad horizontal.
    const est = (e, txt) => {
      const g = ESTACIONES[e];
      texto(txt, ...polar(g, 5.5, 0.55), 0.24, 'center', polar(g, 3.75, 0.9));
    };
    est('p1', 'F / G · taladrado');
    est('p2', 'H / I · asiento');
    est('p3', 'J / K · desbarbado');
    // Cubo central: rótulos en el suelo frente a la mesa (sectores libres) con guía hasta el cubo.
    texto('M_LUB · lubricación central', ...polar(234, 3.9, 0.3), 0.22, 'center', [0, 0, Z_MESA + 0.62]);
    texto('Y_BARRIDO · toberas', ...polar(300, 5.7, 0.3), 0.22, 'center', polar(300, 0.7, Z_MESA + 0.5));
    texto('PLC S7-1200', 3.7, 5.3, 3.62, 0.24);
    // Cintas: rótulo en el suelo junto a la banda, sin pisar rodillos ni portal.
    texto('Cinta 1 · alimentación', X_CINTA + 0.75, -5.8, 0.25, 0.26, 'left', [X_CINTA + 0.45, -5.8, Z_PIEZA]);
    texto('Cinta 2 · salida', X_CINTA + 0.75, 3.4, 0.25, 0.26, 'left', [X_CINTA + 0.45, 3.4, Z_PIEZA]);
    texto('T1 · A / B', -6.2, Y_TOMA, Z_RIEL + 0.45, 0.24, 'right');
    texto('T2 · C / D', -6.2, Y_DEJA, Z_RIEL + 0.85, 0.24, 'right');
    texto('E · giro / bloqueo', ...polar(102, 5.4, 0.3), 0.2, 'center', polar(ANG_E - 8, R_MESA + 0.45, Z_MESA - 0.12));
    texto('S_C1', X_CINTA - 1.3, Y_TOMA - 0.6, 0.3, 0.2, 'right', [X_CINTA - 0.58, Y_TOMA, Z_PIEZA + 0.16]);
  }

  /* ──────────── Rótulos sin solapes: desamontonado en el espacio de pantalla ──────────── */
  const camPrevia = new Matrix4();
  let aspectoPrevio = 0;
  let rotulosPendientes = true;
  const esquina = new Vector3();
  function ordenarRotulos() {
    const cam = stage.camera;
    cam.updateMatrixWorld();
    if (!rotulosPendientes && cam.matrixWorld.equals(camPrevia) && cam.aspect === aspectoPrevio) return false;
    camPrevia.copy(cam.matrixWorld);
    aspectoPrevio = cam.aspect;
    rotulosPendientes = false;
    const { width: w, height: h } = stage.renderer.domElement.getBoundingClientRect();
    const ocupados = [];
    let cambio = false;
    for (const t of etiquetas) {
      let visible = params.rotulos;
      const b = t.textRenderInfo?.blockBounds;
      if (visible && b) {
        t.quaternion.copy(cam.quaternion);
        t.updateMatrixWorld();
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        let detras = false;
        for (const [bx, by] of [
          [b[0], b[1]],
          [b[2], b[1]],
          [b[0], b[3]],
          [b[2], b[3]],
        ]) {
          esquina.set(bx, by, 0).applyMatrix4(t.matrixWorld).project(cam);
          if (esquina.z > 1) detras = true;
          const px = ((esquina.x + 1) / 2) * w;
          const py = ((1 - esquina.y) / 2) * h;
          x0 = Math.min(x0, px);
          x1 = Math.max(x1, px);
          y0 = Math.min(y0, py);
          y1 = Math.max(y1, py);
        }
        const r = { x0: x0 - 6, y0: y0 - 4, x1: x1 + 6, y1: y1 + 4 };
        const fuera = detras || r.x0 < 0 || r.x1 > w || r.y0 < 0 || r.y1 > h;
        const choca = ocupados.some((o) => r.x0 < o.x1 && r.x1 > o.x0 && r.y0 < o.y1 && r.y1 > o.y0);
        visible = !fuera && !choca;
        if (visible) ocupados.push(r);
      }
      if (t.visible !== visible) {
        t.visible = visible;
        cambio = true;
      }
      if (t.userData.guia) t.userData.guia.visible = visible;
    }
    return cambio;
  }

  /* ──────────────────── Pose de un cuadro ──────────────────── */
  const tmp = new Vector3();
  let tiempoAux = 0;
  /** Reposo: gris mate. Activo: color saturado con brillo pulsante (lo realza el bloom). */
  function pintarAuxiliar(m, activo, c) {
    if (activo) {
      m.color.set(c.color);
      m.emissive.set(c.emisivo);
      m.emissiveIntensity = 0.75 + 0.35 * Math.sin(tiempoAux * 7);
    } else {
      m.color.set(AUX.reposo);
      m.emissive.set(0x000000);
    }
  }
  function aplicarPose(alfa, dt) {
    const L = (o) => lerp(o.prev, o.u, alfa);
    const ac = suave(L(planta.AC));
    const bd = suave(L(planta.BD));
    const e = suave(L(planta.E));
    const fk = suave(L(planta.FK));
    const ang = lerp(planta.mesa.prev, planta.mesa.ang, alfa);

    piezas.mesa.rotation.z = (ang - ESTACIONES.carga) * DEG;
    // Transportes: T1 va de la cinta 1 a la mesa; T2 de la mesa a la cinta 2
    const [t1, t2] = piezas.carros;
    t1.carro.position.x = lerp(X_CINTA, X_MESA_T, bd);
    t2.carro.position.x = lerp(X_MESA_T, X_CINTA, bd);
    t1.vastago.position.z = t2.vastago.position.z = -CARRERA_AC * ac;
    // E: el vástago avanza 0.35 en sentido antihorario
    piezas.rodE.position.copy(piezas.dirE).multiplyScalar(0.35 * e);
    // Herramientas
    for (const g of piezas.herrH) {
      const a = g.rotation.z;
      g.position.set(-Math.cos(a) * CARRERA_H * fk, -Math.sin(a) * CARRERA_H * fk, 0);
    }
    for (const g of piezas.herrV) g.position.z = -CARRERA_V * fk;
    if (planta.FK.dir > 0 || planta.FK.u > 0) giroHerr += dt * 40;
    for (const b of piezas.brocas) b.g.rotation[b.eje] = giroHerr;
    piezas.lubAnillo.rotation.z += planta.salidas.KM_LUB ? dt * 4 : 0;
    tiempoAux += dt;
    pintarAuxiliar(piezas.mat.lub, planta.salidas.KM_LUB, AUX.lub);
    pintarAuxiliar(piezas.mat.cian, planta.salidas.YB, AUX.barrido);
    piezas.texCinta1.offset.y = -lerp(planta.cinta1.prev, planta.cinta1.offset, alfa) * (6.1 / 0.45);
    piezas.texCinta2.offset.y = -lerp(planta.cinta2.prev, planta.cinta2.offset, alfa) * (6.1 / 0.45);

    const zVent = Z_VENTOSA - CARRERA_AC * ac;
    for (let i = 0; i < planta.piezas.length; i++) {
      const pz = planta.piezas[i];
      const v = piezas.piezas[i];
      if (pz.estado === 'libre') {
        v.g.visible = false;
        continue;
      }
      v.g.visible = true;
      const s = lerp(pz.ps, pz.s, alfa);
      // La ventosa no gira: la pieza conserva la orientación de la cuna de carga o descarga.
      if (pz.estado === 'cinta1' || pz.estado === 'espera') {
        v.g.position.set(X_CINTA, lerp(-6.2, Y_TOMA, s), Z_PIEZA);
        v.g.rotation.z = ESTACIONES.carga * DEG;
      } else if (pz.estado === 'A') {
        v.g.position.set(t1.carro.position.x, Y_TOMA, zVent - PIEZA.alto);
        v.g.rotation.z = ESTACIONES.carga * DEG;
      } else if (pz.estado === 'C') {
        v.g.position.set(t2.carro.position.x, Y_DEJA, zVent - PIEZA.alto);
        v.g.rotation.z = ESTACIONES.descarga * DEG;
      } else if (pz.estado === 'cuna') {
        const a = (ang + pz.cuna * PASO_ANGULAR) * DEG;
        v.g.position.set(R_CUNA * Math.cos(a), R_CUNA * Math.sin(a), Z_PIEZA);
        v.g.rotation.z = a;
      } else if (pz.estado === 'cinta2' || pz.estado === 'saliendo') {
        v.g.position.set(X_CINTA, lerp(Y_DEJA, 6.2, s), Z_PIEZA);
        v.g.rotation.z = ESTACIONES.descarga * DEG;
      }
      const esc = Math.max(0.001, lerp(pz.pescala, pz.escala, alfa));
      v.g.scale.setScalar(esc);
      if (v.nivel !== pz.nivel) {
        v.nivel = pz.nivel;
        v.body.material = piezas.mat.pieza[pz.nivel];
        v.marcas.forEach((par, k) => par.forEach((m) => (m.visible = pz.nivel > k)));
      }
    }
  }

  /** Virutas: nacen en las piezas mecanizadas y el barrido las expulsa hacia fuera. */
  function animarViruta(dt) {
    const vr = piezas.viruta;
    const activo = planta.salidas.YB && !pausado;
    if (!activo && vr.vivas === 0) return false;
    if (activo) {
      const corte = planta.FK.u > 0.6;
      const n = Math.ceil(dt * (corte ? 160 : 40));
      for (let k = 0; k < n; k++) {
        const i = vr.siguiente;
        vr.siguiente = (i + 1) % vr.N;
        const est = ['p1', 'p2', 'p3'][Math.floor(Math.random() * 3)];
        const a = ESTACIONES[est] * DEG + (Math.random() - 0.5) * 0.25;
        const r = R_CUNA + (Math.random() - 0.5) * 0.2;
        vr.pos[i * 3] = r * Math.cos(a);
        vr.pos[i * 3 + 1] = r * Math.sin(a);
        vr.pos[i * 3 + 2] = Z_PIEZA + PIEZA.alto + Math.random() * 0.05;
        const v = 1.6 + Math.random() * 1.6;
        vr.vel[i * 3] = Math.cos(a) * v;
        vr.vel[i * 3 + 1] = Math.sin(a) * v;
        vr.vel[i * 3 + 2] = 0.6 + Math.random() * 1.2;
        vr.vida[i] = 0.7 + Math.random() * 0.4;
      }
    }
    let vivas = 0;
    for (let i = 0; i < vr.N; i++) {
      if (vr.vida[i] <= 0) continue;
      vr.vida[i] -= dt;
      vr.vel[i * 3 + 2] -= 5.5 * dt;
      vr.pos[i * 3] += vr.vel[i * 3] * dt;
      vr.pos[i * 3 + 1] += vr.vel[i * 3 + 1] * dt;
      vr.pos[i * 3 + 2] = Math.max(0.02, vr.pos[i * 3 + 2] + vr.vel[i * 3 + 2] * dt);
      if (vr.vida[i] <= 0) vr.pos[i * 3 + 2] = -10;
      else vivas++;
    }
    vr.vivas = vivas;
    vr.pts.geometry.attributes.position.needsUpdate = true;
    return true;
  }

  /* ──────────────────── LED y paneles ──────────────────── */
  function sincronizarLeds() {
    const s = planta.sensores();
    const q = planta.salidas;
    const b = planta.botones;
    const ent = {
      MARCHA: b.MARCHA > 0,
      PARADA: !(b.PARADA > 0),
      SEL_AUTO: planta.selAuto,
      PULSO_MAN: b.PULSO_MAN > 0,
      S_CINTA1: s.S_CINTA1,
      REPOS: b.REPOS > 0,
      B1: s.B1,
      B2: s.B2,
      B3: s.B3,
      B4: s.B4,
      S1: s.S1,
      S2: s.S2,
      S3: s.S3,
      B5: s.B5,
      ESTOP: planta.estop,
      RT_LUB: planta.rtLub,
    };
    for (const k of Object.keys(ent)) fijarLed(`i${k}`, ent[k] ? LED_VERDE : LED_APAGADO);
    const sal = { ...q, H_PIEZA: s.S_CINTA1, H_VENT: planta.V };
    for (const k of Object.keys(sal)) if (ledIdx.has(`q${k}`)) fijarLed(`q${k}`, sal[k] ? LED_AMBAR : LED_APAGADO);
    const campo = {
      a0: s.B1,
      a1: s.B2,
      c0: s.B1,
      c1: s.B2,
      b0: s.B3,
      b1: s.B4,
      d0: s.B3,
      d1: s.B4,
      e0: s.S1,
      e1: s.S2,
      sc1: s.S_CINTA1,
    };
    for (const id of ['F', 'G', 'H', 'I', 'J', 'K']) {
      campo[`${id}0`] = s.S3;
      campo[`${id}1`] = s.B5;
    }
    for (const k of Object.keys(campo)) if (ledIdx.has(k)) fijarLed(k, campo[k] ? LED_VERDE : LED_APAGADO);
    fijarLed('pMarcha', q.H_MARCHA ? LED_VERDE : LED_APAGADO);
    fijarLed('pPieza', s.S_CINTA1 ? LED_AMBAR : LED_APAGADO);
    fijarLed('pVent', planta.V ? LED_MORADO : LED_APAGADO);
    const falla = !planta.estop || !planta.rtLub || planta.M[30];
    fijarLed('verde', planta.M[22] && !pausado ? LED_VERDE : LED_APAGADO);
    fijarLed('ambar', !falla && (pausado || !planta.M[22]) ? LED_AMBAR : LED_APAGADO);
    fijarLed('rojo', falla ? LED_ROJO : LED_APAGADO);
    piezas.leds.instanceColor.needsUpdate = true;
    // Ventosas con brillo propio (M_LUB y barrido se pintan cada cuadro en aplicarPose)
    piezas.mat.ventosa.emissive.set(planta.V ? 0x8a3cff : 0x000000);
  }

  function publicar() {
    const s = planta.sensores();
    const estado = pausado ? 'Simulación en pausa' : planta.estado();
    const gp = planta.etapasGP();
    const gs = planta.etapaGS();
    const fase = planta.fase();
    const activos = Object.entries(s)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(' ');
    const stateEstado =
      !planta.estop || !planta.rtLub || planta.M[30] ? 'inestable' : planta.M[22] && !pausado ? 'estable' : 'marginal';
    const etapaTxt = gp.length ? `GP ${gp.join(' ∥ ')}` : gs && gs !== '36' ? `GS ${gs}` : '—';
    const accion = planta.accion();
    const lista = [
      { label: 'Estado (GEMMA)', value: estado, state: stateEstado },
      { label: 'Etapa activa', value: etapaTxt },
      { label: 'Acción', value: accion },
      { label: 'Fase espacio-fase', value: fase >= 0 ? `${FASES[fase].id.replace('-', ' → ')}` : '—' },
      { label: 'Sensores', value: activos || 'Ninguno' },
      { label: 'V_SUCCION', value: planta.V ? 'Activa (remanente)' : 'Inactiva' },
      { label: 'M_LUB', value: planta.salidas.KM_LUB ? 'Lubricando' : 'Parado' },
      { label: 'Y_BARRIDO', value: planta.salidas.YB ? 'Soplando' : 'Cerrada' },
      { label: 'Ciclos completos', value: String(planta.ciclos) },
      { label: 'Piezas terminadas', value: String(planta.terminadas) },
      { label: 'Último ciclo', value: planta.ultimoCiclo ? `${planta.ultimoCiclo.toFixed(2)} s` : '—' },
    ];
    if (planta.aviso) lista.push({ label: 'Aviso', value: planta.aviso, state: 'marginal' });
    onInfo?.({
      readouts: lista,
      steps: { items: FASES.map((f) => ({ label: f.id.replace('-', '→'), sub: f.movimientos })), active: fase },
      aria: `${estado}. ${accion}. Sensores activos: ${activos || 'ninguno'}.`,
    });
  }

  /* ──────────────────── Rendimiento ──────────────────── */
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
      stage.renderer.shadowMap.enabled = false;
      stage.scene.traverse((o) => o.material && (o.material.needsUpdate = true));
    } else {
      stage.renderer.setPixelRatio(1);
      stage.composer.setPixelRatio(1);
      stage.composer.passes[2].enabled = false; // SMAA (RenderPass, Bloom, SMAA, OutputPass)
      stage.bloom.enabled = false;
    }
    stage.resize();
  }

  function moverCamara(dt) {
    if (!vista) return false;
    const c = stage.camera;
    const t = stage.controls.target;
    const k = 4.5;
    c.position.set(
      damp(c.position.x, vista.pos[0], k, dt),
      damp(c.position.y, vista.pos[1], k, dt),
      damp(c.position.z, vista.pos[2], k, dt)
    );
    t.set(damp(t.x, vista.target[0], k, dt), damp(t.y, vista.target[1], k, dt), damp(t.z, vista.target[2], k, dt));
    stage.controls.update();
    if (c.position.distanceTo(tmp.set(...vista.pos)) < 0.01) vista = null;
    return true;
  }

  function tick(dt) {
    let alfa = 1;
    let mueve = forzarDibujo;
    forzarDibujo = false;
    if (!pausado) {
      acumulado += dt * params.velocidad;
      const n = Math.min(Math.floor(acumulado / PASO), 200);
      if (n > 0) {
        for (let i = 0; i < n; i++) planta.paso();
        acumulado -= n * PASO;
        if (acumulado > PASO) acumulado = 0;
        if (!planta.quieta()) mueve = true;
        const firma = planta.firma();
        if (firma !== firmaPrevia) {
          firmaPrevia = firma;
          sincronizarLeds();
          publicar();
          mueve = true;
        }
      }
      alfa = acumulado / PASO;
    }
    if (animarViruta(pausado ? 0 : dt * params.velocidad)) mueve = true;
    if (moverCamara(dt)) mueve = true;
    if (ordenarRotulos()) mueve = true;
    if (mueve) {
      aplicarPose(alfa, pausado ? 0 : dt * params.velocidad);
      vigilarCalidad(performance.now());
    } else {
      tPrevio = performance.now();
    }
    return mueve;
  }

  /* ──────────────────── Órdenes del panel ──────────────────── */
  const refrescar = () => {
    firmaPrevia = '';
    forzarDibujo = true;
  };
  const acciones = {
    iniciar() {
      pausado = false;
      planta.iniciar();
      refrescar();
    },
    parar() {
      pausado = false;
      planta.parar();
    },
    pulsoManual() {
      pausado = false;
      planta.pulsar('PULSO_MAN');
    },
    reposicion() {
      pausado = false;
      planta.pulsar('REPOS');
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
      planta.reiniciar({ precarga: params.precarga });
      planta.setModo(params.modo === 'auto');
      refrescar();
    },
    emergencia() {
      pausado = false;
      planta.alternarEmergencia();
      refrescar();
    },
    termico() {
      pausado = false;
      planta.alternarTermico();
      refrescar();
    },
    vista(nombre) {
      vista = VISTAS[nombre];
      forzarDibujo = true;
    },
  };

  const onTecla = (e) => {
    const k = e.key;
    if (k === ' ') {
      e.preventDefault();
      acciones.iniciar();
    } else if (k === 'p' || k === 'P') {
      e.preventDefault();
      acciones.pausar();
    } else if (k === '0') {
      e.preventDefault();
      acciones.reiniciar();
    } else if (k === 'e' || k === 'E') {
      e.preventDefault();
      acciones.emergencia();
    } else if (k === 'Escape') {
      acciones.parar();
    }
  };

  function aplicarRotulos() {
    rotulosPendientes = true; // ordenarRotulos() decide la visibilidad de cada uno
    forzarDibujo = true;
  }

  function restyle() {
    const theme = stage.refreshTheme();
    for (const t of etiquetas) {
      t.color = theme.text;
      t.sync(() => {
        rotulosPendientes = true;
        stage.requestRender();
      });
    }
    piezas.matGuia.color.copy(theme.axis);
    pintarSuelo();
    forzarDibujo = true;
  }

  return {
    mount() {
      stage = createStage(container, {
        ariaLabel,
        camera: VISTAS.general.pos,
        target: VISTAS.general.target,
        fov: 40,
        minDistance: 3,
        maxDistance: 30,
        bloom: true,
        shadows: { position: [7, -9, 15], radius: 9.5, target: [-1.5, 0, 0], mapSize: 2048 },
      });
      stage.bloom.strength = 0.35;
      stage.bloom.threshold = 0.9;
      stage.controls.maxPolarAngle = Math.PI * 0.49; // no se mira por debajo del suelo
      stage.controls.addEventListener('start', () => (vista = null));
      planta = createPlanta({ precarga: params.precarga });
      planta.setModo(params.modo === 'auto');
      params.acciones = acciones;

      pmrem = new PMREMGenerator(stage.renderer);
      piezas.entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      stage.scene.environment = piezas.entorno;
      stage.scene.environmentIntensity = 0.45;

      const mat = crearMateriales();
      piezas.mat = mat;
      crearSuelo(mat);
      const lote = crearLote();
      crearCintas(lote, mat);
      crearPedestalMesa(lote, mat);
      crearPortal(lote, mat);
      crearCilindroE(lote, mat);
      crearHerramientas(lote, mat);
      crearGabinete(lote, mat);
      lote.construir(stage.scene);
      crearMesaMovil(mat);
      crearLubricacion(mat);
      crearTransportes(mat);
      crearLeds();
      crearPiezas(mat);
      crearViruta();
      crearEtiquetas();
      aplicarRotulos();

      planta.paso();
      sincronizarLeds();
      firmaPrevia = planta.firma();
      publicar();

      // Compila ahora todos los programas (piezas con sus marcas): sin tirones al primer ciclo.
      for (const v of piezas.piezas) {
        v.g.visible = true;
        v.marcas.flat().forEach((m) => (m.visible = true));
      }
      stage.composer.render(0);
      for (const v of piezas.piezas) v.nivel = -1;
      aplicarPose(1, 0);

      stage.renderer.domElement.addEventListener('keydown', onTecla);
      stage.onTick(tick);
      tPrevio = performance.now();
      stage.start();
    },
    update(p) {
      Object.assign(params, p);
      planta.setModo(params.modo === 'auto');
      aplicarRotulos();
      refrescar();
    },
    resize: () => stage.resize(),
    restyle,
    dispose() {
      if (!stage) return;
      stage.renderer.domElement.removeEventListener('keydown', onTecla);
      piezas.leds?.dispose();
      piezas.geoPieza?.forEach((g) => g.dispose());
      piezas.entorno?.dispose();
      pmrem?.dispose();
      delete params.acciones;
      stage.dispose();
    },
  };
}
