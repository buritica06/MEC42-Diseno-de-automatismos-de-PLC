/**
 * Registro de capítulos. El orden de esta lista es el orden de navegación.
 */
export const CAPITULOS = [
  {
    id: '01-introduccion',
    numero: 1,
    titulo: 'Introducción al proyecto',
    corto: 'Introducción',
    subtitulo: 'Manipulador de 4 ejes con PLC S7-1200',
    resumen: 'Qué hace la máquina, qué actuadores la componen y qué condiciones gobierna el PLC.',
    icono: 'book',
    minutos: 4,
    load: () => import('../modules/01-introduccion/index.js'),
  },
  {
    id: '02-simulacion',
    numero: 2,
    titulo: 'Figura 1: simulación 3D',
    corto: 'Simulación 3D',
    subtitulo: 'Plano de situación animado con el programa SCL del parcial',
    resumen: 'Ciclo doble, lote N, falta de material, emergencia con reposición de D y fallo por vigilancia.',
    icono: 'play',
    minutos: 15,
    load: () => import('../modules/02-simulacion/index.js'),
  },
  {
    id: '03-fases',
    numero: 3,
    titulo: 'Diagrama de fases',
    corto: 'Diagrama de fases',
    subtitulo: '13 líneas de fase, 12 movimientos y dos temporizaciones',
    resumen: 'Recorre la secuencia y lee qué señal provoca cada movimiento.',
    icono: 'steps',
    minutos: 8,
    load: () => import('../modules/03-fases/index.js'),
  },
];

export const CAPITULO_IDS = CAPITULOS.map((c) => c.id);

export const findCapitulo = (id) => CAPITULOS.find((c) => c.id === id) ?? null;
