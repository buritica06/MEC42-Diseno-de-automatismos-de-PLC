/**
 * Escena 3D interactiva: Célula de Mecanizado Electroneumática y Husillo Trifásico (Semana 7).
 *
 * Modela en 3D los tres actuadores industriales del laboratorio:
 *   - Cilindro A (Monoestable, retorno por muelle visible, carrera 100 mm, eje X)
 *   - Cilindro B (Biestable, memoria mecánica de doble solenoide, carrera 50 mm, eje Y)
 *   - Motor Trifásico M1 (Husillo de mecanizado con giro horario CW, eje Z)
 *   - Sensores magnéticos Reed (a0, a1, b0, b1), electroválvulas (YA, YB+, YB-) y contactor KM1.
 *
 * Cumple contrato: imports nombrados de 'three', createStage(), y colores de theme.css.
 */
import {
  BoxGeometry,
  CylinderGeometry,
  SphereGeometry,
  TorusGeometry,
  ConeGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  Mesh,
  Group,
} from 'three';
import { createStage, damp } from './three-utils.js';
import {
  estadoGrafcet,
  fuerzaCilindroA,
  fuerzaClampeoB,
  velocidadMotor,
  calcularTiemposCiclo,
} from '../../math/celula.js';

export const defaults = {
  modo: 'auto',
  etapaManual: 1,
  presionBar: 6,
  velocidad: 1,
  corteElectrico: false,
  falloTermico: false,
};

export const controls = [
  {
    key: 'modo',
    label: 'Modo de operación',
    type: 'select',
    options: {
      'Ciclo automático GRAFCET': 'auto',
      'Inspección manual por etapa': 'manual',
    },
  },
  {
    key: 'etapaManual',
    label: 'Etapa manual (0 a 6)',
    min: 0,
    max: 6,
    step: 1,
  },
  {
    key: 'presionBar',
    label: 'Presión neumática (bar)',
    min: 4,
    max: 8,
    step: 0.5,
    folder: 'Planta física',
  },
  {
    key: 'velocidad',
    label: 'Velocidad de ciclo (×)',
    min: 0.25,
    max: 2.5,
    step: 0.25,
    folder: 'Planta física',
  },
  {
    key: 'corteElectrico',
    label: 'Simular corte 24 VDC',
    type: 'boolean',
    folder: 'Seguridad y fallos',
  },
  {
    key: 'falloTermico',
    label: 'Disparo térmico RT1 (95-96)',
    type: 'boolean',
    folder: 'Seguridad y fallos',
  },
];

// Duraciones visuales por etapa en modo automático (segundos a velocidad 1×)
const DURACIONES_AUTO = [1.2, 1.8, 1.6, 1.4, 1.8, 1.6, 3.2];

export function createScene(container, { params, onInfo, ariaLabel }) {
  let stage;
  const mats = {};
  const objs = {};

  // Estado animado continuo (0..1)
  let animA = 0; // 0 = retraído (0 mm), 1 = extendido (100 mm)
  let animB = 0; // 0 = retraído (0 mm), 1 = extendido (50 mm)
  let animSpindleZ = 0; // descenso del cabezal durante mecanizado
  let anguloHusillo = 0;
  let etapaAuto = 1;
  let relojEtapa = 0;
  let ultimoEstadoInfo = '';

  function crearMateriales(theme) {
    mats.mesa = new MeshStandardMaterial({
      color: theme['grid-strong'].clone(),
      roughness: 0.65,
      metalness: 0.25,
    });
    mats.estructura = new MeshStandardMaterial({
      color: theme.axis.clone(),
      roughness: 0.5,
      metalness: 0.45,
    });
    mats.cilindroA = new MeshStandardMaterial({
      color: theme['series-1'].clone(),
      roughness: 0.35,
      metalness: 0.55,
    });
    mats.cilindroB = new MeshStandardMaterial({
      color: theme['series-2'].clone(),
      roughness: 0.35,
      metalness: 0.55,
    });
    mats.vastago = new MeshStandardMaterial({
      color: theme.text.clone(),
      roughness: 0.2,
      metalness: 0.8,
    });
    mats.resorte = new MeshStandardMaterial({
      color: theme.accent.clone(),
      roughness: 0.3,
      metalness: 0.6,
    });
    mats.motor = new MeshStandardMaterial({
      color: theme['series-3'].clone(),
      roughness: 0.4,
      metalness: 0.5,
    });
    mats.pieza = new MeshStandardMaterial({
      color: theme['series-5'].clone(),
      roughness: 0.35,
      metalness: 0.65,
    });
    mats.ledOff = new MeshBasicMaterial({
      color: theme['grid-strong'].clone(),
    });
    mats.ledOnSensor = new MeshBasicMaterial({
      color: theme.zero.clone(),
    });
    mats.ledOnBobina = new MeshBasicMaterial({
      color: theme.accent.clone(),
    });
    mats.ledAlarma = new MeshBasicMaterial({
      color: theme.unstable.clone(),
    });
  }

  function actualizarColoresMateriales(theme) {
    mats.mesa.color.copy(theme['grid-strong']);
    mats.estructura.color.copy(theme.axis);
    mats.cilindroA.color.copy(theme['series-1']);
    mats.cilindroB.color.copy(theme['series-2']);
    mats.vastago.color.copy(theme.text);
    mats.resorte.color.copy(theme.accent);
    mats.motor.color.copy(theme['series-3']);
    mats.pieza.color.copy(theme['series-5']);
    mats.ledOff.color.copy(theme['grid-strong']);
    mats.ledOnSensor.color.copy(theme.zero);
    mats.ledOnBobina.color.copy(theme.accent);
    mats.ledAlarma.color.copy(theme.unstable);
  }

  function buildStatic() {
    const theme = stage.theme;
    crearMateriales(theme);

    objs.grid = stage.makeGrid(4.4, 16);
    objs.grid.position.z = -0.02;
    stage.scene.add(objs.grid);

    // 1. Mesa de trabajo y cuna de mecanizado (plano XY, altura Z)
    const baseGroup = new Group();
    const tabla = new Mesh(new BoxGeometry(3.4, 2.6, 0.08), mats.mesa);
    tabla.position.set(0, 0, 0.04);
    baseGroup.add(tabla);

    // Topes fijos de la cuna de mecanizado en (x = 0.58, y = 0.0) y (x = 0.32, y = 0.34)
    const topeFondoX = new Mesh(new BoxGeometry(0.1, 0.56, 0.28), mats.estructura);
    topeFondoX.position.set(0.62, 0.0, 0.22);
    const topeFondoY = new Mesh(new BoxGeometry(0.56, 0.1, 0.28), mats.estructura);
    topeFondoY.position.set(0.32, 0.32, 0.22);
    baseGroup.add(topeFondoX, topeFondoY);

    // Pieza metálica a mecanizar
    objs.pieza = new Mesh(new BoxGeometry(0.38, 0.38, 0.22), mats.pieza);
    objs.pieza.position.set(0.28, 0.0, 0.19);
    baseGroup.add(objs.pieza);

    stage.scene.add(baseGroup);

    // 2. CILINDRO A (Monoestable, eje X, carrera 100 mm = 0.65 unidades 3D)
    const cylAGroup = new Group();
    // Camisa del cilindro A
    const camisaA = new Mesh(new CylinderGeometry(0.16, 0.16, 0.9, 24), mats.cilindroA);
    camisaA.rotation.z = Math.PI / 2;
    camisaA.position.set(-1.05, 0.0, 0.24);
    cylAGroup.add(camisaA);

    // Tapas delantera y trasera de A
    const tapaATras = new Mesh(new BoxGeometry(0.08, 0.36, 0.36), mats.estructura);
    tapaATras.position.set(-1.5, 0.0, 0.24);
    const tapaADel = new Mesh(new BoxGeometry(0.08, 0.36, 0.36), mats.estructura);
    tapaADel.position.set(-0.6, 0.0, 0.24);
    cylAGroup.add(tapaATras, tapaADel);

    // Muelle de retorno visible (6 espiras Torus alrededor del vástago para destacar que A es Monoestable)
    objs.espirasMuelleA = [];
    const geomEspira = new TorusGeometry(0.11, 0.018, 12, 24);
    for (let i = 0; i < 6; i++) {
      const espira = new Mesh(geomEspira, mats.resorte);
      espira.rotation.y = Math.PI / 2;
      espira.position.set(-0.52 + i * 0.05, 0.0, 0.24);
      cylAGroup.add(espira);
      objs.espirasMuelleA.push(espira);
    }

    // Grupo móvil del vástago A + cabezal empujador/boquilla
    objs.vastagoAGroup = new Group();
    const barraA = new Mesh(new CylinderGeometry(0.05, 0.05, 0.95, 16), mats.vastago);
    barraA.rotation.z = Math.PI / 2;
    barraA.position.set(-0.55, 0.0, 0.24);
    const cabezalA = new Mesh(new BoxGeometry(0.1, 0.3, 0.24), mats.cilindroA);
    cabezalA.position.set(-0.06, 0.0, 0.24);
    objs.vastagoAGroup.add(barraA, cabezalA);
    cylAGroup.add(objs.vastagoAGroup);

    // Sensores magnéticos Reed a0 (%I0.2) y a1 (%I0.3) y solenoide YA (%Q0.0)
    const geomLed = new SphereGeometry(0.048, 16, 16);
    objs.ledA0 = new Mesh(geomLed, mats.ledOnSensor);
    objs.ledA0.position.set(-1.38, -0.22, 0.44);
    objs.ledA1 = new Mesh(geomLed, mats.ledOff);
    objs.ledA1.position.set(-0.68, -0.22, 0.44);
    objs.ledYA = new Mesh(geomLed, mats.ledOff);
    objs.ledYA.position.set(-1.05, 0.24, 0.44);
    cylAGroup.add(objs.ledA0, objs.ledA1, objs.ledYA);

    stage.scene.add(cylAGroup);

    // 3. CILINDRO B (Biestable, eje Y, carrera 50 mm = 0.48 unidades 3D)
    const cylBGroup = new Group();
    const camisaB = new Mesh(new CylinderGeometry(0.18, 0.18, 0.78, 24), mats.cilindroB);
    camisaB.position.set(0.32, -1.05, 0.24);
    cylBGroup.add(camisaB);

    const tapaBTras = new Mesh(new BoxGeometry(0.38, 0.08, 0.38), mats.estructura);
    tapaBTras.position.set(0.32, -1.44, 0.24);
    const tapaBDel = new Mesh(new BoxGeometry(0.38, 0.08, 0.38), mats.estructura);
    tapaBDel.position.set(0.32, -0.66, 0.24);
    cylBGroup.add(tapaBTras, tapaBDel);

    // Grupo móvil del vástago B + mordaza de sujeción de alta fuerza
    objs.vastagoBGroup = new Group();
    const barraB = new Mesh(new CylinderGeometry(0.06, 0.06, 0.75, 16), mats.vastago);
    barraB.position.set(0.32, -0.62, 0.24);
    const mordazaB = new Mesh(new BoxGeometry(0.36, 0.1, 0.26), mats.cilindroB);
    mordazaB.position.set(0.32, -0.24, 0.24);
    objs.vastagoBGroup.add(barraB, mordazaB);
    cylBGroup.add(objs.vastagoBGroup);

    // Sensores Reed b0 (%I0.4), b1 (%I0.5) y doble solenoide biestable YB+ (%Q0.1), YB- (%Q0.2)
    objs.ledB0 = new Mesh(geomLed, mats.ledOnSensor);
    objs.ledB0.position.set(0.08, -1.32, 0.45);
    objs.ledB1 = new Mesh(geomLed, mats.ledOff);
    objs.ledB1.position.set(0.08, -0.74, 0.45);
    objs.ledYBPlus = new Mesh(geomLed, mats.ledOff);
    objs.ledYBPlus.position.set(0.56, -0.88, 0.45);
    objs.ledYBMinus = new Mesh(geomLed, mats.ledOff);
    objs.ledYBMinus.position.set(0.56, -1.22, 0.45);
    cylBGroup.add(objs.ledB0, objs.ledB1, objs.ledYBPlus, objs.ledYBMinus);

    stage.scene.add(cylBGroup);

    // 4. HUSILLO MOTOR TRIFÁSICO M1 (Columna vertical Z sobre la cuna)
    const columnaZ = new Mesh(new BoxGeometry(0.22, 0.22, 1.55), mats.estructura);
    columnaZ.position.set(0.88, 0.32, 0.82);
    const brazoZ = new Mesh(new BoxGeometry(0.68, 0.24, 0.16), mats.estructura);
    brazoZ.position.set(0.56, 0.14, 1.48);
    stage.scene.add(columnaZ, brazoZ);

    objs.cabezalMotorGroup = new Group();
    objs.cabezalMotorGroup.position.set(0.32, 0.0, 1.15);

    const carcasaMotor = new Mesh(new CylinderGeometry(0.22, 0.22, 0.48, 24), mats.motor);
    carcasaMotor.rotation.x = Math.PI / 2;
    carcasaMotor.position.set(0, 0, 0.22);
    objs.cabezalMotorGroup.add(carcasaMotor);

    // LED contactor KM1 (%Q0.3)
    objs.ledKM1 = new Mesh(geomLed, mats.ledOff);
    objs.ledKM1.position.set(-0.26, -0.1, 0.26);
    objs.cabezalMotorGroup.add(objs.ledKM1);

    // Husillo rotatorio + herramienta de corte + aletas indicadoras de giro horario (CW)
    objs.husilloRotGroup = new Group();
    const portabrocas = new Mesh(new CylinderGeometry(0.09, 0.07, 0.22, 16), mats.estructura);
    portabrocas.rotation.x = Math.PI / 2;
    portabrocas.position.set(0, 0, -0.08);

    const broca = new Mesh(new ConeGeometry(0.055, 0.32, 16), mats.vastago);
    broca.rotation.x = -Math.PI / 2;
    broca.position.set(0, 0, -0.32);

    // Dos aletas radiales en el portabrocas para visualizar con claridad la rotación horaria
    const aleta1 = new Mesh(new BoxGeometry(0.32, 0.035, 0.05), mats.resorte);
    aleta1.position.set(0, 0, -0.06);
    const aleta2 = new Mesh(new BoxGeometry(0.035, 0.32, 0.05), mats.resorte);
    aleta2.position.set(0, 0, -0.06);

    objs.husilloRotGroup.add(portabrocas, broca, aleta1, aleta2);
    objs.cabezalMotorGroup.add(objs.husilloRotGroup);
    stage.scene.add(objs.cabezalMotorGroup);

    // 5. Etiquetas 3D (troika-three-text) siempre orientadas hacia la cámara
    objs.lblCylA = stage.makeLabel('Cilindro A (Monoestable · Muelle)', {
      size: 0.1,
      anchorX: 'center',
    });
    objs.lblCylA.position.set(-1.05, 0.0, 0.66);

    objs.lblSensA = stage.makeLabel('a0=1 · a1=0 · YA=0', {
      size: 0.085,
      anchorX: 'center',
    });
    objs.lblSensA.position.set(-1.05, -0.32, 0.54);

    objs.lblCylB = stage.makeLabel('Cilindro B (Biestable · Memoria)', {
      size: 0.1,
      anchorX: 'center',
    });
    objs.lblCylB.position.set(0.32, -1.05, 0.66);

    objs.lblSensB = stage.makeLabel('b0=1 · b1=0 · YB+=0 · YB-=0', {
      size: 0.085,
      anchorX: 'center',
    });
    objs.lblSensB.position.set(0.32, -1.48, 0.56);

    objs.lblMotor = stage.makeLabel('Husillo Trifásico M1 (KM1=0)', {
      size: 0.1,
      anchorX: 'center',
    });
    objs.lblMotor.position.set(0.32, 0.0, 1.68);

    objs.lblEtapa = stage.makeLabel('Etapa 1: A+ (Alimentación)', {
      size: 0.12,
      anchorX: 'center',
    });
    objs.lblEtapa.position.set(-0.35, 0.85, 0.85);

    stage.scene.add(objs.lblCylA, objs.lblSensA, objs.lblCylB, objs.lblSensB, objs.lblMotor, objs.lblEtapa);
  }

  function obtenerEtapaActiva() {
    return params.modo === 'auto' ? etapaAuto : Math.round(params.etapaManual);
  }

  function emitirInfo(estado) {
    const fA = fuerzaCilindroA(params.presionBar);
    const fB = fuerzaClampeoB(params.presionBar);
    const velM = velocidadMotor(60, 4, 0.04);
    const tiempos = calcularTiemposCiclo(5.0, params.presionBar);

    const estadoSeguridad = params.falloTermico
      ? { label: 'Seguridad (RT1)', value: 'PARO POR FALLO TÉRMICO (95-96 abierto)', state: 'inestable' }
      : params.corteElectrico
        ? {
            label: 'Tensión 24 VDC',
            value: 'CORTE ELÉCTRICO (A retorna, B mantiene estado)',
            state: 'inestable',
          }
        : { label: 'Estado Operativo', value: `${estado.fase} — ${estado.titulo}`, state: 'estable' };

    onInfo?.({
      latex: String.raw`Y_A = M_1 + M_4 + M_5 + M_6,\quad Y_{B-} = M_3,\quad Y_{B+} = M_5,\quad KM_1 = M_6 \cdot RT_1`,
      readouts: [
        estadoSeguridad,
        {
          label: 'Cilindro A (Monoestable)',
          value: `${estado.posA_mm} mm (a0=${estado.sensores.a0}, a1=${estado.sensores.a1}, YA=${estado.salidas.YA})`,
        },
        {
          label: 'Cilindro B (Biestable)',
          value: `${estado.posB_mm} mm (b0=${estado.sensores.b0}, b1=${estado.sensores.b1}, YB+=${estado.salidas.YB_plus}, YB-=${estado.salidas.YB_minus})`,
        },
        {
          label: 'Motor Trifásico M1',
          value: estado.salidas.KM1 === 1 ? `GIRO DERECHA CW (${velM.nNominal_rpm} rpm)` : 'Detenido (0 rpm)',
        },
        {
          label: 'Fuerza neta A+ / Clampeo B+',
          value: `${fA.fuerzaEfectiva_N.toFixed(1)} N / ${fB.fuerzaEfectiva_N.toFixed(1)} N`,
        },
        {
          label: 'Tiempo total de ciclo',
          value: `${tiempos.tiempoTotal_s.toFixed(2)} s`,
        },
      ],
      aria: `Célula de mecanizado en ${estado.titulo}. Cilindro A en ${estado.posA_mm} milímetros, Cilindro B en ${estado.posB_mm} milímetros, motor trifásico ${estado.salidas.KM1 ? 'girando hacia la derecha' : 'detenido'}.`,
      table: {
        caption: 'Tabla de estados GRAFCET (IEC 60848) de la Célula de Mecanizado',
        columns: ['Etapa', 'Acción', 'A (mm)', 'B (mm)', 'YA (%Q0.0)', 'YB+ (%Q0.1)', 'YB- (%Q0.2)', 'KM1 (%Q0.3)'],
        rows: [0, 1, 2, 3, 4, 5, 6].map((e) => {
          const st = estadoGrafcet(e, {
            corteElectrico: params.corteElectrico,
            falloTermico: params.falloTermico,
          });
          return [
            `E${e}`,
            st.titulo,
            st.posA_mm,
            st.posB_mm,
            st.salidas.YA,
            st.salidas.YB_plus,
            st.salidas.YB_minus,
            st.salidas.KM1,
          ];
        }),
      },
    });
  }

  function aplicarEstadoVisual(estado, dt) {
    const targetA = estado.posA_mm / 100;
    const targetB = estado.posB_mm / 50;
    const targetSpindleZ = estado.salidas.KM1 === 1 ? -0.16 : 0;

    const lambda = stage.reducedMotion ? 60 : 8 * Math.max(0.5, params.velocidad);
    animA = damp(animA, targetA, lambda, dt);
    animB = damp(animB, targetB, lambda, dt);
    animSpindleZ = damp(animSpindleZ, targetSpindleZ, lambda, dt);

    // Desplazamiento del vástago A (carrera visual 0.56 u)
    const despA = animA * 0.56;
    objs.vastagoAGroup.position.x = despA;

    // Compresión realista del muelle de retorno de A cuando el vástago avanza
    objs.espirasMuelleA.forEach((espira, i) => {
      const spanMuelle = 0.34 - animA * 0.16;
      espira.position.x = -0.52 + despA + (i / 5) * spanMuelle;
    });

    // Desplazamiento del vástago B (carrera visual 0.42 u)
    const despB = animB * 0.42;
    objs.vastagoBGroup.position.y = despB;

    // Posición de la pieza en la cuna (pequeño asentamiento en Etapa 1/2 y fijación en Etapa 4/5)
    objs.pieza.position.x = 0.28 + animA * 0.08;
    objs.pieza.position.y = 0.0 + animB * 0.04;

    // Descenso y rotación horaria (CW vista superior: ángulo Z negativo) del husillo M1
    objs.cabezalMotorGroup.position.z = 1.15 + animSpindleZ;
    if (estado.salidas.KM1 === 1 && !stage.reducedMotion) {
      anguloHusillo -= dt * 14 * Math.max(0.5, params.velocidad);
      objs.husilloRotGroup.rotation.z = anguloHusillo;
    }

    // Actualizar indicadores LED de sensores y bobinas
    objs.ledA0.material = estado.sensores.a0 ? mats.ledOnSensor : mats.ledOff;
    objs.ledA1.material = estado.sensores.a1 ? mats.ledOnSensor : mats.ledOff;
    objs.ledYA.material = estado.salidas.YA ? mats.ledOnBobina : mats.ledOff;

    objs.ledB0.material = estado.sensores.b0 ? mats.ledOnSensor : mats.ledOff;
    objs.ledB1.material = estado.sensores.b1 ? mats.ledOnSensor : mats.ledOff;
    objs.ledYBPlus.material = estado.salidas.YB_plus ? mats.ledOnBobina : mats.ledOff;
    objs.ledYBMinus.material = estado.salidas.YB_minus ? mats.ledOnBobina : mats.ledOff;

    objs.ledKM1.material = params.falloTermico ? mats.ledAlarma : estado.salidas.KM1 ? mats.ledOnBobina : mats.ledOff;

    // Etiquetas 3D dinámicas
    stage.setLabel(objs.lblSensA, `a0=${estado.sensores.a0} · a1=${estado.sensores.a1} · YA=${estado.salidas.YA}`);
    stage.setLabel(
      objs.lblSensB,
      `b0=${estado.sensores.b0} · b1=${estado.sensores.b1} · YB+=${estado.salidas.YB_plus} · YB-=${estado.salidas.YB_minus}`
    );
    stage.setLabel(
      objs.lblMotor,
      estado.salidas.KM1 ? 'Husillo Trifásico M1: GIRO DERECHA (KM1=1)' : 'Husillo Trifásico M1: Detenido (KM1=0)'
    );
    stage.setLabel(objs.lblEtapa, `${estado.fase} · ${estado.titulo}`);
  }

  function tick(dt) {
    if (params.modo === 'auto' && !params.corteElectrico && !params.falloTermico) {
      relojEtapa += dt * params.velocidad;
      const dur = DURACIONES_AUTO[etapaAuto] ?? 1.8;
      if (relojEtapa >= dur) {
        relojEtapa = 0;
        etapaAuto = etapaAuto >= 6 ? 0 : etapaAuto + 1;
      }
    }

    const etapa = obtenerEtapaActiva();
    const estado = estadoGrafcet(etapa, {
      corteElectrico: params.corteElectrico,
      falloTermico: params.falloTermico,
    });

    aplicarEstadoVisual(estado, dt);

    const claveInfo = `${etapa}-${params.presionBar}-${params.corteElectrico}-${params.falloTermico}`;
    if (claveInfo !== ultimoEstadoInfo) {
      ultimoEstadoInfo = claveInfo;
      emitirInfo(estado);
    }
    return true;
  }

  function update(p) {
    Object.assign(params, p);
    ultimoEstadoInfo = '';
    const etapa = obtenerEtapaActiva();
    const estado = estadoGrafcet(etapa, {
      corteElectrico: params.corteElectrico,
      falloTermico: params.falloTermico,
    });
    aplicarEstadoVisual(estado, 0.05);
    emitirInfo(estado);
    stage.requestRender();
  }

  function restyle() {
    const theme = stage.refreshTheme();
    actualizarColoresMateriales(theme);
    for (const lbl of [objs.lblCylA, objs.lblSensA, objs.lblCylB, objs.lblSensB, objs.lblMotor, objs.lblEtapa]) {
      lbl.color = theme.text;
    }
    stage.scene.remove(objs.grid);
    objs.grid.geometry.dispose();
    objs.grid.material.dispose();
    objs.grid = stage.makeGrid(4.4, 16);
    objs.grid.position.z = -0.02;
    stage.scene.add(objs.grid);
    stage.requestRender();
  }

  return {
    mount() {
      stage = createStage(container, {
        ariaLabel,
        camera: [-2.1, -2.9, 2.35],
        target: [-0.15, -0.15, 0.45],
        fov: 40,
      });
      buildStatic();
      stage.onTick(tick);
      update(params);
      stage.start();
    },
    update,
    resize: () => stage.resize(),
    restyle,
    dispose: () => stage?.dispose(),
    get renderer() {
      return stage?.renderer;
    },
  };
}
