/**
 * Registro de capítulos de la Práctica N.º 07: Célula de Mecanizado (Semana 7).
 */
export const CAPITULOS = [
  {
    id: '01-introduccion',
    numero: 1,
    titulo: 'Contexto Industrial, Actuadores y Modelo GRAFCET',
    corto: 'Teoría y GRAFCET',
    subtitulo: 'Válvulas 5/2 monoestable vs. biestable, rutina de homing B−, GRAFCET IEC 60848 y mapeo I/O',
    resumen:
      'Analiza la seguridad pasiva del Cilindro A, la retención activa de la Mordaza B, el modelo GRAFCET de 7 etapas y las ecuaciones Set/Reset para Siemens S7-1200.',
    icono: 'book',
    minutos: 35,
    load: () => import('../modules/01-introduccion/index.js'),
  },
  {
    id: '02-visualizaciones',
    numero: 2,
    titulo: 'Gemelo Digital 3D y Diagrama de Fases',
    corto: 'Simulación 3D y Fases',
    subtitulo: 'Célula interactiva en 3D (Cilindro A, Mordaza B y Motor M1) y cronograma de desplazamiento-fase',
    resumen:
      'Inspecciona en 3D cada etapa del ciclo, simula un corte eléctrico a 24 VDC para comprobar la retención biestable y explora el diagrama temporal de fases.',
    icono: 'cpu',
    minutos: 40,
    load: () => import('../modules/02-visualizaciones/index.js'),
  },
  {
    id: '03-ejemplos',
    numero: 3,
    titulo: 'Ejemplos de Ingeniería y Procedimiento de Montaje',
    corto: 'Ejemplos y Montaje',
    subtitulo: 'Cálculo de fuerza de clampeo, traducción GRAFCET a Ladder sin doble bobina y guía de 8 pasos',
    resumen:
      'Resuelve el dimensionamiento neumático y eléctrico del husillo, diseña el watchdog TON de amarre y sigue la metodología paso a paso en el banco.',
    icono: 'lightbulb',
    minutos: 35,
    load: () => import('../modules/03-ejemplos/index.js'),
  },
  {
    id: '04-actividades',
    numero: 4,
    titulo: 'Actividades y Cuestiones del Laboratorio',
    corto: 'Actividades',
    subtitulo: 'Autoevaluación de seguridad de actuadores, lógica Ladder, cálculos neumáticos y análisis de fallas',
    resumen:
      'Ocho ejercicios interactivos con corrección inmediata que validan los conceptos y las cinco cuestiones técnicas del informe de laboratorio.',
    icono: 'pencil',
    minutos: 35,
    load: () => import('../modules/04-actividades/index.js'),
  },
  {
    id: '05-cierre',
    numero: 5,
    titulo: 'Seguridad Eléctrica (5 Reglas de Oro) y Rúbrica',
    corto: 'Seguridad y Rúbrica',
    subtitulo: 'Las 5 Reglas de Oro RETIE, recomendaciones de taller, análisis de resultados y rúbrica oficial',
    resumen:
      'Revisa el protocolo obligatorio de desconexión y bloqueo LOTO, la advertencia crítica de seguridad y los criterios de calificación práctica (5.0 / 2.0 / 0.0).',
    icono: 'target',
    minutos: 25,
    load: () => import('../modules/05-cierre/index.js'),
  },
];

export const CAPITULO_IDS = CAPITULOS.map((c) => c.id);

export const findCapitulo = (id) => CAPITULOS.find((c) => c.id === id) ?? null;
