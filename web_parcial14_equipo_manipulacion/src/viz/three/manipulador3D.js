/**
 * Figura 1 en 3D: equipo de manipulación de 4 ejes (plano de situación animado).
 *
 * Cadena cinemática: unidad giratoria D (columna sobre tambor fijo) → brazo → eje horizontal C
 * (cilindro con guías) → eje vertical B → pinza A. Canaleta de alimentación 1 en la posición D−
 * y canaletas de descarga 2 (C retraído) y 3 (C extendido) en la posición D+.
 * Terminal de válvulas con LED de Y1 a Y9, columna de señalización y botonera de mando.
 *
 * Fluidez (mismo patrón que la plantilla IUB):
 *  - Lo estático se fusiona en una malla por material; las piezas son un único InstancedMesh.
 *  - La lógica avanza a 5 ms fijos y cada cuadro interpola los ejes entre los dos últimos barridos.
 *  - El bucle no crea objetos; el panel solo cambia con eventos discretos.
 *  - Sin movimiento no se dibuja, y la calidad baja sola si el equipo no sostiene los cuadros.
 */
import {
  CylinderGeometry,
  Color,
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
  DynamicDrawUsage,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createStage } from './three-utils.js';
import { bloque, cilindro, crearLote, tubo, v3 } from './geometria.js';
import {
  CARRILES,
  createPlanta,
  ETAPAS,
  ETAPAS_GS,
  GEOMETRIA,
  PASO,
  puntoCarril,
  T_DESCARGA,
} from './manipuladorLogica.js';

export const defaults = {
  velocidad: 1,
  lote: 10,
  suministro: true,
  falloB2: false,
  etiquetas: true,
  autoInicio: true,
};

export const controls = [
  { label: 'S_START: marcha', type: 'button', folder: 'Mando', action: (p) => p.acciones?.start() },
  { label: 'S_STOP: parada a fin de ciclo', type: 'button', folder: 'Mando', action: (p) => p.acciones?.stop() },
  { label: 'Pausar o reanudar', type: 'button', folder: 'Mando', action: (p) => p.acciones?.pausar() },
  { label: 'Reiniciar simulación', type: 'button', folder: 'Mando', action: (p) => p.acciones?.reiniciar() },
  { key: 'velocidad', label: 'Velocidad', min: 0.25, max: 3, step: 0.25, unit: '×', folder: 'Mando' },
  { key: 'lote', label: 'Lote N (ciclos dobles)', min: 1, max: 20, step: 1, folder: 'Producción' },
  { key: 'suministro', label: 'Suministro de piezas (B_PIEZA)', type: 'boolean', folder: 'Producción' },
  { label: 'S_EMG: enclavar / desenclavar', type: 'button', folder: 'Seguridad', action: (p) => p.acciones?.emergencia() },
  { label: 'S_RESET: reposición', type: 'button', folder: 'Seguridad', action: (p) => p.acciones?.reset() },
  { key: 'falloB2', label: 'Sensor B2 averiado', type: 'boolean', folder: 'Fallas' },
  { key: 'etiquetas', label: 'Etiquetas', type: 'boolean', folder: 'Vista' },
];

/* ──────────────────── Cotas (z arriba; frente = −Y) ──────────────────── */
const G = GEOMETRIA;
const Z_TAMBOR = 0.9; // altura del tambor fijo de D
const Z_BRAZO = 2.6; // cara inferior del brazo
const Z_C = 3.3; // eje del cilindro C
const X_B = G.R1; // eje de B con C retraído (coordenadas locales del rotor)
const ABIERTA = 0.27; // semiapertura de los dedos
const CERRADA = 0.2; // dedos sobre la pieza (r + medio dedo)
const VALVULAS = v3(-2.6, 1.9, 0); // terminal de válvulas
const TORRE = v3(-3.4, 0.9, 0); // columna de señalización
const BOTONERA = v3(-0.7, 2.7, 0); // detrás de la columna: libre del sector de trabajo

const LED_APAGADO = new Color(0x252832);
const LED_VERDE = new Color(0x2bff7a);
const LED_AMBAR = new Color(0xffb020);
const LED_ROJO = new Color(0xff2e3e);
const LED_AZUL = new Color(0x46b4ff);
const LED_BLANCO = new Color(0xf4f6ff);

export function createScene(container, { params, onInfo, ariaLabel }) {
  let stage;
  let planta;
  let pmrem;
  let sol;
  let pausado = false;
  let acumulado = 0;
  let firmaPrevia = '';
  let forzarDibujo = true;
  let tPublicar = 0;
  let tPrevio = 0;
  let emaMs = 16;
  let lento = 0;
  let nivelCalidad = 0;
  let textoEstado = '';
  let parpadeo = 0;
  const piezas = {};
  const etiquetas = [];
  const leds = new Map();
  // Objetos reutilizados en el bucle (sin asignaciones por cuadro)
  const pinza = { x: 0, y: 0, z: 0, phi: 0 };
  const pt = { x: 0, y: 0, z: 0 };
  const mat4 = new Matrix4();
  const pos = new Vector3();
  const esc = new Vector3();
  const quat = new Quaternion();
  const quatCarril = [null];
  const ejeZ = new Vector3(0, 0, 1);
  const anclaje = new Vector3();

  /* ──────────────────── Materiales ──────────────────── */
  function crearMateriales() {
    const std = (color, metalness, roughness, extra = {}) =>
      new MeshStandardMaterial({ color, metalness, roughness, ...extra });
    return {
      fundicion: std(0x55607a, 0.45, 0.55),
      columna: std(0x8d99b3, 0.6, 0.38),
      brazo: std(0x3d5a8c, 0.45, 0.42),
      aluminio: std(0xc9d1dc, 0.85, 0.28),
      acero: std(0xe2e6ec, 0.95, 0.18),
      oscuro: std(0x2a2e38, 0.4, 0.6),
      cilindroC: std(0x2f7fd0, 0.35, 0.38),
      cilindroB: std(0x1f9a8a, 0.35, 0.38),
      pinza: std(0xf2b51d, 0.3, 0.42),
      dedo: std(0x9aa3b2, 0.8, 0.3),
      canal: std(0x2fa36a, 0.25, 0.5),
      canalFondo: std(0x1f6e48, 0.2, 0.6),
      pata: std(0x4b5263, 0.6, 0.45),
      valvula: std(0x8a929f, 0.5, 0.4),
      bobina: std(0x1b1d24, 0.2, 0.55),
      manguera: std(0x2563eb, 0.05, 0.6),
      gabinete: std(0xd5d8df, 0.3, 0.55),
      verde: std(0x22a85a, 0.2, 0.4),
      rojo: std(0xc8323a, 0.25, 0.4),
      azul: std(0x2a78e0, 0.2, 0.4),
      amarillo: std(0xffcc1a, 0.25, 0.5),
      pieza: std(0xffffff, 0.75, 0.32),
      suelo: new ShadowMaterial({ opacity: 0.22 }),
    };
  }

  /* ──────────────────── LED (malla propia y emisivo) ──────────────────── */
  const geoLed = new SphereGeometry(0.06, 14, 10);
  function led(id, padre, x, y, z, escala = 1) {
    const m = new Mesh(
      geoLed,
      new MeshStandardMaterial({ color: 0x111111, emissive: LED_APAGADO, emissiveIntensity: 1, roughness: 0.3 })
    );
    m.position.set(x, y, z);
    m.scale.setScalar(escala);
    padre.add(m);
    leds.set(id, m);
  }
  const fijarLed = (id, color) => leds.get(id)?.material.emissive.copy(color);

  /* ──────────────────── Carriles (canaletas) ──────────────────── */
  /** Matriz del carril: eje x local = dirección del carril, inclinado según su pendiente. */
  function matrizCarril(c) {
    const k = CARRILES[c];
    const yaw = Math.atan2(k.hy, k.hx);
    const pitch = -Math.atan(k.m);
    const q = new Quaternion().setFromAxisAngle(ejeZ, yaw).multiply(new Quaternion().setFromAxisAngle(v3(0, 1, 0), pitch));
    return { m: new Matrix4().compose(v3(k.ox, k.oy, G.zs), q, v3(1, 1, 1)), q };
  }

  function crearCanaleta(lote, mat, c) {
    const k = CARRILES[c];
    const { m, q } = matrizCarril(c);
    quatCarril[c] = q;
    const largo = k.L / Math.cos(Math.atan(k.m)); // longitud sobre la pendiente
    const ini = -0.32;
    const fin = largo + 0.15;
    const piezasCanal = [
      [mat.canalFondo, bloque(ini, fin, -0.32, 0.32, -0.06, 0)],
      [mat.canal, bloque(ini, fin, 0.27, 0.33, -0.06, 0.2)],
      [mat.canal, bloque(ini, fin, -0.33, -0.27, -0.06, 0.2)],
      [mat.canal, bloque(fin - 0.06, fin, -0.33, 0.33, -0.06, 0.24)], // tope del extremo alto/lejano
      [mat.canal, bloque(ini, ini + 0.06, -0.33, 0.33, -0.06, 0.24)], // tope del extremo de toma
    ];
    for (const [material, g] of piezasCanal) {
      g.applyMatrix4(m);
      lote.add(material, g);
    }
    // Patas hasta el suelo
    for (const s of [0, k.L]) {
      puntoCarril(c, s, pt);
      for (const lado of [-0.24, 0.24]) {
        const lx = pt.x - k.hy * lado;
        const ly = pt.y + k.hx * lado;
        lote.add(mat.pata, bloque(lx - 0.04, lx + 0.04, ly - 0.04, ly + 0.04, 0, pt.z - 0.06));
      }
    }
  }

  /* ──────────────────── Estructura fija ──────────────────── */
  function crearBase(lote, mat) {
    lote.add(mat.oscuro, bloque(-1.35, 1.35, -1.35, 1.35, 0, 0.12)); // placa base
    lote.add(mat.fundicion, cilindro(v3(0, 0, 0.12), v3(0, 0, Z_TAMBOR), 1.0, 48));
    lote.add(mat.aluminio, cilindro(v3(0, 0, Z_TAMBOR - 0.06), v3(0, 0, Z_TAMBOR), 1.04, 48));
    // Topes de giro (S3 a 0°, B5 a −90°) sobre el tambor
    lote.add(mat.oscuro, bloque(0.96, 1.1, -0.1, 0.1, 0.45, 0.75));
    lote.add(mat.oscuro, bloque(-0.1, 0.1, -1.1, -0.96, 0.45, 0.75));
  }

  function crearTerminal(lote, mat) {
    const { x, y } = VALVULAS;
    lote.add(mat.oscuro, bloque(x - 1.0, x + 1.0, y - 0.35, y + 0.35, 0, 0.9)); // pedestal
    lote.add(mat.aluminio, bloque(x - 0.95, x + 0.95, y - 0.3, y + 0.3, 0.9, 1.05)); // regleta
    for (let i = 0; i < 5; i++) {
      const vx = x - 0.76 + i * 0.38;
      lote.add(mat.valvula, bloque(vx - 0.14, vx + 0.14, y - 0.26, y + 0.26, 1.05, 1.38));
      lote.add(mat.bobina, bloque(vx - 0.12, vx + 0.12, y - 0.42, y - 0.26, 1.12, 1.34));
      if (i >= 3) lote.add(mat.bobina, bloque(vx - 0.12, vx + 0.12, y + 0.26, y + 0.42, 1.12, 1.34));
    }
    // Unidad de aire: Y8 (arranque progresivo) e Y9 (zona D)
    lote.add(mat.gabinete, bloque(x + 1.15, x + 1.6, y - 0.3, y + 0.3, 0, 1.25));
    lote.add(mat.azul, cilindro(v3(x + 1.37, y - 0.3, 1.0), v3(x + 1.37, y - 0.42, 1.0), 0.12, 20));
    // Mangueras hacia la columna giratoria
    for (const [dx, col] of [
      [-0.76, mat.manguera],
      [0, mat.manguera],
      [0.76, mat.manguera],
    ]) {
      lote.add(
        col,
        tubo([v3(x + dx, y - 0.1, 1.38), v3(x + dx, y - 0.6, 1.5), v3(-0.9, 0.9, 1.1), v3(-0.62, 0.62, 0.95)], 0.035)
      );
    }
  }

  function crearTorre(lote, mat) {
    const { x, y } = TORRE;
    lote.add(mat.oscuro, cilindro(v3(x, y, 0), v3(x, y, 0.08), 0.25, 24));
    lote.add(mat.aluminio, cilindro(v3(x, y, 0.08), v3(x, y, 3.3), 0.05, 12));
    lote.add(mat.oscuro, cilindro(v3(x, y, 3.3), v3(x, y, 3.4), 0.17, 24));
  }

  function crearBotonera(lote, mat) {
    const { x, y } = BOTONERA;
    lote.add(mat.oscuro, bloque(x - 0.08, x + 0.08, y - 0.08, y + 0.08, 0, 1.0));
    lote.add(mat.gabinete, bloque(x - 0.55, x + 0.55, y - 0.2, y + 0.2, 1.0, 1.55));
    lote.add(mat.verde, cilindro(v3(x - 0.33, y - 0.2, 1.35), v3(x - 0.33, y - 0.27, 1.35), 0.08, 20));
    lote.add(mat.rojo, cilindro(v3(x - 0.11, y - 0.2, 1.35), v3(x - 0.11, y - 0.27, 1.35), 0.08, 20));
    lote.add(mat.azul, cilindro(v3(x + 0.11, y - 0.2, 1.35), v3(x + 0.11, y - 0.27, 1.35), 0.08, 20));
    lote.add(mat.amarillo, bloque(x + 0.22, x + 0.5, y - 0.21, y - 0.2, 1.12, 1.45));
  }

  /* ──────────────────── Cadena cinemática móvil ──────────────────── */
  function crearRotor(mat) {
    const rotor = new Group();
    const lote = crearLote();
    // Columna giratoria (D) y brazo fijo al rotor
    lote.add(mat.columna, cilindro(v3(0, 0, Z_TAMBOR), v3(0, 0, Z_BRAZO), 0.62, 40));
    lote.add(mat.aluminio, cilindro(v3(0, 0, Z_TAMBOR), v3(0, 0, Z_TAMBOR + 0.12), 0.78, 40));
    lote.add(mat.brazo, bloque(-0.75, 2.65, -0.34, 0.34, Z_BRAZO, Z_BRAZO + 0.5));
    // Cilindro C: camisa, tapas y soporte de guías
    lote.add(mat.cilindroC, cilindro(v3(0.15, 0, Z_C), v3(1.7, 0, Z_C), 0.16, 28));
    lote.add(mat.aluminio, bloque(0.05, 0.2, -0.2, 0.2, Z_BRAZO + 0.5, Z_C + 0.2));
    lote.add(mat.aluminio, bloque(1.65, 1.8, -0.2, 0.2, Z_BRAZO + 0.5, Z_C + 0.2));
    lote.add(mat.aluminio, bloque(2.4, 2.62, -0.32, 0.32, Z_BRAZO + 0.5, Z_C + 0.18)); // cojinete de guías
    // Leva del captador de giro
    lote.add(mat.oscuro, bloque(0.6, 0.72, -0.06, 0.06, Z_TAMBOR - 0.25, Z_TAMBOR + 0.05));
    lote.construir(rotor);

    // Grupo C (se desplaza en x local)
    const grupoC = new Group();
    const loteC = crearLote();
    loteC.add(mat.acero, cilindro(v3(1.0, 0, Z_C), v3(2.72, 0, Z_C), 0.06, 16));
    for (const yy of [-0.22, 0.22]) loteC.add(mat.acero, cilindro(v3(0.9, yy, Z_C - 0.05), v3(2.72, yy, Z_C - 0.05), 0.035, 12));
    loteC.add(mat.aluminio, bloque(2.7, 2.76, -0.34, 0.34, 2.75, Z_C + 0.3)); // placa de unión
    loteC.add(mat.cilindroB, bloque(X_B - 0.25, X_B + 0.25, -0.25, 0.25, 2.5, 3.9)); // camisa de B
    loteC.add(mat.aluminio, bloque(X_B - 0.27, X_B + 0.27, -0.27, 0.27, 3.85, 3.95));
    loteC.construir(grupoC);
    rotor.add(grupoC);

    // Grupo B (desciende en z) con la pinza A
    const grupoB = new Group();
    const loteB = crearLote();
    loteB.add(mat.acero, cilindro(v3(X_B, 0, 2.35), v3(X_B, 0, 3.75), 0.07, 16));
    loteB.add(mat.pinza, bloque(X_B - 0.2, X_B + 0.2, -0.2, 0.2, 2.03, 2.36));
    loteB.add(mat.oscuro, bloque(X_B - 0.3, X_B + 0.3, -0.07, 0.07, 1.98, 2.06)); // guía de dedos
    loteB.construir(grupoB);
    const dedos = [-1, 1].map((sgn) => {
      const d = new Mesh(bloque(-0.03, 0.03, -0.08, 0.08, G.zPinza - 0.02, 2.0), mat.dedo);
      d.castShadow = true;
      d.userData.sgn = sgn;
      grupoB.add(d);
      return d;
    });
    grupoC.add(grupoB);

    // LED de los captadores (se mueven con su eje)
    led('S1', grupoB, X_B - 0.21, -0.12, 2.28, 0.8);
    led('S2', grupoB, X_B - 0.21, 0.12, 2.28, 0.8);
    led('B1', grupoC, X_B - 0.26, 0, 3.7, 0.8);
    led('B2', grupoC, X_B - 0.26, 0, 2.62, 0.8);
    led('B3', rotor, 0.25, -0.18, Z_C + 0.12, 0.8);
    led('B4', rotor, 1.6, -0.18, Z_C + 0.12, 0.8);

    piezas.rotor = rotor;
    piezas.grupoC = grupoC;
    piezas.grupoB = grupoB;
    piezas.dedos = dedos;
    stage.scene.add(rotor);
  }

  /* ──────────────────── Piezas (InstancedMesh) ──────────────────── */
  function crearPiezas(mat) {
    const geo = new CylinderGeometry(G.rPieza, G.rPieza, G.hPieza, 28);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, G.hPieza / 2); // origen en la base
    piezas.geoPieza = geo;
    const n = planta.piezas.length;
    const inst = new InstancedMesh(geo, mat.pieza, n);
    inst.instanceMatrix.setUsage(DynamicDrawUsage);
    inst.castShadow = true;
    inst.frustumCulled = false;
    const tonos = [0xd8dde6, 0xc8323a, 0x2a2e38]; // plateado, rojo y negro (piezas didácticas)
    const c = new Color();
    for (let i = 0; i < n; i++) inst.setColorAt(i, c.setHex(tonos[i % 3]));
    piezas.inst = inst;
    stage.scene.add(inst);
  }

  /* ──────────────────── Etiquetas ──────────────────── */
  function crearEtiquetas() {
    // Material base sin prueba de profundidad: las etiquetas nunca quedan tapadas por la máquina.
    piezas.matEtiqueta = new MeshBasicMaterial({ depthTest: false, depthWrite: false, transparent: true });
    const rot = (texto, x, y, z, size = 0.24, anchorX = 'center') => {
      const t = stage.makeLabel(texto, { size, anchorX });
      t.material = piezas.matEtiqueta;
      t.renderOrder = 10;
      t.position.set(x, y, z);
      stage.scene.add(t);
      etiquetas.push(t);
      return t;
    };
    piezas.etiA = rot('A · pinza', 0, 0, 0, 0.24, 'right');
    piezas.etiB = rot('B · eje vertical', 0, 0, 0);
    piezas.etiC = rot('C · eje horizontal', 0, 0, 0);
    rot('D · unidad giratoria', 1.05, -1.6, 0.15); // en el suelo, fuera del sector que barre el brazo
    puntoCarril(1, CARRILES[1].L, pt);
    rot('1 · alimentación', pt.x + 0.2, pt.y + 0.55, pt.z + 0.75);
    puntoCarril(2, CARRILES[2].L, pt);
    rot('2', pt.x - 0.55, pt.y, pt.z + 0.45, 0.3);
    puntoCarril(3, CARRILES[3].L, pt);
    rot('3', pt.x - 0.55, pt.y, pt.z + 0.45, 0.3);
    piezas.rotuloEstado = rot('', -0.8, 3.4, 5.7, 0.3);
    piezas.rotuloEtapa = rot('', -0.8, 3.4, 5.25, 0.22);
  }

  /* ──────────────────── Pose ──────────────────── */
  const lerp = (e, a) => e.prev + (e.x - e.prev) * a;

  function aplicarPose(alfa) {
    const a = lerp(planta.A, alfa);
    const b = lerp(planta.B, alfa);
    const c = lerp(planta.C, alfa);
    const d = lerp(planta.D, alfa);
    planta.posPinza(a, b, c, d, pinza);
    piezas.rotor.rotation.z = pinza.phi;
    piezas.grupoC.position.x = c * G.carreraC;
    piezas.grupoB.position.z = -b * G.carreraB;
    const apertura = ABIERTA + (CERRADA - ABIERTA) * a;
    for (const dd of piezas.dedos) dd.position.x = X_B + dd.userData.sgn * apertura;

    // Piezas
    const inst = piezas.inst;
    planta.piezas.forEach((z, i) => {
      if (!z.activa || z.escala <= 0.001) {
        esc.set(0, 0, 0);
        mat4.compose(pos.set(0, 0, -5), quat.identity(), esc);
      } else if (z.lugar === 'pinza') {
        mat4.compose(pos.set(pinza.x, pinza.y, pinza.z), quat.setFromAxisAngle(ejeZ, pinza.phi), esc.set(1, 1, 1));
      } else if (z.lugar === 'caida' || (z.lugar === 'sale' && !z.carril)) {
        mat4.compose(pos.set(z.x, z.y, z.z), quat.identity(), esc.setScalar(z.escala || 1));
      } else {
        puntoCarril(z.carril, z.s, pt);
        mat4.compose(pos.set(pt.x, pt.y, pt.z), quatCarril[z.carril], esc.setScalar(z.escala));
      }
      inst.setMatrixAt(i, mat4);
    });
    inst.instanceMatrix.needsUpdate = true;

    // Etiquetas que siguen a los ejes
    if (params.etiquetas) {
      const cs = Math.cos(pinza.phi);
      const sn = Math.sin(pinza.phi);
      const r = G.R1 + c * G.carreraC;
      // A y B se desplazan en sentido tangencial (−t, hacia el observador o hacia la izquierda de la
      // pantalla según la posición de D) para no tapar la pieza ni la camisa de B; C va sobre el brazo.
      const tx = sn;
      const ty = -cs;
      piezas.etiA.position.set(r * cs + 0.8 * tx, r * sn + 0.8 * ty, pinza.z + 0.15);
      // B sobre la camisa del eje vertical y C sobre la raíz del brazo: quedan en el cielo de la escena.
      piezas.etiB.position.set(r * cs, r * sn, 4.4);
      anclaje.set(0.35, 0, 4.25).applyAxisAngle(ejeZ, pinza.phi);
      piezas.etiC.position.copy(anclaje);
    }
  }

  /* ──────────────────── LED y pilotos ──────────────────── */
  function sincronizarLeds() {
    const s = planta.sensores();
    for (const k of ['S1', 'S2', 'B1', 'B2', 'B3', 'B4', 'S3', 'B5']) fijarLed(k, s[k] ? LED_VERDE : LED_APAGADO);
    fijarLed('PIEZA', s.PIEZA ? LED_VERDE : LED_APAGADO);
    for (let i = 1; i <= 7; i++) fijarLed(`Y${i}`, planta.y[i] && planta.ks ? LED_AMBAR : LED_APAGADO);
    fijarLed('Y8', planta.y8 ? LED_AZUL : LED_APAGADO);
    fijarLed('Y9', planta.y9 ? LED_AZUL : LED_APAGADO);
    const on = parpadeo % 2 === 0;
    const gp = planta.gp;
    const h1 = planta.ks && (planta.marcha || (gp > 0 && on));
    const h2 = planta.ks && (planta.gs === 20 || ((planta.gs === 21 || planta.gs === 22) && on));
    const h3 = planta.ks && (planta.cv >= planta.lote || (planta.fallo && on));
    fijarLed('H1', h1 ? LED_VERDE : LED_APAGADO);
    fijarLed('H2', h2 ? LED_AZUL : LED_APAGADO);
    fijarLed('H3', h3 ? LED_BLANCO : LED_APAGADO);
    fijarLed('H0', !planta.ks ? LED_ROJO : LED_APAGADO);
    piezas.seta.position.z = planta.emgPulsada ? 1.35 : 1.42;
  }

  function crearLedsFijos() {
    led('S3', stage.scene, 1.12, 0.16, 0.62, 0.9);
    led('B5', stage.scene, -0.16, -1.12, 0.62, 0.9);
    puntoCarril(1, 0, pt);
    led('PIEZA', stage.scene, pt.x + 0.42, pt.y, pt.z + 0.25, 0.9);
    const { x, y } = VALVULAS;
    // Y1-Y3 (monoestables), Y4/Y5 y Y6/Y7 (biestables: una bobina a cada lado)
    const xs = [x - 0.76, x - 0.38, x, x + 0.38, x + 0.76];
    led('Y1', stage.scene, xs[0], y - 0.43, 1.3);
    led('Y2', stage.scene, xs[1], y - 0.43, 1.3);
    led('Y3', stage.scene, xs[2], y - 0.43, 1.3);
    led('Y4', stage.scene, xs[3], y - 0.43, 1.3);
    led('Y5', stage.scene, xs[3], y + 0.43, 1.3);
    led('Y6', stage.scene, xs[4], y - 0.43, 1.3);
    led('Y7', stage.scene, xs[4], y + 0.43, 1.3);
    led('Y8', stage.scene, x + 1.3, y - 0.31, 1.18);
    led('Y9', stage.scene, x + 1.47, y - 0.31, 1.18);
    // Columna de señalización: H0 rojo, H2 azul, H3 blanco, H1 verde
    const { x: tx, y: ty } = TORRE;
    ['H1', 'H3', 'H2', 'H0'].forEach((id, i) => led(id, stage.scene, tx, ty, 2.25 + i * 0.3, 2.4));
    // Seta de emergencia (se hunde al enclavarse)
    const seta = new Mesh(cilindro(v3(0, 0, 0), v3(0, 0, 0.12), 0.13, 24), piezas.matRojo);
    seta.position.set(BOTONERA.x + 0.36, BOTONERA.y, 1.42);
    seta.castShadow = true;
    stage.scene.add(seta);
    piezas.seta = seta;
    const anillo = new Mesh(new TorusGeometry(0.15, 0.025, 8, 24), piezas.matAmarillo);
    anillo.position.set(BOTONERA.x + 0.36, BOTONERA.y, 1.56);
    stage.scene.add(anillo);
  }

  /* ──────────────────── Panel de lecturas ──────────────────── */
  const posicion = (eje, fin, ini) => (eje.x >= 0.99 ? fin : eje.x <= 0.01 ? ini : 'En movimiento');

  function publicar() {
    const s = planta.sensores();
    const estado = pausado ? 'Pausado' : planta.estado();
    const gp = planta.gp;
    const gs = planta.gs;
    const accion = gs !== 24 ? ETAPAS_GS[gs].accion : ETAPAS[gp]?.accion ?? '—';
    const espera = gs !== 24 ? ETAPAS_GS[gs].espera : ETAPAS[gp]?.transicion ?? '—';
    const sensores = ['S1', 'S2', 'B1', 'B2', 'B3', 'B4', 'S3', 'B5'].filter((k) => s[k]).join(', ');
    const bobinas = [1, 2, 3, 4, 5, 6, 7]
      .filter((i) => planta.y[i] && planta.ks)
      .map((i) => `Y${i}`)
      .join(', ');
    const nivel = !planta.ks || planta.fallo ? 'inestable' : planta.marcha ? 'estable' : 'marginal';
    const textoGP = gp >= 0 ? `GP ${gp} · ${ETAPAS[gp].accion}` : `GS ${gs} · ${ETAPAS_GS[gs].accion}`;
    if (estado + textoGP !== textoEstado) {
      textoEstado = estado + textoGP;
      stage.setLabel(piezas.rotuloEstado, estado);
      stage.setLabel(piezas.rotuloEtapa, textoGP);
    }
    const t = gp === 5 || gp === 12 ? Math.min(planta.tEtapa, T_DESCARGA) : 0;
    onInfo?.({
      readouts: [
        { label: 'Estado', value: estado, state: nivel },
        { label: 'Etapa GP / GS', value: `${gp >= 0 ? gp : '{ }'} / ${gs}` },
        { label: 'Acción', value: accion },
        { label: 'Espera', value: espera },
        { label: 'Bobinas', value: bobinas || 'Ninguna' },
        { label: 'Sensores', value: `${sensores || '—'}${s.PIEZA ? ' · B_PIEZA' : ''}` },
        { label: 'Aire A-B-C / D', value: `${planta.y8 ? 'Y8 ON' : 'Y8 OFF'} · ${planta.y9 ? 'Y9 ON' : 'Y9 OFF'}` },
        { label: 'Unidad D', value: posicion(planta.D, 'Canaletas 2/3 (B5)', 'Canaleta 1 (S3)') },
        { label: 'T1 / T2', value: `${t.toFixed(1)} / ${T_DESCARGA.toFixed(1)} s` },
        { label: 'Contador C1', value: `${planta.cv} / ${planta.lote}` },
        { label: 'Piezas depositadas', value: String(planta.depositadas) },
        { label: 'Último ciclo doble', value: planta.ultimoCiclo ? `${planta.ultimoCiclo.toFixed(1)} s` : '—' },
      ],
      aria: `${estado}. ${textoGP}. Bobinas: ${bobinas || 'ninguna'}. Sensores: ${sensores || 'ninguno'}.`,
    });
  }

  function publicarTabla() {
    onInfo?.({
      table: {
        caption: 'Secuencia del GRAFCET de producción',
        columns: ['Etapa', 'Acción', 'Salidas', 'Receptividad de salida'],
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
      stage.composer.passes[2].enabled = false; // SMAA
    } else {
      stage.renderer.shadowMap.enabled = false;
      sol.castShadow = false;
      piezas.suelo.visible = false;
    }
    stage.resize();
  }

  /* ──────────────────── Bucle ──────────────────── */
  let tParpadeo = 0;
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
        tPublicar += dt;
        tParpadeo += dt;
        const firma = planta.firma();
        if (tParpadeo >= 0.5) {
          tParpadeo = 0;
          parpadeo += 1;
          sincronizarLeds();
          mueve = true;
        }
        if (firma !== firmaPrevia) {
          firmaPrevia = firma;
          tPublicar = 0;
          sincronizarLeds();
          publicar();
          mueve = true;
        } else if (tPublicar > 0.2) {
          tPublicar = 0;
          publicar();
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
    firmaPrevia = '';
    forzarDibujo = true;
  };
  const acciones = {
    start() {
      pausado = false;
      planta.pulsarStart();
      refrescar();
    },
    stop() {
      planta.pulsarStop();
      refrescar();
    },
    pausar() {
      pausado = !pausado;
      publicar();
      forzarDibujo = true;
    },
    reiniciar() {
      pausado = false;
      acumulado = 0;
      planta.reiniciar();
      planta.autoArranque = false;
      refrescar();
    },
    emergencia() {
      pausado = false;
      planta.alternarEmergencia();
      refrescar();
    },
    reset() {
      pausado = false;
      planta.pulsarReset();
      refrescar();
    },
  };

  const onTecla = (e) => {
    const teclas = {
      ' ': () => (planta.marcha || pausado ? acciones.pausar() : acciones.start()),
      s: acciones.stop,
      S: acciones.stop,
      e: acciones.emergencia,
      E: acciones.emergencia,
      x: acciones.reset,
      X: acciones.reset,
      0: acciones.reiniciar,
    };
    if (teclas[e.key]) {
      e.preventDefault();
      teclas[e.key]();
    }
  };

  function aplicarParametros() {
    planta.lote = params.lote;
    planta.suministro = params.suministro;
    planta.falloB2 = params.falloB2;
    for (const t of etiquetas) t.visible = params.etiquetas;
    refrescar();
  }

  function crearRejillaSuelo() {
    piezas.rejilla = stage.makeGrid(30, 30);
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
    crearRejillaSuelo();
    forzarDibujo = true;
  }

  return {
    mount() {
      stage = createStage(container, {
        ariaLabel,
        camera: [7.4, -9.2, 6.4],
        target: [0.5, -0.5, 1.6],
        fov: 38,
        minDistance: 4,
        maxDistance: 40,
      });
      planta = createPlanta();
      params.acciones = acciones;

      pmrem = new PMREMGenerator(stage.renderer);
      piezas.entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      stage.scene.environment = piezas.entorno;
      stage.scene.environmentIntensity = 0.5;
      stage.renderer.shadowMap.enabled = true;
      stage.renderer.shadowMap.type = PCFShadowMap;
      sol = stage.scene.children.find((o) => o.isDirectionalLight);
      sol.position.set(6, -8, 14);
      sol.castShadow = true;
      sol.shadow.mapSize.set(2048, 2048);
      sol.shadow.bias = -0.0004;
      sol.shadow.normalBias = 0.04;
      Object.assign(sol.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
      sol.shadow.camera.updateProjectionMatrix();

      const mat = crearMateriales();
      piezas.matRojo = mat.rojo;
      piezas.matAmarillo = mat.amarillo;
      const lote = crearLote();
      crearBase(lote, mat);
      for (let c = 1; c <= 3; c++) crearCanaleta(lote, mat, c);
      crearTerminal(lote, mat);
      crearTorre(lote, mat);
      crearBotonera(lote, mat);
      lote.construir(stage.scene);

      crearRotor(mat);
      crearPiezas(mat);
      crearLedsFijos();
      crearEtiquetas();

      piezas.suelo = new Mesh(new PlaneGeometry(40, 40), mat.suelo);
      piezas.suelo.position.z = 0.002;
      piezas.suelo.receiveShadow = true;
      stage.scene.add(piezas.suelo);
      crearRejillaSuelo();

      aplicarParametros();
      // Precarga de la canaleta 1 para que la escena no arranque vacía
      for (let i = 0; i < 1000; i++) planta.paso();
      planta.autoArranque = Boolean(params.autoInicio && !stage.reducedMotion);
      if (planta.autoArranque) planta.pulsarReset();
      sincronizarLeds();
      firmaPrevia = planta.firma();
      publicar();
      publicarTabla();
      aplicarPose(1);

      stage.renderer.domElement.addEventListener('keydown', onTecla);
      stage.onTick(tick);
      tPrevio = performance.now();
      stage.start();
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
      for (const m of leds.values()) m.material.dispose();
      geoLed.dispose();
      piezas.matEtiqueta?.dispose();
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
