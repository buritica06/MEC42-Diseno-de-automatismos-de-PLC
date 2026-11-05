/**
 * Registro de capítulos. Este sitio contiene únicamente el capítulo de la simulación 3D.
 */
export const CAPITULOS = [
  {
    id: '02-visualizaciones',
    numero: 2,
    titulo: 'Simulación 3D del proceso',
    corto: 'Simulación 3D',
    subtitulo: 'Estación de dosificación y corte antigoteo de Alimentos Del Valle',
    resumen: 'Ejecuta la secuencia automática completa y observa sensores, cilindros, motor, bandas y frascos.',
    icono: 'play',
    minutos: 20,
    load: () => import('../modules/02-visualizaciones/index.js'),
  },
];

export const CAPITULO_IDS = CAPITULOS.map((c) => c.id);

export const findCapitulo = (id) => CAPITULOS.find((c) => c.id === id) ?? null;
