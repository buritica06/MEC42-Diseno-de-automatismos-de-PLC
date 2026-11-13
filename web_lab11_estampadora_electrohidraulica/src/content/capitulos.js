/**
 * Registro de capítulos. El orden de esta lista es el orden de navegación.
 */
export const CAPITULOS = [
  {
    id: '01-introduccion',
    numero: 1,
    titulo: 'Introducción al proyecto',
    corto: 'Introducción',
    subtitulo: 'Prensa estampadora electrohidráulica con dos redes de presión',
    resumen: 'Qué hace la máquina, qué subsistemas la componen y qué gobierna el PLC.',
    icono: 'book',
    minutos: 5,
    load: () => import('../modules/01-introduccion/index.js'),
  },
  {
    id: '02-simulacion',
    numero: 2,
    titulo: 'Figura 1: simulación 3D',
    corto: 'Simulación 3D',
    subtitulo: 'Plano de situación animado con el ciclo automático completo',
    resumen: 'Sujeción, avance, estampado, retroceso y expulsión, con paro de emergencia y fallas de diagnóstico.',
    icono: 'play',
    minutos: 15,
    load: () => import('../modules/02-simulacion/index.js'),
  },
  {
    id: '03-fases',
    numero: 3,
    titulo: 'Diagrama de fases',
    corto: 'Diagrama de fases',
    subtitulo: 'Espacio-fase VDI 3260 con los enlaces de señal del ciclo',
    resumen: 'Recorre los ocho pasos y lee qué señal provoca cada movimiento.',
    icono: 'steps',
    minutos: 10,
    load: () => import('../modules/03-fases/index.js'),
  },
  {
    id: '04-gantt',
    numero: 4,
    titulo: 'Diagrama de Gantt',
    corto: 'Gantt',
    subtitulo: 'Planificación del reto y ejecución del ciclo',
    resumen: 'Distribución de las 4 horas de taller y cronograma real de los actuadores.',
    icono: 'clock',
    minutos: 5,
    load: () => import('../modules/04-gantt/index.js'),
  },
];

export const CAPITULO_IDS = CAPITULOS.map((c) => c.id);

export const findCapitulo = (id) => CAPITULOS.find((c) => c.id === id) ?? null;
