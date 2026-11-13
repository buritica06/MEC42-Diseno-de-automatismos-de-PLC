import { createChapter } from '../chapter.js';
import { montarDiagramaFases } from '../../components/diagramaFases.js';
import { ETAPAS, medirCiclo } from '../../viz/three/manipuladorLogica.js';

const html = `
<p>
  Las líneas verticales son las fases; cada traza muestra la posición (0 o 1) de un actuador y cada flecha, el sensor
  que provoca el siguiente movimiento. Las líneas rojas marcan las esperas T1 y T2 antes de abrir la pinza.
</p>
<div class="wide" data-fases></div>

<h2 id="secuencia">GRAFCET de producción (GP)</h2>
<div class="table-wrap">
  <table>
    <thead>
      <tr><th scope="col">Etapa</th><th scope="col">Acción</th><th scope="col">Bobinas</th><th scope="col">Receptividad de salida</th></tr>
    </thead>
    <tbody>
      ${ETAPAS.map((e) => `<tr><td>${e.n}</td><td>${e.accion}</td><td>${e.salidas}</td><td>${e.transicion}</td></tr>`).join('')}
    </tbody>
  </table>
</div>

<div class="callout callout--warn" role="note">
  <span class="callout__title">Por qué 15 etapas para 12 movimientos</span>
  <p>
    Las esperas de estabilización (etapas 5 y 12) son etapas propias con su temporizador; la etapa 0 es el reposo.
    El contador C1 se incrementa al franquear la transición 14 → 0.
  </p>
</div>`;

export default createChapter({
  html,
  objetivos: [
    'Leer el diagrama espacio-fase e identificar el sensor que inicia cada movimiento.',
    'Relacionar cada movimiento con su etapa del GRAFCET y las bobinas energizadas.',
  ],
  setup(root, ctx) {
    // Duraciones reales de cada etapa, tomadas de la misma lógica que mueve la escena 3D.
    const duraciones = {};
    for (const s of medirCiclo()) duraciones[s.etapa] = s.fin - s.inicio;
    ctx.track(montarDiagramaFases(root.querySelector('[data-fases]'), { duraciones }));
  },
});
