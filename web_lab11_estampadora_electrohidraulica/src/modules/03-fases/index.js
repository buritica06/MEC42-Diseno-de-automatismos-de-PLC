import { createChapter } from '../chapter.js';
import { montarDiagramaFases } from '../../components/diagramaFases.js';
import { ETAPAS, medirCiclo } from '../../viz/three/estampadoraLogica.js';

const html = `
<p>
  Las líneas verticales son los pasos; cada traza muestra el estado (0 o 1) de un elemento y cada flecha, la señal que
  provoca el cambio. No es un cronograma: importa el orden, no la duración.
</p>
<div class="wide" data-fases></div>

<h2 id="secuencia">Secuencia del GRAFCET de producción</h2>
<div class="table-wrap">
  <table>
    <thead>
      <tr><th scope="col">Etapa</th><th scope="col">Acción</th><th scope="col">Solenoides</th><th scope="col">Receptividad de salida</th></tr>
    </thead>
    <tbody>
      ${ETAPAS.map((e) => `<tr><td>${e.n}</td><td>${e.accion}</td><td>${e.salidas}</td><td>${e.transicion}</td></tr>`).join('')}
    </tbody>
  </table>
</div>

<div class="callout callout--warn" role="note">
  <span class="callout__title">Seguridad (GS)</span>
  <p>
    Con S0, la etapa 11 vacía el GP: Y1 e Y6 caen (retorno por muelle) e Y3 e Y5 se fuerzan, porque la 4/3 de centro
    cerrado y la biestable no vuelven solas. El rearme exige S0 liberado, S2 y \\(B1 \\cdot B3 \\cdot B5\\).
  </p>
</div>`;

export default createChapter({
  html,
  objetivos: [
    'Leer el diagrama espacio-fase VDI 3260 e identificar la señal que inicia cada paso.',
    'Relacionar cada paso con la etapa del GRAFCET y los solenoides energizados.',
  ],
  setup(root, ctx) {
    // Duraciones reales de las etapas 1 a 7, tomadas de la misma lógica que mueve la escena 3D.
    const duraciones = medirCiclo().map((s) => s.fin - s.inicio);
    ctx.track(montarDiagramaFases(root.querySelector('[data-fases]'), { duraciones }));
  },
});
