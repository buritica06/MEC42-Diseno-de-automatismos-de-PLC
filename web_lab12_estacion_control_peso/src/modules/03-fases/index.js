import { createChapter } from '../chapter.js';
import { montarDiagramaFases } from '../../components/diagramaFases.js';
import { ETAPAS, medirCiclo } from '../../viz/three/estacionPesoLogica.js';

const html = `
<p>
  El <strong>diagrama espacio-fase</strong> (norma VDI 3260) representa gráficamente el estado (0 o 1) de cada actuador en cada fase del proceso. A diferencia de un cronograma, el eje horizontal indica pasos secuenciales y enlaces causales, no tiempo físico.
</p>
<div class="wide" data-fases></div>

<h2 id="secuencia">Secuencia del GRAFCET de Producción (IEC 60848)</h2>
<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th scope="col">Etapa</th>
        <th scope="col">Acción asociada</th>
        <th scope="col">Salidas energizadas</th>
        <th scope="col">Receptividad de transición</th>
      </tr>
    </thead>
    <tbody>
      ${ETAPAS.map((e) => `<tr><td><strong>${e.n}</strong></td><td>${e.accion}</td><td><code>${e.salidas}</code></td><td>${e.transicion}</td></tr>`).join('')}
    </tbody>
  </table>
</div>

<div class="callout callout--thm" role="note">
  <span class="callout__title">Divergencia y Convergencia en OR</span>
  <p>
    En la etapa 4, tras completarse el pesaje libre (\\(T1 = 3\\text{ s}\\)) y bloquearse la báscula (\\(B4 = 1\\)), el GRAFCET abre una divergencia en OR con dos receptividades mutuamente excluyentes: \\(B4 \\cdot S4\\) para piezas conformes (etapas 5 a 8) y \\(B4 \\cdot \\overline{S4}\\) para piezas defectuosas (etapas 9 y 10). Ambas ramas convergen en OR hacia la etapa inicial 0 para iniciar el siguiente ciclo.
  </p>
</div>
`;

export default createChapter({
  html,
  objetivos: [
    'Interpretar el diagrama espacio-fase identificando el inicio invertido del cilindro B (nivel 1) y la bifurcación alternativa C/D.',
    'Relacionar cada paso del proceso con su correspondiente etapa en el GRAFCET y sus salidas físicas en el PLC S7-1200.',
    'Verificar las condiciones de seguridad en las transiciones de pesaje y clasificación.',
  ],
  setup(root, ctx) {
    const tramos = medirCiclo('ok');
    const duraciones = tramos.map((s) => s.fin - s.inicio);
    ctx.track(montarDiagramaFases(root.querySelector('[data-fases]'), { duraciones }));
  },
});
