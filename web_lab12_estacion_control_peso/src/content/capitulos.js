/**
 * Registro de capítulos. El orden de esta lista es el orden de navegación.
 */
export const CAPITULOS = [
  {
    id: '01-introduccion',
    numero: 1,
    titulo: 'Introducción al proyecto',
    corto: 'Introducción',
    subtitulo: 'Estación de control de peso, verificación de tolerancia y clasificación',
    resumen:
      'Contexto del proceso industrial, objetivos, inventario de actuadores electroneumáticos y asignación PLC S7-1200.',
    icono: 'book',
    minutos: 5,
    load: () => import('../modules/01-introduccion/index.js'),
  },
  {
    id: '02-simulacion',
    numero: 2,
    titulo: 'Plano de situación: simulación 3D',
    corto: 'Simulación 3D',
    subtitulo: 'Lámina 1 animada: pesaje, clasificación, pruebas de seguridad y fallas',
    resumen:
      'Alimentación (A), bloqueo de báscula (B), pesaje (T1), clasificación OK con el empujador de C y la cinta H1 o rechazo NOK con D, vigilancia por etapa e inyección de fallas.',
    icono: 'play',
    minutos: 15,
    load: () => import('../modules/02-simulacion/index.js'),
  },
  {
    id: '03-fases',
    numero: 3,
    titulo: 'Diagrama de fases',
    corto: 'Diagrama de fases',
    subtitulo: 'Espacio-fase con bifurcación alternativa (divergencia OR)',
    resumen:
      'Evolución de los cuatro cilindros, condición de reposo invertida en B y selección de trayectoria según tolerancia S4.',
    icono: 'steps',
    minutos: 10,
    load: () => import('../modules/03-fases/index.js'),
  },
  {
    id: '04-gantt',
    numero: 4,
    titulo: 'Diagrama de Gantt',
    corto: 'Gantt',
    subtitulo: 'Planificación del taller (4 h) y cronogramas de ejecución',
    resumen: 'Distribución de las sesiones de laboratorio y tiempos reales de ciclo en las rutas OK y NOK.',
    icono: 'clock',
    minutos: 5,
    load: () => import('../modules/04-gantt/index.js'),
  },
];

export const CAPITULO_IDS = CAPITULOS.map((c) => c.id);

export const findCapitulo = (id) => CAPITULOS.find((c) => c.id === id) ?? null;
