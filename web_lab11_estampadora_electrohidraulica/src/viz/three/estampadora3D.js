/**
 * Figura 1 en 3D: máquina estampadora electrohidráulica (plano de situación animado).
 *
 * Bastidor en C, carro B sobre guías, mordaza A con manómetro y presostato B7,
 * expulsor C en el foso, motor D con volante excéntrico, biela y troquel,
 * guarda frontal enclavada, central hidráulica y armario del PLC.
 *
 * Fluidez:
 *  - Lo estático se fusiona en una malla por material; los LED son un único InstancedMesh.
 *  - La lógica avanza a 5 ms fijos y cada cuadro interpola entre los dos últimos barridos.
 *  - El bucle de animación no crea objetos; el panel solo cambia con eventos discretos.
 *  - Sin movimiento no se dibuja, y la calidad baja sola si el equipo no sostiene los cuadros.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
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
  ShadowMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createStage } from './three-utils.js';
import { bloque, cilindro, crearLote, crearManguera, texturaManometro, texturaRejilla, tubo, v3 } from './geometria.js';
import { createPlanta, ETAPAS, GEOMETRIA, PASO, T1 } from './estampadoraLogica.js';

export const defaults = {
  velocidad: 1,
  continuo: true,
  fallaB7: false,
  atascoB: false,
  etiquetas: true,
  autoInicio: true,
};

export const controls = [
  { label: 'S1: marcha', type: 'button', folder: 'Ciclo', action: (p) => p.acciones?.marcha() },
  { label: 'Pausar o reanudar', type: 'button', folder: 'Ciclo', action: (p) => p.acciones?.pausar() },
  { label: 'Reiniciar', type: 'button', folder: 'Ciclo', action: (p) => p.acciones?.reiniciar() },
  { key: 'continuo', label: 'Ciclo continuo', type: 'boolean', folder: 'Ciclo' },
  { key: 'velocidad', label: 'Velocidad', min: 0.25, max: 3, step: 0.25, unit: '×', folder: 'Ciclo' },
  { label: 'S0: paro de emergencia', type: 'button', folder: 'Seguridad', action: (p) => p.acciones?.emergencia() },
  { label: 'S2: rearme', type: 'button', folder: 'Seguridad', action: (p) => p.acciones?.rearme() },
  { label: 'Guarda: abrir o cerrar', type: 'button', folder: 'Seguridad', action: (p) => p.acciones?.guarda() },
  { key: 'fallaB7', label: 'Fuga: B7 sin presión', type: 'boolean', folder: 'Fallas' },
  { key: 'atascoB', label: 'Atasco del carro B', type: 'boolean', folder: 'Fallas' },
  { key: 'etiquetas', label: 'Etiquetas', type: 'boolean', folder: 'Vista' },
];

/* ──────────────────── Cotas de la máquina (z arriba, frente = −Y) ──────────────────── */
const Z_BANCADA = 2.2;
const Z_GUIA = 2.35;
const Z_PLATO = 2.6; // asiento de la pieza sobre el carro
const ALTO_PIEZA = 0.45;
const X_TROQUEL = GEOMETRIA.carreraB;
const Z_VOLANTE = 6.4;
const E = GEOMETRIA.excentrica;
const L = GEOMETRIA.biela;
const Z_CRUCETA = Z_VOLANTE + E - L; // punto muerto superior
const Y_BIELA = -0.28;
const CARRERA_GUARDA = 2.3;
const PENDIENTE = 2.0 / 2.45; // rampa de salida
const ANG_RAMPA = -Math.atan(PENDIENTE);
const zRampa = (y) => 3.33 - (y - 1.15) * PENDIENTE;
const ANCLA_MANGUERA = v3(-3.0, 1.8, 4.6);

const LED_APAGADO = new Color(0x252832);
const LED_VERDE = new Color(0x2bff7a);
const LED_AMBAR = new Color(0xffb020);
const LED_ROJO = new Color(0xff2e3e);
const LED_AZUL = new Color(0x46b4ff);

const suave = (t) => {
  const s = Math.min(1, Math.max(0, t));
  return s * s * (3 - 2 * s);
};

export function createScene(container, { params, onInfo, ariaLabel }) {
  let stage;
  let planta;
  let pmrem;
  let sol;
  let pausado = false;
  let acumulado = 0;
  let firmaPrevia = -1;
  let forzarDibujo = true;
  let tPublicar = 0;
  let tPrevio = 0;
  let emaMs = 16;
  let lento = 0;
  let nivelCalidad = 0;
  let textoEstado = '';
  const piezas = {};
  const etiquetas = [];
  const puntoManguera = new Vector3();

  /* ──────────────────── Materiales ──────────────────── */
  function crearMateriales() {
    const std = (color, metalness, roughness, extra = {}) =>
      new MeshStandardMaterial({ color, metalness, roughness, ...extra });
    piezas.texRejilla = texturaRejilla();
    piezas.texRejilla.repeat.set(13, 11.5);
    piezas.texDial = texturaManometro();
    return {
      fundicion: std(0x55607a, 0.45, 0.58),
      carro: std(0x7a86a0, 0.55, 0.45),
      zocalo: std(0x2a2e38, 0.3, 0.7),
      acero: std(0xc8ced8, 0.92, 0.24),
      oscuro: std(0x2a2e38, 0.45, 0.55),
      volante: std(0x3d465a, 0.75, 0.35),
      corredera: std(0x39507f, 0.55, 0.42),
      teal: std(0x12877a, 0.4, 0.4),
      azul: std(0x2467c4, 0.4, 0.4),
      purpura: std(0x8b3fa8, 0.4, 0.4),
      verde: std(0x2f9e4f, 0.4, 0.42),
      rojo: std(0xc2323a, 0.4, 0.4),
      naranja: std(0xe07a1a, 0.2, 0.5),
      amarillo: std(0xffcc1a, 0.25, 0.5),
      gabinete: std(0xd5d8df, 0.3, 0.55),
      tanque: std(0x2f4468, 0.5, 0.45),
      pulsadorVerde: std(0x25a85a, 0.2, 0.4),
      pulsadorAzul: std(0x2a78e0, 0.2, 0.4),
      pieza: std(0xe08a2e, 0.65, 0.38),
      relieve: std(0x6b3d10, 0.8, 0.3),
      dial: std(0xffffff, 0, 0.6, { map: piezas.texDial }),
      rejilla: std(0xffffff, 0.3, 0.5, {
        map: piezas.texRejilla,
        transparent: true,
        alphaTest: 0.5,
        side: DoubleSide,
      }),
      destello: new MeshBasicMaterial({
        color: 0xffb648,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      suelo: new ShadowMaterial({ opacity: 0.2 }),
    };
  }

  /* ──────────────────── LED ──────────────────── */
  const ledDefs = [];
  const ledIdx = new Map();
  const ledsCarro = [];
  const matLed = new Matrix4();
  const quatLed = new Quaternion();
  const posLed = new Vector3();
  const escLed = new Vector3();
  const led = (id, x, y, z, escala = 1, enCarro = false) => {
    ledIdx.set(id, ledDefs.length);
    if (enCarro) ledsCarro.push(ledDefs.length);
    ledDefs.push({ pos: v3(x, y, z), escala });
  };
  function colocarLed(i, dx) {
    const d = ledDefs[i];
    posLed.set(d.pos.x + dx, d.pos.y, d.pos.z);
    escLed.setScalar(d.escala);
    piezas.leds.setMatrixAt(i, matLed.compose(posLed, quatLed, escLed));
  }
  function crearLeds() {
    const m = new InstancedMesh(
      new SphereGeometry(0.05, 12, 8),
      new MeshBasicMaterial({ toneMapped: false }),
      ledDefs.length
    );
    piezas.leds = m;
    ledDefs.forEach((_, i) => {
      colocarLed(i, 0);
      m.setColorAt(i, LED_APAGADO);
    });
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    stage.scene.add(m);
  }
  const fijarLed = (id, color) => piezas.leds.setColorAt(ledIdx.get(id), color);

  /* ──────────────────── Parte fija ──────────────────── */
  function crearBastidor(lote, mat) {
    lote.add(mat.zocalo, bloque(-7.5, 5.9, -1.9, 2.0, 0, 0.12));
    lote.add(
      mat.fundicion,
      // Bancada con foso central abierto al frente (deja ver el expulsor C)
      bloque(-7.2, -0.9, -1.6, 1.6, 0.12, Z_BANCADA),
      bloque(0.9, 4.0, -1.6, 1.6, 0.12, Z_BANCADA),
      bloque(-0.9, 0.9, 0.9, 1.6, 0.12, Z_BANCADA),
      bloque(-0.9, 0.9, -1.6, 0.9, 0.12, 0.25),
      bloque(-0.9, 0.9, -1.6, -0.45, 1.95, Z_BANCADA),
      bloque(-0.9, 0.9, 0.45, 0.9, 1.95, Z_BANCADA),
      // Columna y cabezal: estructura en C
      bloque(4.0, 5.6, -1.6, 1.7, 0.12, 8.0),
      bloque(1.2, 4.0, 0.3, 1.7, 4.0, 8.0)
    );
    lote.add(
      mat.acero,
      // Guías prismáticas del carro
      bloque(-3.3, 3.9, -1.0, -0.7, Z_BANCADA, Z_GUIA),
      bloque(-3.3, 3.9, 0.7, 1.0, Z_BANCADA, Z_GUIA),
      // Guías verticales de la corredera del troquel
      bloque(X_TROQUEL - 0.75, X_TROQUEL - 0.5, -0.2, 0.3, 3.95, 5.5),
      bloque(X_TROQUEL + 0.5, X_TROQUEL + 0.75, -0.2, 0.3, 3.95, 5.5)
    );
    lote.add(mat.oscuro, cilindro(v3(X_TROQUEL, 0.3, Z_VOLANTE), v3(X_TROQUEL, 0.27, Z_VOLANTE), 0.34, 28));
  }

  function crearCilindroB(lote, mat) {
    lote.add(mat.azul, cilindro(v3(-6.7, 0, 2.85), v3(-3.9, 0, 2.85), 0.3, 28));
    lote.add(
      mat.oscuro,
      bloque(-6.85, -6.7, -0.42, 0.42, Z_BANCADA, 3.27),
      bloque(-3.9, -3.75, -0.42, 0.42, Z_BANCADA, 3.27),
      // Finales de carrera B3 y B4 junto a la guía
      bloque(-2.7, -2.5, -1.45, -1.25, Z_BANCADA, 2.42),
      bloque(-0.1, 0.1, -1.45, -1.25, Z_BANCADA, 2.42)
    );
    led('fB3', -2.6, -1.35, 2.48);
    led('fB4', 0, -1.35, 2.48);
  }

  function crearExpulsor(lote, mat) {
    lote.add(mat.purpura, cilindro(v3(0, 0, 0.35), v3(0, 0, 1.85), 0.3, 28));
    lote.add(
      mat.oscuro,
      cilindro(v3(0, 0, 0.25), v3(0, 0, 0.35), 0.36, 28),
      cilindro(v3(0, 0, 1.85), v3(0, 0, 1.95), 0.36, 28),
      bloque(-0.08, 0.08, -0.42, -0.3, 0.5, 0.7),
      bloque(-0.08, 0.08, -0.42, -0.3, 1.5, 1.7)
    );
    led('fB5', 0, -0.46, 0.6);
    led('fB6', 0, -0.46, 1.6);
  }

  function crearSalida(lote, mat) {
    const largo = Math.hypot(2.45, 2.0);
    const pieza = (ancho, grosor, dx, dn) => {
      const g = new BoxGeometry(ancho, largo, grosor);
      g.translate(dx, 0, dn);
      g.rotateX(ANG_RAMPA);
      g.translate(0, 2.375, 2.3);
      return g;
    };
    lote.add(mat.acero, pieza(1.1, 0.05, 0, 0), pieza(0.05, 0.2, 0.575, 0.1), pieza(0.05, 0.2, -0.575, 0.1));
    lote.add(
      mat.fundicion,
      bloque(-0.5, -0.4, 1.7, 1.8, 0.12, 2.8),
      bloque(0.4, 0.5, 1.7, 1.8, 0.12, 2.8),
      bloque(-0.5, -0.4, 3.35, 3.45, 0.12, 1.45),
      bloque(0.4, 0.5, 3.35, 3.45, 0.12, 1.45)
    );
    // Contenedor de piezas terminadas
    lote.add(
      mat.tanque,
      bloque(-0.85, 0.85, 3.7, 5.1, 0, 0.06),
      bloque(-0.85, -0.79, 3.7, 5.1, 0.06, 0.9),
      bloque(0.79, 0.85, 3.7, 5.1, 0.06, 0.9),
      bloque(-0.79, 0.79, 3.7, 3.76, 0.06, 0.9),
      bloque(-0.79, 0.79, 5.04, 5.1, 0.06, 0.9)
    );
  }

  function crearMotor(lote, mat) {
    const eje = (y0, y1, r, seg = 28) => cilindro(v3(X_TROQUEL, y0, Z_VOLANTE), v3(X_TROQUEL, y1, Z_VOLANTE), r, seg);
    lote.add(mat.verde, eje(1.7, 2.9, 0.58));
    const aletas = [];
    for (let i = 0; i < 6; i++) aletas.push(eje(1.85 + i * 0.18, 1.9 + i * 0.18, 0.66));
    lote.add(mat.oscuro, ...aletas, eje(2.9, 3.0, 0.5), bloque(X_TROQUEL - 0.2, X_TROQUEL + 0.2, 2.1, 2.5, 6.95, 7.12));
  }

  function crearGuardaFija(lote, mat) {
    lote.add(
      mat.fundicion,
      bloque(1.18, 1.3, -1.46, -1.34, Z_BANCADA, 7.0),
      bloque(3.9, 4.02, -1.46, -1.34, Z_BANCADA, 7.0)
    );
    lote.add(mat.oscuro, bloque(1.05, 1.18, -1.5, -1.36, 2.3, 2.5));
    led('fG', 1.11, -1.54, 2.4);
  }

  function crearBotonera(lote, mat) {
    lote.add(mat.oscuro, bloque(-6.0, -4.4, -1.68, -1.6, 1.0, 1.8));
    lote.add(mat.pulsadorVerde, cilindro(v3(-5.6, -1.68, 1.4), v3(-5.6, -1.77, 1.4), 0.12, 20));
    lote.add(mat.pulsadorAzul, cilindro(v3(-4.8, -1.68, 1.4), v3(-4.8, -1.77, 1.4), 0.12, 20));
    lote.add(mat.amarillo, cilindro(v3(-5.2, -1.68, 1.4), v3(-5.2, -1.71, 1.4), 0.24, 24));
  }

  function crearCentral(lote, mat) {
    lote.add(mat.tanque, bloque(-6.6, -3.6, 2.6, 4.4, 0.15, 1.5));
    lote.add(
      mat.oscuro,
      bloque(-6.5, -6.3, 2.7, 4.3, 0, 0.15),
      bloque(-3.9, -3.7, 2.7, 4.3, 0, 0.15),
      cilindro(v3(-5.1, 3.6, 1.95), v3(-4.75, 3.6, 1.95), 0.26),
      bloque(-6.1, -4.8, 3.3, 3.9, 1.5, 1.6)
    );
    lote.add(mat.gabinete, cilindro(v3(-6.2, 3.6, 1.95), v3(-5.1, 3.6, 1.95), 0.36, 24));
    lote.add(mat.acero, bloque(-4.55, -3.7, 2.72, 3.4, 1.5, 1.72));
    lote.add(mat.amarillo, bloque(-4.55, -4.35, 3.45, 3.7, 1.5, 1.9)); // válvula reductora
    // Electroválvulas: Y1 (4/2 monoestable), Y2-Y3 (4/3), Y4-Y5 (4/2 biestable), Y6 (3/2)
    const xs = [-4.4, -4.2, -4.0, -3.8];
    xs.forEach((x) => lote.add(mat.oscuro, bloque(x - 0.08, x + 0.08, 2.78, 3.34, 1.72, 1.94)));
    led('vY1', xs[0], 2.75, 1.86);
    led('vY2', xs[1], 2.75, 1.86);
    led('vY3', xs[1], 3.37, 1.86);
    led('vY4', xs[2], 2.75, 1.86);
    led('vY5', xs[2], 3.37, 1.86);
    led('vY6', xs[3], 2.75, 1.86);

    // Red de alta presión (roja) hasta el mástil de la manguera de A
    lote.add(mat.fundicion, bloque(-3.06, -2.94, 1.74, 1.86, 0.12, 4.6));
    lote.add(
      mat.rojo,
      tubo([v3(xs[0], 3.1, 1.94), v3(xs[0], 3.0, 2.5), v3(-3.6, 2.4, 3.5), v3(-3.05, 1.9, 4.4), ANCLA_MANGUERA])
    );
    // Red reducida (naranja) hacia B, C y D
    lote.add(
      mat.naranja,
      tubo([v3(xs[1], 3.1, 1.94), v3(xs[1], 2.5, 2.7), v3(-4.7, 1.2, 3.5), v3(-4.7, 0.2, 3.3), v3(-4.7, 0, 3.12)]),
      tubo([v3(xs[2], 3.1, 1.94), v3(-3.5, 2.6, 1.5), v3(-1.6, 2.2, 0.7), v3(-0.3, 1.9, 0.55), v3(0, 1.58, 0.55)]),
      tubo(
        [
          v3(xs[3], 3.1, 1.94),
          v3(-3.3, 4.0, 1.6),
          v3(-3.0, 5.2, 0.25),
          v3(0, 5.5, 0.18),
          v3(3.6, 5.3, 0.18),
          v3(4.9, 3.4, 0.2),
          v3(4.9, 1.82, 1.4),
          v3(4.9, 1.82, 6.6),
          v3(4.2, 2.2, 7.5),
          v3(3.0, 2.3, 7.5),
          v3(X_TROQUEL, 2.3, 7.12),
        ],
        0.04
      )
    );
  }

  function crearArmario(lote, mat) {
    // Al frente y a la derecha: queda a la vista desde la cámara inicial.
    const x0 = 6.3;
    const y0 = -2.0;
    lote.add(mat.gabinete, bloque(x0, x0 + 1.6, y0, y0 + 0.8, 0, 3.3));
    lote.add(
      mat.oscuro,
      bloque(x0 + 0.12, x0 + 1.48, y0 - 0.04, y0, 1.9, 3.12),
      bloque(x0, x0 + 1.6, y0 - 0.05, y0 + 0.85, 0, 0.14)
    );
    const entradas = ['S0', 'S1', 'S2', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'G'];
    const salidas = ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'];
    entradas.forEach((id, i) => led(`i${id}`, x0 + 0.25 + i * 0.11, y0 - 0.06, 2.85));
    salidas.forEach((id, i) => led(`q${id}`, x0 + 0.25 + i * 0.11, y0 - 0.06, 2.4));
    // Baliza
    lote.add(mat.oscuro, cilindro(v3(x0 + 1.3, y0 + 0.4, 3.3), v3(x0 + 1.3, y0 + 0.4, 3.5), 0.06));
    led('verde', x0 + 1.3, y0 + 0.4, 3.58, 2.2);
    led('ambar', x0 + 1.3, y0 + 0.4, 3.8, 2.2);
    led('rojo', x0 + 1.3, y0 + 0.4, 4.02, 2.2);
  }

  /* ──────────────────── Partes móviles ──────────────────── */
  function crearCarro(mat) {
    const carro = new Group();
    let lote = crearLote();
    lote.add(
      mat.carro,
      // Plato con ventana para el paso del expulsor
      bloque(-2.6, -0.3, -1.1, 1.1, Z_GUIA, Z_PLATO),
      bloque(-0.3, 0.75, 0.3, 1.1, Z_GUIA, Z_PLATO),
      bloque(-0.3, 0.75, -1.1, -0.3, Z_GUIA, Z_PLATO),
      bloque(0.3, 0.75, -0.3, 0.3, Z_GUIA, Z_PLATO),
      bloque(-2.6, -2.45, -0.25, 0.25, Z_PLATO, 3.1)
    );
    lote.add(
      mat.oscuro,
      bloque(0.3, 0.6, -0.55, 0.55, Z_PLATO, 3.3), // tope fijo
      bloque(-2.32, -2.2, -0.32, 0.32, Z_PLATO, 3.3),
      bloque(-1.3, -1.18, -0.32, 0.32, Z_PLATO, 3.3),
      bloque(-2.15, -2.0, -0.31, -0.22, 2.92, 3.04), // B1
      bloque(-1.5, -1.35, -0.31, -0.22, 2.92, 3.04), // B2
      bloque(-1.55, -1.35, -0.1, 0.1, 3.2, 3.45), // presostato B7
      cilindro(v3(-1.9, 0.06, 3.62), v3(-1.9, -0.04, 3.62), 0.22, 28) // caja del manómetro
    );
    lote.add(mat.teal, cilindro(v3(-2.2, 0, 2.98), v3(-1.3, 0, 2.98), 0.24, 28));
    lote.add(
      mat.acero,
      cilindro(v3(-6.6, 0, 2.85), v3(-2.6, 0, 2.85), 0.09), // vástago de B
      cilindro(v3(-1.9, 0, 3.2), v3(-1.9, 0, 3.42), 0.04, 10)
    );
    lote.construir(carro);
    led('fB1', -2.07, -0.34, 2.98, 1, true);
    led('fB2', -1.42, -0.34, 2.98, 1, true);
    led('fB7', -1.45, -0.14, 3.38, 1, true);

    // Manómetro: carátula fija y aguja que sigue la presión de sujeción
    const caratula = new CircleGeometry(0.2, 28);
    caratula.rotateX(Math.PI / 2);
    const dial = new Mesh(caratula, mat.dial);
    dial.position.set(-1.9, -0.045, 3.62);
    const aguja = new Mesh(new BoxGeometry(0.024, 0.012, 0.17).translate(0, 0, 0.065), mat.rojo);
    aguja.position.set(-1.9, -0.058, 3.62);
    piezas.aguja = aguja;
    carro.add(dial, aguja);

    // Mordaza de A (posición local = abierta)
    piezas.rodA = new Group();
    lote = crearLote();
    lote.add(mat.acero, cilindro(v3(-2.0, 0, 2.98), v3(-0.95, 0, 2.98), 0.07));
    lote.add(mat.teal, bloque(-0.95, -0.75, -0.5, 0.5, Z_PLATO + 0.02, 3.3));
    lote.construir(piezas.rodA);
    carro.add(piezas.rodA);

    piezas.carro = carro;
    stage.scene.add(carro);

    // Manguera flexible de alta presión hacia A
    piezas.manguera = crearManguera(mat.rojo, { radio: 0.05, caida: -0.15 });
    stage.scene.add(piezas.manguera.mesh);
  }

  function crearExpulsorMovil(mat) {
    piezas.rodC = new Group();
    const lote = crearLote();
    lote.add(mat.acero, cilindro(v3(0, 0, 0.6), v3(0, 0, 2.2), 0.09));
    lote.add(mat.purpura, bloque(-0.25, 0.25, -0.25, 0.25, 2.2, 2.3));
    lote.construir(piezas.rodC);
    stage.scene.add(piezas.rodC);
  }

  function crearTroquel(mat) {
    // Volante con muñequilla excéntrica y contrapeso (hace visible el giro)
    piezas.volante = new Group();
    let lote = crearLote();
    lote.add(mat.volante, cilindro(v3(0, 0.08, 0), v3(0, 0.26, 0), 0.85, 48));
    const huecos = [];
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      huecos.push(
        cilindro(v3(0.5 * Math.cos(a), 0.085, 0.5 * Math.sin(a)), v3(0.5 * Math.cos(a), 0.07, 0.5 * Math.sin(a)), 0.15)
      );
    }
    lote.add(mat.oscuro, ...huecos);
    lote.add(
      mat.acero,
      cilindro(v3(0, 0.08, 0), v3(0, 0.02, 0), 0.2, 24),
      cilindro(v3(0, 0.08, E), v3(0, -0.4, E), 0.07, 16)
    );
    lote.add(mat.amarillo, bloque(-0.32, 0.32, 0.04, 0.08, -0.78, -0.5));
    lote.construir(piezas.volante);
    piezas.volante.position.set(X_TROQUEL, 0, Z_VOLANTE);

    // Biela: cuelga de la muñequilla y apunta a la cruceta
    piezas.biela = new Group();
    lote = crearLote();
    lote.add(
      mat.acero,
      bloque(-0.07, 0.07, -0.05, 0.05, -L, 0),
      cilindro(v3(0, -0.06, 0), v3(0, 0.06, 0), 0.15, 20),
      cilindro(v3(0, -0.06, -L), v3(0, 0.06, -L), 0.12, 20)
    );
    lote.construir(piezas.biela);

    // Corredera, vástago y troquel
    piezas.ariete = new Group();
    lote = crearLote();
    lote.add(mat.corredera, bloque(X_TROQUEL - 0.5, X_TROQUEL + 0.5, -0.2, 0.3, 4.2, 5.05));
    lote.add(
      mat.acero,
      cilindro(v3(X_TROQUEL, -0.38, Z_CRUCETA), v3(X_TROQUEL, -0.2, Z_CRUCETA), 0.07, 16),
      cilindro(v3(X_TROQUEL, 0, 3.85), v3(X_TROQUEL, 0, 4.2), 0.2, 24)
    );
    lote.add(mat.rojo, bloque(X_TROQUEL - 0.24, X_TROQUEL + 0.24, -0.36, 0.36, 3.65, 3.85));
    lote.construir(piezas.ariete);

    piezas.destello = new Mesh(new SphereGeometry(0.34, 14, 10), mat.destello);
    piezas.destello.position.set(X_TROQUEL, -0.1, Z_PLATO + ALTO_PIEZA + 0.03);
    piezas.destello.visible = false;
    stage.scene.add(piezas.volante, piezas.biela, piezas.ariete, piezas.destello);
  }

  function crearGuardaMovil(mat) {
    piezas.guarda = new Group();
    const malla = new PlaneGeometry(2.6, CARRERA_GUARDA);
    malla.rotateX(Math.PI / 2);
    const panel = new Mesh(malla, mat.rejilla);
    panel.position.set(X_TROQUEL, -1.4, Z_BANCADA + 0.1 + CARRERA_GUARDA / 2);
    panel.castShadow = true;
    piezas.guarda.add(panel);
    const lote = crearLote();
    const z0 = Z_BANCADA + 0.1;
    const z1 = z0 + CARRERA_GUARDA;
    lote.add(
      mat.amarillo,
      bloque(1.3, 3.9, -1.44, -1.36, z0, z0 + 0.08),
      bloque(1.3, 3.9, -1.44, -1.36, z1 - 0.08, z1),
      bloque(1.3, 1.38, -1.44, -1.36, z0, z1),
      bloque(3.82, 3.9, -1.44, -1.36, z0, z1)
    );
    lote.construir(piezas.guarda);
    stage.scene.add(piezas.guarda);
  }

  function crearPiezas(mat) {
    const geo = new BoxGeometry(0.6, 0.9, ALTO_PIEZA).translate(0, 0, ALTO_PIEZA / 2);
    piezas.geoPieza = geo;
    const grupo = new Group();
    const cuerpo = new Mesh(geo, mat.pieza);
    cuerpo.castShadow = true;
    cuerpo.receiveShadow = true;
    const relieve = new Mesh(new TorusGeometry(0.17, 0.04, 8, 28), mat.relieve);
    relieve.position.z = ALTO_PIEZA;
    grupo.add(cuerpo, relieve);
    piezas.pieza = grupo;
    piezas.relieve = relieve;
    stage.scene.add(grupo);

    // Piezas terminadas dentro del contenedor (se muestran según el contador)
    piezas.pila = [];
    for (let i = 0; i < 8; i++) {
      const m = new Mesh(geo, mat.pieza);
      m.position.set(i % 2 ? 0.38 : -0.38, 4.05 + (Math.floor(i / 2) % 2) * 0.72, 0.07 + Math.floor(i / 4) * 0.47);
      m.rotation.z = Math.PI / 2 + (i % 3) * 0.12 - 0.1;
      m.visible = false;
      m.castShadow = true;
      stage.scene.add(m);
      piezas.pila.push(m);
    }

    // Seta del paro de emergencia: se hunde al pulsarla
    piezas.seta = new Mesh(cilindro(v3(-5.2, -1.71, 1.4), v3(-5.2, -1.86, 1.4), 0.17, 24), mat.rojo);
    stage.scene.add(piezas.seta);
  }

  function crearEtiquetas() {
    const texto = (cadena, x, y, z, size = 0.3, anchorX = 'center', padre = stage.scene) => {
      const t = stage.makeLabel(cadena, { size: size * 1.25, anchorX });
      t.outlineWidth = '14%'; // halo más ancho: el rótulo se lee también sobre la máquina
      t.position.set(x, y, z);
      padre.add(t);
      etiquetas.push(t);
      return t;
    };
    texto('A · sujeción · 100 bar', -1.4, -0.3, 4.25, 0.3, 'center', piezas.carro);
    texto('B · alimentación · 40 bar', -5.3, -0.3, 4.0);
    texto('C · expulsor', 0, -2.7, 0.75);
    texto('D · motor hidráulico', 4.4, 2.6, 8.55);
    texto('Volante excéntrico y biela', 1.35, -0.6, 6.9, 0.28, 'right');
    texto('Guarda enclavada', 3.3, -2.6, 1.7, 0.28);
    texto('S1 · S0 · S2', -5.2, -2.7, 0.75, 0.26);
    texto('Central hidráulica', -5.6, 3.6, 4.3, 0.28);
    texto('PLC S7-1200', 6.9, -1.6, 4.7, 0.28);
    texto('Salida de piezas', -0.2, 4.7, 3.7, 0.26);
    piezas.rotuloEstado = texto('', 0.4, 0.5, 10.05, 0.52);
    piezas.rotuloEtapa = texto('', 0.4, 0.5, 9.35, 0.34);
    piezas.rotulos = etiquetas.slice(0, -2);
  }

  /* ──────────────────── Animación ──────────────────── */
  function aplicarPose(alfa) {
    const lerp = (a, b) => a + (b - a) * alfa;
    const a = lerp(planta.A.prev, planta.A.x);
    const b = lerp(planta.B.prev, planta.B.x);
    const c = lerp(planta.C.prev, planta.C.x);
    const xCarro = GEOMETRIA.carreraB * b;

    piezas.carro.position.x = xCarro;
    piezas.rodA.position.x = GEOMETRIA.carreraA * a;
    piezas.rodC.position.z = GEOMETRIA.carreraC * c;
    piezas.guarda.position.z = CARRERA_GUARDA * suave(lerp(planta.pguarda, planta.guarda));
    piezas.seta.position.y = planta.estop ? 0 : 0.07;

    // Manómetro: −135° a 0 bar, +135° a 160 bar
    const bar = lerp(planta.ppA, planta.pA);
    piezas.aguja.rotation.y = ((-135 + (270 * bar) / 160) * Math.PI) / 180;

    // LED montados en el carro y manguera flexible
    for (const i of ledsCarro) colocarLed(i, xCarro);
    piezas.leds.instanceMatrix.needsUpdate = true;
    puntoManguera.set(xCarro - 1.75, 0.22, 3.2);
    piezas.manguera.actualizar(ANCLA_MANGUERA, puntoManguera);

    // Biela-manivela: θ = 0 en el punto muerto superior
    const th = lerp(planta.ptheta, planta.theta);
    const sn = Math.sin(th);
    const cs = Math.cos(th);
    const raiz = Math.sqrt(L * L - E * E * sn * sn);
    piezas.volante.rotation.y = th;
    piezas.biela.position.set(X_TROQUEL + E * sn, Y_BIELA, Z_VOLANTE + E * cs);
    piezas.biela.rotation.y = Math.asin((E * sn) / L);
    piezas.ariete.position.z = E * cs - raiz - (E - L);

    const f = lerp(planta.pflash, planta.flash);
    piezas.destello.visible = f > 0.01 && b > 0.98;
    piezas.destello.material.opacity = f * 0.9;
    piezas.destello.scale.setScalar(0.35 + (1 - f) * 0.9);

    // Pieza
    const pz = planta.pieza;
    const g = piezas.pieza;
    const esc = lerp(pz.pescala, pz.escala);
    g.visible = pz.estado !== 'ninguna' && esc > 0.001;
    if (g.visible) {
      if (pz.estado === 'lista') {
        g.position.set(xCarro, 0, Z_PLATO + Math.max(0, GEOMETRIA.carreraC * c - GEOMETRIA.holguraC));
        g.rotation.x = 0;
        g.scale.setScalar(esc);
      } else {
        const u = lerp(pz.pu, pz.u);
        const zArriba = Z_PLATO + GEOMETRIA.carreraC - GEOMETRIA.holguraC;
        let y;
        let z;
        let giro;
        if (u < 0.28) {
          const s = suave(u / 0.28);
          const k = suave((u / 0.28 - 0.55) / 0.45);
          y = 1.5 * s;
          z = zArriba + (zRampa(1.5) - zArriba) * k;
          giro = ANG_RAMPA * k;
        } else if (u < 0.8) {
          const s = (u - 0.28) / 0.52;
          y = 1.5 + 2.05 * s * s;
          z = zRampa(y);
          giro = ANG_RAMPA;
        } else {
          const s = (u - 0.8) / 0.2;
          y = 3.55 + 0.75 * s;
          z = zRampa(3.55) - (zRampa(3.55) - 0.5) * s * s;
          giro = ANG_RAMPA * (1 - s);
        }
        g.position.set(0, y, z);
        g.rotation.x = giro;
        g.scale.setScalar(1);
      }
      const marca = lerp(pz.pmarca, pz.marca);
      piezas.relieve.visible = marca > 0.01;
      piezas.relieve.scale.set(1, 1, Math.max(0.05, marca));
    }
  }

  function sincronizarLeds() {
    const s = planta.sensores();
    const on = (v, color = LED_VERDE) => (v ? color : LED_APAGADO);
    const entradas = {
      S0: planta.estop,
      S1: planta.s1 || planta.marchaPendiente,
      S2: planta.rearmePendiente,
      B1: s.B1,
      B2: s.B2,
      B3: s.B3,
      B4: s.B4,
      B5: s.B5,
      B6: s.B6,
      B7: s.B7,
      G: s.guardaOk,
    };
    for (const k of Object.keys(entradas)) fijarLed(`i${k}`, on(entradas[k]));
    for (const k of ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7']) fijarLed(`f${k}`, on(s[k]));
    fijarLed('fG', on(s.guardaOk));
    const salidas = { Y1: planta.y1, Y2: planta.y2, Y3: planta.y3, Y4: planta.y4, Y5: planta.y5, Y6: planta.y6 };
    for (const k of Object.keys(salidas)) {
      fijarLed(`q${k}`, on(salidas[k], LED_AMBAR));
      fijarLed(`v${k}`, on(salidas[k], LED_AZUL));
    }
    const emergencia = planta.etapaGS() !== 10;
    const enCiclo = planta.etapa() > 0;
    fijarLed('verde', on(enCiclo && !pausado));
    fijarLed('ambar', on(!emergencia && (!enCiclo || pausado), LED_AMBAR));
    fijarLed('rojo', on(emergencia, LED_ROJO));
    piezas.leds.instanceColor.needsUpdate = true;

    const n = planta.piezas === 0 ? 0 : ((planta.piezas - 1) % 8) + 1;
    piezas.pila.forEach((m, i) => (m.visible = i < n));
  }

  const posicion = (eje, ext, ret) => (eje.x >= 0.99 ? ext : eje.x <= 0.01 ? ret : 'En movimiento');

  function publicar() {
    const s = planta.sensores();
    const estado = pausado ? 'Pausado' : planta.estado();
    const etapa = planta.etapa();
    const gs = planta.etapaGS();
    const accion = etapa >= 0 ? ETAPAS[etapa].accion : 'GP vacío: Y3 e Y5 forzados';
    const espera = etapa >= 0 ? ETAPAS[etapa].transicion : 'S0 · S2 · B1 · B3 · B5';
    const activos = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'].filter((k) => s[k]).join(', ');
    const solenoides = ['y1', 'y2', 'y3', 'y4', 'y5', 'y6']
      .filter((k) => planta[k])
      .map((k) => k.toUpperCase())
      .join(', ');
    const nivel = gs !== 10 ? 'inestable' : etapa > 0 && !pausado ? 'estable' : 'marginal';
    const textoGP = etapa >= 0 ? `Etapa ${etapa} · ${accion}` : accion;
    if (estado + textoGP !== textoEstado) {
      textoEstado = estado + textoGP;
      stage.setLabel(piezas.rotuloEstado, estado);
      stage.setLabel(piezas.rotuloEtapa, textoGP);
    }
    onInfo?.({
      readouts: [
        { label: 'Estado', value: estado, state: nivel },
        { label: 'Etapa GP / GS', value: `${etapa >= 0 ? etapa : '{ }'} / ${gs}` },
        { label: 'Acción', value: accion },
        { label: 'Espera', value: espera },
        { label: 'Solenoides', value: solenoides || 'Ninguno' },
        { label: 'Sensores activos', value: activos || 'Ninguno' },
        { label: 'Presión en A', value: `${planta.pA.toFixed(0)} bar` },
        { label: 'Carro B', value: posicion(planta.B, 'Bajo el troquel (B4)', 'Zona de carga (B3)') },
        { label: 'Temporizador t1', value: `${Math.min(planta.t1, T1).toFixed(1)} / ${T1.toFixed(1)} s` },
        { label: 'Golpes del troquel', value: String(planta.golpes) },
        { label: 'Guarda', value: s.guardaOk ? 'Cerrada' : 'Abierta' },
        { label: 'Piezas terminadas', value: String(planta.piezas) },
        { label: 'Último ciclo', value: planta.ultimoCiclo ? `${planta.ultimoCiclo.toFixed(1)} s` : '—' },
      ],
      aria: `${estado}. ${textoGP}. Solenoides: ${solenoides || 'ninguno'}. Sensores activos: ${activos || 'ninguno'}.`,
    });
  }

  function publicarTabla() {
    onInfo?.({
      table: {
        caption: 'Secuencia del GRAFCET de producción',
        columns: ['Etapa', 'Acción', 'Solenoides', 'Receptividad de salida'],
        rows: ETAPAS.map((e) => [String(e.n), e.accion, e.salidas, e.transicion]),
      },
    });
  }

  /** Baja la carga por pasos si el equipo no sostiene unos 45 cuadros por segundo. */
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
      // passes[2] es el SMAA de createStage(): RenderPass, Bloom, SMAA, OutputPass.
      stage.composer.passes[2].enabled = false;
    } else {
      stage.renderer.shadowMap.enabled = false;
      sol.castShadow = false;
      piezas.suelo.visible = false;
    }
    stage.resize();
  }

  function tick(dt) {
    let alfa = 1;
    let mueve = forzarDibujo;
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
          publicar(); // presión y temporizador cambian de forma continua
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
  const refrescar = () => {
    firmaPrevia = -1;
    forzarDibujo = true;
  };
  const acciones = {
    marcha() {
      pausado = false;
      planta.marcha();
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
    emergencia() {
      pausado = false;
      planta.alternarEmergencia();
      refrescar();
    },
    rearme() {
      pausado = false;
      planta.rearme();
      refrescar();
    },
    guarda() {
      planta.alternarGuarda();
      refrescar();
    },
  };

  const onTecla = (e) => {
    const teclas = {
      ' ': () => (pausado || planta.etapa() > 0 ? acciones.pausar() : acciones.marcha()),
      0: acciones.reiniciar,
      e: acciones.emergencia,
      E: acciones.emergencia,
      2: acciones.rearme,
      g: acciones.guarda,
      G: acciones.guarda,
    };
    if (teclas[e.key]) {
      e.preventDefault();
      teclas[e.key]();
    }
  };

  function aplicarParametros() {
    planta.continuo = params.continuo;
    planta.fallaB7 = params.fallaB7;
    planta.atascoB = params.atascoB;
    for (const t of piezas.rotulos) t.visible = params.etiquetas;
    forzarDibujo = true;
  }

  function crearRejillaSuelo() {
    piezas.rejilla = stage.makeGrid(40, 40);
    piezas.rejilla.position.set(0, 1, 0.004);
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
    crearRejillaSuelo();
    forzarDibujo = true;
  }

  return {
    mount() {
      stage = createStage(container, {
        ariaLabel,
        camera: [-8.2, -18.5, 9.8],
        target: [1.0, 0.4, 4.2],
        fov: 38,
        minDistance: 5,
        maxDistance: 48,
      });
      planta = createPlanta();
      params.acciones = acciones;

      // Iluminación: entorno PMREM para los metales y sol con sombras suaves
      pmrem = new PMREMGenerator(stage.renderer);
      piezas.entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      stage.scene.environment = piezas.entorno;
      stage.scene.environmentIntensity = 0.45;
      stage.renderer.shadowMap.enabled = true;
      stage.renderer.shadowMap.type = PCFShadowMap;
      sol = stage.scene.children.find((o) => o.isDirectionalLight);
      sol.position.set(-8, -11, 17);
      sol.castShadow = true;
      sol.shadow.mapSize.set(2048, 2048);
      sol.shadow.bias = -0.0004;
      sol.shadow.normalBias = 0.04;
      Object.assign(sol.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 });
      sol.shadow.camera.updateProjectionMatrix();

      const mat = crearMateriales();
      const lote = crearLote();
      crearBastidor(lote, mat);
      crearCilindroB(lote, mat);
      crearExpulsor(lote, mat);
      crearSalida(lote, mat);
      crearMotor(lote, mat);
      crearGuardaFija(lote, mat);
      crearBotonera(lote, mat);
      crearCentral(lote, mat);
      crearArmario(lote, mat);
      lote.construir(stage.scene);

      crearCarro(mat);
      crearExpulsorMovil(mat);
      crearTroquel(mat);
      crearGuardaMovil(mat);
      crearPiezas(mat);
      crearLeds();
      crearEtiquetas();

      piezas.suelo = new Mesh(new PlaneGeometry(60, 60), mat.suelo);
      piezas.suelo.position.z = 0.002;
      piezas.suelo.receiveShadow = true;
      stage.scene.add(piezas.suelo);
      crearRejillaSuelo();

      aplicarParametros();
      planta.paso();
      sincronizarLeds();
      firmaPrevia = planta.firma();
      publicar();
      publicarTabla();
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
      piezas.geoPieza?.dispose();
      piezas.entorno?.dispose();
      pmrem?.dispose();
      delete params.acciones;
      stage.dispose();
    },
    get renderer() {
      return stage?.renderer;
    },
  };
}
