/**
 * Registro de capítulos (orden de navegación). Cada módulo se carga bajo demanda.
 */
export const CAPITULOS = [
  {
    id: '01-introduccion',
    numero: 1,
    titulo: 'Introducción al proyecto',
    corto: 'Introducción',
    subtitulo: 'Contexto, objetivo y subsistemas de la estación',
    resumen: 'Qué hace la máquina y cómo se reparte entre transportes, mesa, herramientas y auxiliares.',
    icono: 'book',
    minutos: 3,
    load: () => import('../modules/01-introduccion/index.js'),
  },
  {
    id: '02-simulacion',
    numero: 2,
    titulo: 'Figura 1 · Simulación 3D de la estación',
    corto: 'Simulación 3D',
    subtitulo: 'Plano de automatización animado con la lógica GP, GL/GM y GS del S7-1200',
    resumen:
      'Ejecuta ciclos, acciona la emergencia y observa la reposición temporizada con prioridad A, C antes de B, D.',
    icono: 'cpu',
    minutos: 15,
    load: () => import('../modules/02-simulacion/index.js'),
  },
  {
    id: '03-diagrama-fases',
    numero: 3,
    titulo: 'Diagrama de fases del proceso',
    corto: 'Diagrama de fases',
    subtitulo: 'Diagrama espacio-fase de los pasos 1 a 7 = 1 y su correspondencia con el GRAFCET',
    resumen: 'Recorre cada intervalo, compara la planta de once actuadores con el banco de cuatro cilindros.',
    icono: 'steps',
    minutos: 10,
    load: () => import('../modules/03-diagrama-fases/index.js'),
  },
];

export const CAPITULO_IDS = CAPITULOS.map((c) => c.id);

export const findCapitulo = (id) => CAPITULOS.find((c) => c.id === id) ?? null;
