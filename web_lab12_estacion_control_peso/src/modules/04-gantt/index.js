import { createChapter } from '../chapter.js';
import { gantt } from '../../components/gantt.js';
import { medirCiclo } from '../../viz/three/estacionPesoLogica.js';

/** Plan de 4 horas de taller (240 min) basado en los 8 pasos del procedimiento de la guía. */
const PLAN = {
  titulo: 'Planificación y ejecución del proyecto en taller (4 horas / 240 min)',
  unidad: 'min',
  total: 240,
  marca: 30,
  grupos: [
    {
      nombre: 'Fase 1: Análisis previo y modelado',
      tono: 1,
      tareas: [
        { nombre: 'Paso 1: Análisis de láminas, inventario E/S y GRAFCET con divergencia OR', inicio: 0, fin: 25 },
        { nombre: 'Paso 2: Validación electroneumática en FluidSIM-P (B extendido)', inicio: 20, fin: 50 },
      ],
    },
    {
      nombre: 'Fase 2: Montaje y programación',
      tono: 3,
      tareas: [
        { nombre: 'Paso 3: Conexión neumática a 6 bar y cableado eléctrico PLC S7-1200', inicio: 45, fin: 95 },
        {
          nombre: 'Paso 4: Proyecto TIA Portal, tabla de variables y bloque SCL FB_EstacionPeso',
          inicio: 90,
          fin: 130,
        },
        { nombre: 'Paso 5: Simulación y forzado de estados en PLCSIM', inicio: 125, fin: 155 },
      ],
    },
    {
      nombre: 'Fase 3: Puesta en marcha y validación',
      tono: 2,
      tareas: [
        { nombre: 'Paso 6: Prueba estática de sensores PNP y electroválvulas en planta', inicio: 150, fin: 175 },
        { nombre: 'Paso 7: Validación con presión real: 5 ciclos OK, 5 ciclos NOK y prueba S6', inicio: 170, fin: 215 },
        { nombre: 'Paso 8: Registro de datos, análisis de rendimiento y desmontaje seguro', inicio: 210, fin: 240 },
      ],
    },
  ],
};

const NOMBRES_ETAPAS = {
  1: 'Etapa 1: A+ (Alimentación)',
  2: 'Etapa 2: A− y B− (Desbloqueo)',
  3: 'Etapa 3: Pesaje estático T1 (3 s)',
  4: 'Etapa 4: B+ (Bloqueo báscula)',
  5: 'Etapa 5: C+ (Clasificación OK)',
  6: 'Etapa 6: C− (Retorno por muelle)',
  7: 'Etapa 7: H1 marcha (Cinta hasta S5)',
  8: 'Etapa 8: H1 evacuación final T2 (2 s)',
  9: 'Etapa 9: D+ (Rechazo a canaleta)',
  10: 'Etapa 10: D− (Retorno muelle NOK)',
};

const TONOS_ETAPAS = {
  1: 1, // azul
  2: 1, // azul
  3: 2, // teal/azul claro
  4: 4, // rojo
  5: 3, // verde
  6: 3, // verde
  7: 3, // verde
  8: 3, // verde
  9: 5, // naranja
  10: 5, // naranja
};

function cronogramaCiclo(ruta = 'ok') {
  const tramos = medirCiclo(ruta);
  const total = Math.ceil(tramos.at(-1).fin);
  const nombreRuta = ruta === 'ok' ? 'Ruta Conforme / Pieza OK' : 'Ruta No Conforme / Rechazo NOK';

  return {
    titulo: `Cronograma de ejecución del ciclo: ${nombreRuta} (${tramos.at(-1).fin.toFixed(2)} s)`,
    unidad: 's',
    total,
    marca: 1,
    decimales: 1,
    grupos: tramos.map((t) => ({
      nombre: NOMBRES_ETAPAS[t.etapa] || `Etapa ${t.etapa}`,
      tono: TONOS_ETAPAS[t.etapa] || 1,
      tareas: [{ nombre: NOMBRES_ETAPAS[t.etapa] || `Etapa ${t.etapa}`, inicio: t.inicio, fin: t.fin }],
    })),
  };
}

// Duraciones medidas en el modelo (no se escriben a mano: siguen a la cinemática simulada).
const DURACION = {
  ok: medirCiclo('ok').at(-1).fin.toFixed(1),
  nok: medirCiclo('nok').at(-1).fin.toFixed(1),
};

export default createChapter({
  html: `
<p>
  Se presentan dos escalas de planificación temporal: el <strong>plan de desarrollo del proyecto en el laboratorio</strong> (4 horas presenciales) y los <strong>cronogramas de ejecución cinemática</strong> para las dos alternativas del ciclo automático (rutas OK y NOK).
</p>

<h2 id="plan-taller">Planificación del Proyecto (Taller presencial)</h2>
<div class="wide">${gantt(PLAN)}</div>
<p class="nota">
  Distribución de las 4 horas (240 min) según la metodología de 8 pasos del procedimiento de laboratorio; los traslapes representan actividades paralelas entre integrantes del grupo.
</p>

<h2 id="ciclo-ok">Ejecución del Ciclo: Pieza Conforme (Ruta OK)</h2>
<div class="wide gantt--compacto">${gantt({ ...cronogramaCiclo('ok'), decimales: 1 })}</div>
<p class="nota">
  La ruta conforme involucra los actuadores A, B, C y la cinta H1 gobernada por el sensor S5 y el temporizador T2 (2 s). Duración total simulada: ${DURACION.ok} s.
</p>

<h2 id="ciclo-nok">Ejecución del Ciclo: Pieza Rechazada (Ruta NOK)</h2>
<div class="wide gantt--compacto">${gantt({ ...cronogramaCiclo('nok'), decimales: 1 })}</div>
<p class="nota">
  La ruta de rechazo prescinde de la cinta: tras el bloqueo en la etapa 4, el cilindro D de simple efecto expulsa la pieza a la canaleta en un único avance y retorno por muelle. Duración total simulada: ${DURACION.nok} s.
</p>
`,
  objetivos: [
    'Planificar la ejecución del reto en fases de modelado, montaje, programación en SCL y validación en banco físico.',
    'Comparar la duración cinemática del ciclo en la ruta conforme frente a la ruta de descarte.',
  ],
});
