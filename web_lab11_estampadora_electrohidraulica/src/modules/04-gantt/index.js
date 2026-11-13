import { createChapter } from '../chapter.js';
import { gantt } from '../../components/gantt.js';
import { medirCiclo } from '../../viz/three/estampadoraLogica.js';

/** Plan propuesto para las 4 horas de taller (240 min). Ajusta los tiempos a tu grupo. */
const PLAN = {
  titulo: 'Planificación y ejecución del reto (4 h de taller)',
  unidad: 'min',
  total: 240,
  marca: 30,
  grupos: [
    {
      nombre: 'Planificación',
      tono: 1,
      tareas: [
        { nombre: 'Lectura del reto y plano de situación', inicio: 0, fin: 20 },
        { nombre: 'Análisis del esquema hidráulico', inicio: 20, fin: 45 },
        { nombre: 'Diagrama de fases VDI 3260', inicio: 40, fin: 70 },
        { nombre: 'GRAFCET GP y GS', inicio: 60, fin: 95 },
      ],
    },
    {
      nombre: 'Ejecución',
      tono: 3,
      tareas: [
        { nombre: 'Esquema eléctrico de mando 24 V DC', inicio: 90, fin: 120 },
        { nombre: 'Programación S7-1200 en TIA Portal', inicio: 115, fin: 170 },
        { nombre: 'Simulación y puesta en marcha', inicio: 160, fin: 195 },
        { nombre: 'Pruebas de S0, rearme y fallas', inicio: 190, fin: 215 },
      ],
    },
    {
      nombre: 'Cierre',
      tono: 2,
      tareas: [
        { nombre: 'Cuestionario y casos de diagnóstico', inicio: 205, fin: 232 },
        { nombre: 'Entrega y sustentación', inicio: 230, fin: 240 },
      ],
    },
  ],
};

const MOVIMIENTOS = [
  '',
  'A+ sujeción',
  'B+ avance',
  'D estampado (t1)',
  'B− retroceso',
  'A− apertura',
  'C+ expulsión',
  'C− descenso',
];
const TONOS = [0, 3, 1, 2, 1, 3, 4, 4];

/** Cronograma del ciclo con los tiempos que produce la simulación a velocidad 1×. */
function cicloComoGantt() {
  const tramos = medirCiclo();
  const total = Math.ceil(tramos.at(-1).fin);
  return {
    titulo: `Ejecución de un ciclo automático (${tramos.at(-1).fin.toFixed(1)} s)`,
    unidad: 's',
    total,
    marca: 1,
    decimales: 1,
    grupos: tramos.map((t) => ({
      nombre: `Etapa ${t.etapa}`,
      tono: TONOS[t.etapa],
      tareas: [{ nombre: MOVIMIENTOS[t.etapa], inicio: t.inicio, fin: t.fin }],
    })),
  };
}

export default createChapter({
  html: `
<p>Dos escalas del mismo proyecto: el plan de trabajo del taller y el ciclo de la máquina que resulta de él.</p>
<h2 id="plan">Proyecto</h2>
<div class="wide">${gantt(PLAN)}</div>
<p class="nota">Plan propuesto a partir de la duración de la guía (4 horas presenciales); los solapes indican tareas que se traslapan.</p>
<h2 id="ciclo">Ciclo de la máquina</h2>
<div class="wide gantt--compacto">${gantt({ ...cicloComoGantt(), decimales: 1 })}</div>
<p class="nota">Tiempos medidos sobre la lógica de la simulación 3D; el eje marca segundos enteros.</p>`,
  objetivos: [
    'Organizar las tareas del reto en fases de planificación, ejecución y cierre.',
    'Ubicar en el tiempo cada movimiento del ciclo automático.',
  ],
});
