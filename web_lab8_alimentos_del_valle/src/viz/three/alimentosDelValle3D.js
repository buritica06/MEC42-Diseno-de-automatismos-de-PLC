/**
 * Simulación 3D de la estación de dosificación y corte antigoteo de Alimentos Del Valle.
 *
 * Fluidez:
 *  - Lo estático se fusiona en una malla por material; los LED son un único InstancedMesh.
 *  - La lógica avanza a 5 ms fijos y cada cuadro interpola entre los dos últimos barridos.
 *  - El bucle de animación no crea objetos; el panel y el texto 3D solo cambian con un evento discreto.
 *  - Sin movimiento no se dibuja, y la calidad baja una vez si el equipo no sostiene los cuadros.
 */
import {
  BoxGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createStage } from './three-utils.js';
import { createPlanta, ETAPAS, GEOMETRIA, PASO } from './alimentosLogica.js';

export const defaults = { velocidad: 1 };

export const controls = [
  { label: 'Iniciar ciclo', type: 'button', folder: 'Ciclo', action: (p) => p.acciones?.iniciar() },
  { label: 'Pausar ciclo', type: 'button', folder: 'Ciclo', action: (p) => p.acciones?.pausar() },
  { label: 'Reiniciar ciclo', type: 'button', folder: 'Ciclo', action: (p) => p.acciones?.reiniciar() },
  { key: 'velocidad', label: 'Velocidad de simulación', min: 0.25, max: 4, step: 0.25, unit: '×', folder: 'Ciclo' },
  { label: 'STOP: terminar ciclo', type: 'button', folder: 'Pruebas', action: (p) => p.acciones?.parar() },
  { label: 'S0: activar o liberar', type: 'button', folder: 'Pruebas', action: (p) => p.acciones?.emergencia() },
  { label: 'RT1: disparar o rearmar', type: 'button', folder: 'Pruebas', action: (p) => p.acciones?.termico() },
];

const COLORES = {
  estructura: 0x5d6678,
  acero: 0xc4cad4,
  oscuro: 0x2a2e38,
  bandaLateral: 0x3a4150,
  azul: 0x2467c4,
  verdeAzul: 0x12877a,
  ambar: 0xd77a12,
  rojo: 0xc2323a,
  tolva: 0xd9a066,
  arequipe: 0xb8651b,
  gabinete: 0xd5d8df,
  amarillo: 0xffcc1a,
};
const LED_APAGADO = new Color(0x252832);
const LED_VERDE = new Color(0x2bff7a);
const LED_AMBAR = new Color(0xffb020);
const LED_ROJO = new Color(0xff2e3e);
const LED_AZUL = new Color(0x46b4ff);

const Y_UP = new Vector3(0, 1, 0);
const UNO = new Vector3(1, 1, 1);
const v3 = (x, y, z) => new Vector3(x, y, z);
const DIR_A = v3(Math.SQRT1_2, Math.SQRT1_2, 0);
const Z_BANDA = 0.8;
const Z_MORDAZA = 1.55;
const Z_EXPULSOR = 1.1;
const CARRERA_A = 0.7;
const CARRERA_B = 1.35;

const caja = (w, d, h, x, y, z, rotZ = 0) => {
  const g = new BoxGeometry(w, d, h);
  if (rotZ) g.rotateZ(rotZ);
  g.translate(x, y, z);
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

function helice(radio, paso, vueltas, grosor, eje = 'z') {
  const n = Math.round(vueltas * 14);
  const puntos = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * vueltas * Math.PI * 2;
    const h = t * vueltas * paso;
    puntos.push(
      eje === 'z' ? v3(radio * Math.cos(a), radio * Math.sin(a), h) : v3(radio * Math.cos(a), h, radio * Math.sin(a))
    );
  }
  return new TubeGeometry(new CatmullRomCurve3(puntos), n * 2, grosor, 6, false);
}

/** Agrupa geometrías por material y las fusiona: una llamada de dibujo por material. */
function crearLote() {
  const grupos = new Map();
  return {
    add(material, ...geometrias) {
      if (!grupos.has(material)) grupos.set(material, []);
      grupos.get(material).push(...geometrias);
    },
    construir(padre) {
      for (const [material, geometrias] of grupos) {
        const mesh = new Mesh(mergeGeometries(geometrias, false), material);
        mesh.matrixAutoUpdate = false;
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
  x.fillRect(0, 0, 14, 64);
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}

function texturaSombra() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 6, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.5)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

export function createScene(container, { params, onInfo, ariaLabel }) {
  let stage;
  let planta;
  let pmrem;
  let pausado = false;
  let acumulado = 0;
  let firmaPrevia = -1;
  let terminadosPrevios = -1;
  let forzarDibujo = true;
  let tPrevio = 0;
  let emaMs = 16;
  let lento = 0;
  let nivelCalidad = 0;
  let textoEstado = '';
  const piezas = {};
  const etiquetas = [];

  /* ──────────────────── Materiales ──────────────────── */
  function crearMateriales() {
    const std = (color, metalness, roughness, extra = {}) =>
      new MeshStandardMaterial({ color, metalness, roughness, ...extra });
    const banda = texturaBanda();
    piezas.texBanda = banda;
    piezas.sombra = texturaSombra();
    return {
      estructura: std(COLORES.estructura, 0.55, 0.5),
      acero: std(COLORES.acero, 0.9, 0.28),
      oscuro: std(COLORES.oscuro, 0.4, 0.6),
      lateral: std(COLORES.bandaLateral, 0.5, 0.5),
      banda: std(0xffffff, 0, 0.85, { map: banda }),
      azul: std(COLORES.azul, 0.35, 0.42),
      verdeAzul: std(COLORES.verdeAzul, 0.35, 0.42),
      ambar: std(COLORES.ambar, 0.35, 0.42),
      ambarVidrio: std(COLORES.ambar, 0.1, 0.25, { transparent: true, opacity: 0.32, depthWrite: false }),
      rojo: std(COLORES.rojo, 0.4, 0.42),
      tolva: std(COLORES.tolva, 0.55, 0.42),
      gabinete: std(COLORES.gabinete, 0.3, 0.55),
      amarillo: std(COLORES.amarillo, 0.25, 0.5),
      vidrio: std(0xbfe6f2, 0, 0.08, {
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        side: DoubleSide,
      }),
      arequipe: std(COLORES.arequipe, 0, 0.45),
      nucleo: std(COLORES.arequipe, 0, 0.5, { transparent: true, opacity: 0.6, depthWrite: false }),
      sombra: new MeshBasicMaterial({ map: piezas.sombra, transparent: true, depthWrite: false, toneMapped: false }),
      haz: new MeshBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0.55, depthWrite: false }),
    };
  }

  /* ──────────────────── LED ──────────────────── */
  const ledDefs = [];
  const ledIdx = new Map();
  const led = (id, x, y, z, escala = 1) => {
    ledIdx.set(id, ledDefs.length);
    ledDefs.push({ pos: v3(x, y, z), escala });
  };
  function crearLeds() {
    const m = new InstancedMesh(
      new SphereGeometry(0.055, 10, 8),
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
  function crearBandas(lote, mat) {
    const planoBanda = (largo, x, y, rot) => {
      const g = new PlaneGeometry(largo, 0.9);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) * largo) / 0.45);
      if (rot) g.rotateZ(rot);
      g.translate(x, y, Z_BANDA);
      return g;
    };
    // Banda de entrada (+X) y de salida (−Y)
    lote.add(mat.banda, planoBanda(7.1, -4.05, 0, 0), planoBanda(6.3, 0, -3.65, -Math.PI / 2));
    const lat = [
      caja(7.1, 0.08, 0.34, -4.05, 0.49, Z_BANDA - 0.13),
      caja(7.1, 0.08, 0.34, -4.05, -0.49, Z_BANDA - 0.13),
      caja(0.08, 6.3, 0.34, 0.49, -3.65, Z_BANDA - 0.13),
      caja(0.08, 6.3, 0.34, -0.49, -3.65, Z_BANDA - 0.13),
      caja(7.1, 0.9, 0.2, -4.05, 0, Z_BANDA - 0.13),
      caja(0.9, 6.3, 0.2, 0, -3.65, Z_BANDA - 0.13),
    ];
    lote.add(mat.lateral, ...lat);
    const patas = [];
    for (const x of [-7.2, -4.6, -2, -0.6]) {
      for (const y of [-0.42, 0.42]) patas.push(caja(0.1, 0.1, 0.6, x, y, 0.3));
    }
    for (const y of [-6.4, -4.2, -2]) {
      for (const x of [-0.42, 0.42]) patas.push(caja(0.1, 0.1, 0.6, x, y, 0.3));
    }
    lote.add(mat.estructura, ...patas);
    // Guías laterales
    lote.add(
      mat.acero,
      caja(6.8, 0.03, 0.05, -4.05, 0.42, Z_BANDA + 0.24),
      caja(6.8, 0.03, 0.05, -4.05, -0.42, Z_BANDA + 0.24),
      caja(0.03, 3.9, 0.05, 0.42, -3.25, Z_BANDA + 0.24),
      caja(0.03, 3.9, 0.05, -0.42, -3.25, Z_BANDA + 0.24),
      // Placa de la cuna
      caja(1, 1, 0.12, 0, 0, Z_BANDA - 0.06)
    );
    // Túneles de alimentación y de la tapadora
    const tunel = (x, y, ejeX) => {
      const w = ejeX ? 1.3 : 1.45;
      const d = ejeX ? 1.45 : 1.3;
      const lado = 0.12;
      const h = 1.65;
      return ejeX
        ? [
            caja(w, lado, h, x, y + 0.66, h / 2),
            caja(w, lado, h, x, y - 0.66, h / 2),
            caja(w, d, lado, x, y, h + lado / 2),
          ]
        : [
            caja(lado, d, h, x + 0.66, y, h / 2),
            caja(lado, d, h, x - 0.66, y, h / 2),
            caja(w, d, lado, x, y, h + lado / 2),
          ];
    };
    lote.add(mat.gabinete, ...tunel(-7.3, 0, true), ...tunel(0, -6.2, false));
    lote.add(mat.amarillo, caja(1.47, 1.32, 0.05, 0, -6.2, 1.8));
  }

  function crearCuna(lote, mat) {
    const zc = Z_MORDAZA;
    const r = GEOMETRIA.radioFrasco + 0.04;
    lote.add(mat.azul, caja(0.07, 0.62, 0.5, r, 0.14, zc), caja(0.62, 0.07, 0.5, 0.14, r, zc));
    lote.add(
      mat.estructura,
      caja(0.11, 0.11, 1.75, 0.63, 0.63, 0.88),
      caja(0.4, 0.09, 0.12, 0.46, 0.46, zc, Math.PI / 4)
    );
  }

  function crearCilindros(lote, mat) {
    // A: cuerpo en diagonal sobre un pedestal
    const aIni = DIR_A.clone().multiplyScalar(-1.85).setZ(Z_MORDAZA);
    const aFin = DIR_A.clone().multiplyScalar(-3.4).setZ(Z_MORDAZA);
    lote.add(mat.azul, cilindro(aIni, aFin, 0.24));
    lote.add(
      mat.oscuro,
      cilindro(aIni, aIni.clone().addScaledVector(DIR_A, -0.1), 0.27),
      cilindro(aFin, aFin.clone().addScaledVector(DIR_A, 0.1), 0.27)
    );
    const baseA = DIR_A.clone().multiplyScalar(-2.65);
    lote.add(
      mat.estructura,
      caja(0.28, 0.28, 1.34, baseA.x, baseA.y, 0.67),
      caja(0.8, 0.8, 0.06, baseA.x, baseA.y, 0.03)
    );
    const perp = v3(-Math.SQRT1_2, Math.SQRT1_2, 0);
    for (const [id, d] of [
      ['fa0', 3.15],
      ['fa1', 2.15],
    ]) {
      const c = DIR_A.clone().multiplyScalar(-d).addScaledVector(perp, 0.27).setZ(Z_MORDAZA);
      lote.add(mat.oscuro, caja(0.1, 0.2, 0.08, c.x, c.y, c.z, Math.PI / 4));
      led(id, c.x, c.y, c.z + 0.07);
    }

    // C: cuerpo translúcido para ver el resorte de retorno
    lote.add(mat.ambarVidrio, cilindro(v3(0, 1.85, Z_EXPULSOR), v3(0, 3.4, Z_EXPULSOR), 0.24));
    lote.add(
      mat.oscuro,
      cilindro(v3(0, 1.85, Z_EXPULSOR), v3(0, 1.95, Z_EXPULSOR), 0.27),
      cilindro(v3(0, 3.3, Z_EXPULSOR), v3(0, 3.4, Z_EXPULSOR), 0.27),
      caja(0.1, 0.2, 0.08, 0.27, 3.05, Z_EXPULSOR)
    );
    lote.add(mat.estructura, caja(0.26, 0.26, 0.82, 0, 2.65, 0.41), caja(0.8, 0.8, 0.06, 0, 2.65, 0.03));
    led('fc0', 0.27, 3.05, Z_EXPULSOR + 0.07);

    // B: cuerpo vertical sobre columna
    lote.add(mat.verdeAzul, cilindro(v3(2.5, 0, 4.1), v3(2.5, 0, 6.6), 0.32));
    lote.add(
      mat.oscuro,
      cilindro(v3(2.5, 0, 4.1), v3(2.5, 0, 4.2), 0.35),
      cilindro(v3(2.5, 0, 6.5), v3(2.5, 0, 6.6), 0.35)
    );
    lote.add(
      mat.estructura,
      caja(0.3, 0.3, 6.9, 3.2, 0, 3.45),
      caja(1.1, 1.1, 0.08, 3.2, 0, 0.04),
      caja(0.76, 0.16, 0.2, 2.86, 0, 6.2),
      caja(0.76, 0.16, 0.2, 2.86, 0, 4.5)
    );
    for (const [id, z] of [
      ['fb0', 6.15],
      ['fb1', 4.7],
    ]) {
      lote.add(mat.oscuro, caja(0.08, 0.1, 0.2, 2.5, -0.33, z));
      led(id, 2.5, -0.39, z);
    }
  }

  function crearSensorOptico(lote, mat) {
    const zs = Z_BANDA + 0.32;
    lote.add(mat.amarillo, caja(0.2, 0.2, 0.26, 1.25, -1.25, zs));
    lote.add(mat.estructura, caja(0.08, 0.08, zs, 1.25, -1.25, zs / 2));
    lote.add(mat.oscuro, caja(0.04, 0.26, 0.26, -1.1, 1.1, zs, Math.PI / 4));
    lote.add(mat.estructura, caja(0.08, 0.08, zs, -1.1, 1.1, zs / 2));
    led('fs', 1.25, -1.25, zs + 0.17);
    const haz = new Mesh(cilindro(v3(-1.08, 1.08, zs), v3(1.14, -1.14, zs), 0.012, 6), mat.haz);
    haz.matrixAutoUpdate = false;
    stage.scene.add(haz);
  }

  function crearGabinete(lote, mat) {
    const x0 = 5.2;
    const y0 = 2.3;
    lote.add(mat.gabinete, caja(2.1, 0.7, 3.1, x0, y0, 1.75));
    lote.add(mat.oscuro, caja(1.9, 0.03, 1.5, x0, y0 - 0.365, 2.45), caja(2.1, 0.5, 0.2, x0, y0, 0.1));
    const entradas = ['START', 'STOP', 'SFRASCO', 'a0', 'a1', 'b0', 'b1', 'c0', 'RT1', 'ESTOP', 'RESET'];
    const salidas = ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'KM1', 'KM2'];
    entradas.forEach((id, i) => led(`i${id}`, x0 - 0.8 + i * 0.16, y0 - 0.39, 2.85));
    salidas.forEach((id, i) => led(`q${id}`, x0 - 0.8 + i * 0.16, y0 - 0.39, 2.3));
    // Baliza
    lote.add(mat.oscuro, cilindro(v3(x0 + 0.7, y0, 3.3), v3(x0 + 0.7, y0, 3.5), 0.06));
    led('verde', x0 + 0.7, y0, 3.58, 2);
    led('ambar', x0 + 0.7, y0, 3.8, 2);
    led('rojo', x0 + 0.7, y0, 4.02, 2);
    // Terminal de válvulas con Y1 a Y5
    const xv = 2.6;
    const yv = 3.4;
    lote.add(mat.estructura, caja(1.5, 0.3, 0.1, xv, yv, 0.95), caja(0.2, 0.2, 0.9, xv, yv, 0.45));
    ['Y1', 'Y2', 'Y3', 'Y4', 'Y5'].forEach((id, i) => {
      const x = xv - 0.56 + i * 0.28;
      lote.add(mat.oscuro, caja(0.22, 0.26, 0.24, x, yv, 1.12));
      led(`v${id}`, x, yv - 0.15, 1.2);
    });
    // Mangueras
    const tubo = (...p) => new TubeGeometry(new CatmullRomCurve3(p), 28, 0.022, 6, false);
    const a = DIR_A.clone()
      .multiplyScalar(-3.3)
      .setZ(Z_MORDAZA + 0.22);
    lote.add(
      mat.azul,
      tubo(v3(xv - 0.56, yv, 1.24), v3(xv - 0.8, yv + 0.8, 1.05), v3(-1.2, 4.1, 0.9), v3(a.x - 1, a.y + 2.3, 1.05), a)
    );
    lote.add(
      mat.verdeAzul,
      tubo(v3(xv, yv, 1.24), v3(xv + 0.4, yv - 1.2, 3.4), v3(2.75, 0.6, 5.2), v3(2.72, 0.2, 6.3))
    );
    lote.add(
      mat.ambar,
      tubo(v3(xv + 0.56, yv, 1.24), v3(xv - 0.3, yv + 0.8, 1.35), v3(0.5, 3.8, 1.3), v3(0, 3.42, Z_EXPULSOR))
    );
  }

  /* ──────────────────── Piezas móviles ──────────────────── */
  function crearMoviles(mat) {
    // Mordaza A: la posición local corresponde a la mordaza cerrada.
    piezas.rodA = new Group();
    let lote = crearLote();
    const cara = -(GEOMETRIA.radioFrasco + 0.06);
    const pj = DIR_A.clone().multiplyScalar(cara).setZ(Z_MORDAZA);
    lote.add(mat.azul, caja(0.1, 0.6, 0.5, pj.x, pj.y, pj.z, Math.PI / 4));
    lote.add(
      mat.acero,
      cilindro(
        pj,
        DIR_A.clone()
          .multiplyScalar(cara - 1.44)
          .setZ(Z_MORDAZA),
        0.07
      )
    );
    lote.construir(piezas.rodA);

    // Expulsor C: resorte, pistón, vástago y placa
    piezas.rodC = new Group();
    lote = crearLote();
    const y0 = GEOMETRIA.caraPusher;
    lote.add(mat.ambar, caja(0.6, 0.08, 0.44, 0, y0 + 0.04, Z_EXPULSOR));
    lote.add(mat.acero, cilindro(v3(0, y0 + 0.08, Z_EXPULSOR), v3(0, y0 + 2.85, Z_EXPULSOR), 0.06));
    lote.add(mat.oscuro, cilindro(v3(0, y0 + 2.75, Z_EXPULSOR), v3(0, y0 + 2.85, Z_EXPULSOR), 0.21));
    lote.construir(piezas.rodC);
    piezas.resorte = new Mesh(helice(0.17, 0.1, 10, 0.016, 'y'), mat.acero);
    piezas.resorte.position.set(0, 1.85, Z_EXPULSOR);

    // Cabezal: lo mueve B y lleva vástago, brazo, tolva, tubo, motor y husillo.
    piezas.cabezal = new Group();
    lote = crearLote();
    lote.add(mat.acero, cilindro(v3(2.5, 0, 3.85), v3(2.5, 0, 5.45), 0.09));
    lote.add(mat.estructura, caja(2.5, 0.2, 0.18, 1.25, 0, 3.85), caja(0.45, 0.45, 0.2, 0, 0, 3.85));
    lote.add(mat.tolva, cilindro(v3(0, 0, 3.95), v3(0, 0, 5.35), 0.27, 24, 1.2));
    lote.add(
      mat.oscuro,
      cilindro(v3(0, 0, 5.32), v3(0, 0, 5.38), 1.22, 24),
      cilindro(v3(0, 0, 2.25), v3(0, 0, 2.42), 0.1, 14, 0.2)
    );
    lote.add(mat.rojo, cilindro(v3(0, 0, 5.38), v3(0, 0, 6.1), 0.4, 20));
    const aletas = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI;
      aletas.push(caja(0.88, 0.022, 0.62, 0, 0, 5.74, a));
    }
    lote.add(mat.oscuro, ...aletas);
    lote.add(mat.vidrio, cilindro(v3(0, 0, 2.4), v3(0, 0, 3.95), 0.17, 18));
    lote.construir(piezas.cabezal);

    const nucleoGeo = new CylinderGeometry(0.13, 0.13, 1, 14);
    nucleoGeo.rotateX(Math.PI / 2);
    nucleoGeo.translate(0, 0, -0.5);
    piezas.nucleo = new Mesh(nucleoGeo, mat.nucleo);
    piezas.nucleo.position.z = 3.95;
    piezas.nucleo.scale.z = 1.55;
    piezas.nucleo.renderOrder = 1;

    lote = crearLote();
    const hel = helice(0.125, 0.3, 5, 0.022);
    hel.translate(0, 0, 2.42);
    lote.add(mat.acero, hel, cilindro(v3(0, 0, 2.4), v3(0, 0, 3.95), 0.04, 10));
    piezas.husillo = new Group();
    lote.construir(piezas.husillo);

    lote = crearLote();
    const aspas = [];
    for (let i = 0; i < 3; i++) aspas.push(caja(0.72, 0.1, 0.05, 0, 0, 6.2, (i / 3) * Math.PI));
    lote.add(mat.amarillo, ...aspas);
    lote.add(mat.oscuro, cilindro(v3(0, 0, 6.1), v3(0, 0, 6.27), 0.08, 12));
    piezas.ventilador = new Group();
    lote.construir(piezas.ventilador);

    piezas.cabezal.add(piezas.nucleo, piezas.husillo, piezas.ventilador);
    stage.scene.add(piezas.rodA, piezas.rodC, piezas.resorte, piezas.cabezal);

    // Frascos: geometrías y materiales compartidos
    const perfil = [
      [0, 0],
      [0.33, 0],
      [0.35, 0.03],
      [0.35, 0.82],
      [0.27, 0.95],
      [0.27, 1.1],
    ].map(([r, z]) => new Vector2(r, z));
    const vidrioGeo = new LatheGeometry(perfil, 26);
    vidrioGeo.rotateX(Math.PI / 2);
    const llenoGeo = new CylinderGeometry(0.315, 0.315, 1, 22);
    llenoGeo.rotateX(Math.PI / 2);
    llenoGeo.translate(0, 0, 0.5);
    const sombraGeo = new CircleGeometry(0.5, 20);
    piezas.jarras = planta.frascos.map(() => {
      const grupo = new Group();
      const lleno = new Mesh(llenoGeo, mat.arequipe);
      lleno.position.z = 0.03;
      const vidrio = new Mesh(vidrioGeo, mat.vidrio);
      vidrio.renderOrder = 2;
      const sombra = new Mesh(sombraGeo, mat.sombra);
      sombra.position.z = 0.006;
      grupo.add(sombra, lleno, vidrio);
      grupo.visible = false;
      stage.scene.add(grupo);
      return { grupo, lleno };
    });
  }

  function crearEtiquetas() {
    const texto = (cadena, x, y, z, size = 0.2, anchorX = 'center') => {
      const t = stage.makeLabel(cadena, { size, anchorX });
      t.position.set(x, y, z);
      stage.scene.add(t);
      etiquetas.push(t);
      return t;
    };
    const a = DIR_A.clone().multiplyScalar(-2.65);
    texto('Cilindro A · mordaza biestable', a.x - 1.1, a.y - 0.9, 2.05, 0.26);
    texto('Cilindro B · boquilla biestable', 3.2, -0.55, 7.25, 0.26);
    texto('Cilindro C · expulsor con resorte', -0.6, 3.6, 2.05, 0.26, 'right');
    texto('M1 · husillo con inversor KM1/KM2', -1.0, -0.2, 6.5, 0.26, 'right');
    texto('Sensor S_FRASCO', 1.45, -1.45, 1.5, 0.24, 'left');
    texto('Banda de entrada', -4.6, -1, 1.1, 0.26);
    texto('Banda de salida', 0.8, -3.7, 1.1, 0.26, 'left');
    texto('Tapadora', 0, -6.2, 2.2, 0.28);
    texto('PLC y E/S', 4.9, 1.85, 3.7, 0.26);
    texto('Válvulas Y1 a Y5', 2.9, 4.0, 1.7, 0.24, 'left');
    piezas.rotuloEstado = texto('', 0, 2.2, 8.5, 0.5);
    piezas.rotuloEtapa = texto('', 0, 2.2, 7.85, 0.32);
  }

  /* ──────────────────── Animación ──────────────────── */
  function aplicarPose(alfa) {
    const lerp = (a, b) => a + (b - a) * alfa;
    const a = lerp(planta.A.prev, planta.A.x);
    const b = lerp(planta.B.prev, planta.B.x);
    const c = lerp(planta.C.prev, planta.C.x);

    const atrasA = -CARRERA_A * (1 - a);
    piezas.rodA.position.set(DIR_A.x * atrasA, DIR_A.y * atrasA, 0);
    piezas.rodC.position.y = -GEOMETRIA.carreraC * c;
    piezas.resorte.scale.y = Math.max(0.04, 1.37 - GEOMETRIA.carreraC * c);
    piezas.cabezal.position.z = -CARRERA_B * b;

    const giro = -lerp(planta.ptheta, planta.theta); // horario visto desde arriba
    piezas.husillo.rotation.z = giro;
    piezas.ventilador.rotation.z = giro;
    piezas.nucleo.scale.z = 1.55 - 0.45 * lerp(planta.psuccion, planta.succion);
    piezas.texBanda.offset.x = -lerp(planta.pbanda, planta.banda) / 0.45;

    for (let i = 0; i < piezas.jarras.length; i++) {
      const f = planta.frascos[i];
      const j = piezas.jarras[i];
      const visible = f.estado !== 'libre' || f.pescala > 0;
      j.grupo.visible = visible;
      if (!visible) continue;
      j.grupo.position.set(lerp(f.px, f.x), lerp(f.py, f.y), Z_BANDA);
      const s = Math.max(0.001, lerp(f.pescala, f.escala));
      j.grupo.scale.set(s, s, s);
      const nivel = lerp(f.pfill, f.fill);
      j.lleno.visible = nivel > 0.001;
      j.lleno.scale.z = 0.75 * nivel;
    }
  }

  function sincronizarLeds() {
    const s = planta.sensores();
    const entradas = {
      a0: s.a0,
      a1: s.a1,
      b0: s.b0,
      b1: s.b1,
      c0: s.c0,
      SFRASCO: s.sFrasco,
      START: planta.start || planta.auto,
      STOP: true,
      RT1: planta.rt1,
      ESTOP: planta.estop,
      RESET: planta.reset,
    };
    for (const k of Object.keys(entradas)) fijarLed(`i${k}`, entradas[k] ? LED_VERDE : LED_APAGADO);
    fijarLed('fa0', s.a0 ? LED_VERDE : LED_APAGADO);
    fijarLed('fa1', s.a1 ? LED_VERDE : LED_APAGADO);
    fijarLed('fb0', s.b0 ? LED_VERDE : LED_APAGADO);
    fijarLed('fb1', s.b1 ? LED_VERDE : LED_APAGADO);
    fijarLed('fc0', s.c0 ? LED_VERDE : LED_APAGADO);
    fijarLed('fs', s.sFrasco ? LED_VERDE : LED_APAGADO);
    const salidas = {
      Y1: planta.y1,
      Y2: planta.y2,
      Y3: planta.y3,
      Y4: planta.y4,
      Y5: planta.y5,
      KM1: planta.km1,
      KM2: planta.km2,
    };
    for (const k of Object.keys(salidas)) fijarLed(`q${k}`, salidas[k] ? LED_AMBAR : LED_APAGADO);
    for (const k of ['Y1', 'Y2', 'Y3', 'Y4', 'Y5']) fijarLed(`v${k}`, salidas[k] ? LED_AZUL : LED_APAGADO);
    const falla = !planta.estop || !planta.rt1;
    fijarLed('verde', planta.auto && !pausado ? LED_VERDE : LED_APAGADO);
    fijarLed('ambar', !falla && (pausado || !planta.auto) ? LED_AMBAR : LED_APAGADO);
    fijarLed('rojo', falla ? LED_ROJO : LED_APAGADO);
    piezas.leds.instanceColor.needsUpdate = true;
  }

  const describirCil = (c, ext, ret) => (c.x >= 0.99 ? ext : c.x <= 0.01 ? ret : 'En movimiento');

  function publicar() {
    const s = planta.sensores();
    const estado = pausado ? 'Pausado' : planta.estado();
    const etapa = planta.etapa();
    const accion = etapa >= 0 ? ETAPAS[etapa].accion : planta.M[11] ? 'Retorno a origen: Y4 e Y2' : 'Sin ciclo activo';
    const activos = Object.entries({ a0: s.a0, a1: s.a1, b0: s.b0, b1: s.b1, c0: s.c0, S_FRASCO: s.sFrasco })
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(', ');
    const motor = planta.km1 ? 'KM1: giro horario' : planta.km2 ? 'KM2: giro antihorario' : 'Parado';
    const stateEstado = !planta.estop || !planta.rt1 ? 'inestable' : estado === 'Automático' ? 'estable' : 'marginal';
    const textoGS = `${estado}`;
    const textoGP = etapa >= 0 ? `Etapa ${etapa} · ${accion}` : accion;
    if (textoGS + textoGP !== textoEstado) {
      textoEstado = textoGS + textoGP;
      stage.setLabel(piezas.rotuloEstado, textoGS);
      stage.setLabel(piezas.rotuloEtapa, textoGP);
    }
    onInfo?.({
      readouts: [
        { label: 'Estado', value: estado, state: stateEstado },
        { label: 'Etapa GP', value: etapa >= 0 ? String(etapa) : 'Vacío' },
        { label: 'Acción', value: accion },
        { label: 'Sensores activos', value: activos || 'Ninguno' },
        { label: 'Cilindro A', value: describirCil(planta.A, 'Cerrado (a1)', 'Abierto (a0)') },
        { label: 'Cilindro B', value: describirCil(planta.B, 'Abajo (b1)', 'Arriba (b0)') },
        { label: 'Cilindro C', value: describirCil(planta.C, 'Extendido', 'Retraído (c0)') },
        { label: 'Motor M1', value: motor },
        { label: 'Bandas', value: planta.vBanda > 0.01 ? 'En marcha' : 'Detenidas' },
        { label: 'Ciclos completos', value: String(planta.ciclos) },
        { label: 'Frascos en tapadora', value: String(planta.terminados) },
        { label: 'Último ciclo', value: planta.ultimoCiclo ? `${planta.ultimoCiclo.toFixed(1)} s` : '—' },
      ],
      aria: `${estado}. ${accion}. Motor: ${motor}. Sensores activos: ${activos || 'ninguno'}.`,
    });
  }

  /** Baja la carga una sola vez si el equipo no sostiene unos 45 cuadros por segundo. */
  function vigilarCalidad(ahora) {
    const ms = ahora - tPrevio;
    tPrevio = ahora;
    if (ms <= 0 || ms > 200) return;
    emaMs += (ms - emaMs) * 0.05;
    lento = emaMs > 22 ? lento + ms : 0;
    if (lento < 1200 || nivelCalidad >= 2) return;
    lento = 0;
    emaMs = 16;
    nivelCalidad += 1;
    const pr = nivelCalidad === 1 ? Math.min(window.devicePixelRatio, 1.25) : 1;
    stage.renderer.setPixelRatio(pr);
    stage.composer.setPixelRatio(pr);
    // passes[2] es el SMAA de createStage(): RenderPass, Bloom, SMAA, OutputPass.
    if (nivelCalidad === 2) stage.composer.passes[2].enabled = false;
    stage.resize();
  }

  function tick(dt) {
    let alfa = 1;
    let mueve = forzarDibujo;
    forzarDibujo = false;
    if (!pausado) {
      acumulado += dt * params.velocidad;
      const n = Math.min(Math.floor(acumulado / PASO), 200);
      if (n > 0) {
        if (!planta.quieta() || planta.marchaPendiente || planta.estado() !== 'Planta detenida') mueve = true;
        for (let i = 0; i < n; i++) planta.paso();
        acumulado -= n * PASO;
        if (acumulado > PASO) acumulado = 0;
        const firma = planta.firma();
        if (firma !== firmaPrevia || planta.terminados !== terminadosPrevios) {
          firmaPrevia = firma;
          terminadosPrevios = planta.terminados;
          sincronizarLeds();
          publicar();
          mueve = true;
        }
      }
      alfa = acumulado / PASO;
    }
    if (mueve) {
      aplicarPose(alfa);
      vigilarCalidad(performance.now());
    } else {
      tPrevio = performance.now();
    }
    return mueve;
  }

  /* ──────────────────── Órdenes ──────────────────── */
  const acciones = {
    iniciar() {
      pausado = false;
      planta.iniciar();
      firmaPrevia = -1;
      forzarDibujo = true;
    },
    pausar() {
      if (planta.estado() === 'Planta detenida') return;
      pausado = !pausado;
      sincronizarLeds();
      publicar();
      forzarDibujo = true;
    },
    reiniciar() {
      pausado = false;
      acumulado = 0;
      planta.reiniciar();
      firmaPrevia = -1;
      forzarDibujo = true;
    },
    parar() {
      pausado = false;
      planta.parar();
    },
    emergencia() {
      pausado = false;
      planta.alternarEmergencia();
    },
    termico() {
      pausado = false;
      planta.alternarTermico();
    },
  };

  const onTecla = (e) => {
    const k = e.key;
    if (k === ' ') {
      e.preventDefault();
      if (planta.auto && !pausado) acciones.pausar();
      else acciones.iniciar();
    } else if (k === '0') {
      e.preventDefault();
      acciones.reiniciar();
    } else if (k === 'e' || k === 'E') {
      e.preventDefault();
      acciones.emergencia();
    }
  };

  function restyle() {
    const theme = stage.refreshTheme();
    for (const t of etiquetas) t.color = theme.text;
    stage.scene.remove(piezas.rejilla);
    piezas.rejilla.geometry.dispose();
    piezas.rejilla.material.dispose();
    piezas.rejilla = stage.makeGrid(26, 26);
    piezas.rejilla.position.set(0, -1, 0.002);
    stage.scene.add(piezas.rejilla);
    etiquetas.forEach((t) => t.sync(stage.requestRender));
    forzarDibujo = true;
  }

  return {
    mount() {
      stage = createStage(container, {
        ariaLabel,
        camera: [9.9, -11.7, 7.6],
        target: [0, -0.5, 3],
        fov: 40,
        minDistance: 4,
        maxDistance: 34,
      });
      planta = createPlanta();
      params.acciones = acciones;

      pmrem = new PMREMGenerator(stage.renderer);
      piezas.entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      stage.scene.environment = piezas.entorno;
      stage.scene.environmentIntensity = 0.4;

      const mat = crearMateriales();
      piezas.mat = mat;
      const lote = crearLote();
      crearBandas(lote, mat);
      crearCuna(lote, mat);
      crearCilindros(lote, mat);
      crearSensorOptico(lote, mat);
      crearGabinete(lote, mat);
      lote.construir(stage.scene);
      crearLeds();
      crearMoviles(mat);
      crearEtiquetas();

      piezas.rejilla = stage.makeGrid(26, 26);
      piezas.rejilla.position.set(0, -1, 0.002);
      stage.scene.add(piezas.rejilla);

      planta.paso();
      sincronizarLeds();
      firmaPrevia = planta.firma();
      publicar();

      // Compila ahora los programas de los frascos: el primer frasco no provoca un tirón.
      for (const j of piezas.jarras) {
        j.grupo.visible = true;
        j.lleno.visible = true;
      }
      stage.composer.render(0);
      aplicarPose(1);

      canvasEventos(true);
      stage.onTick(tick);
      tPrevio = performance.now();
      stage.start();
    },
    update(p) {
      Object.assign(params, p);
    },
    resize: () => stage.resize(),
    restyle,
    dispose() {
      if (!stage) return;
      canvasEventos(false);
      piezas.leds?.dispose();
      piezas.entorno?.dispose();
      pmrem?.dispose();
      delete params.acciones;
      stage.dispose();
    },
    get renderer() {
      return stage?.renderer;
    },
  };

  function canvasEventos(activar) {
    const c = stage.renderer.domElement;
    if (activar) c.addEventListener('keydown', onTecla);
    else c.removeEventListener('keydown', onTecla);
  }
}
