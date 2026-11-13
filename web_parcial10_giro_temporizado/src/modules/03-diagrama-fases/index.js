import html from './contenido.html?raw';
import { createChapter } from '../chapter.js';
import { montarEspacioFase } from '../../diagrams/espacioFase.js';

export default createChapter({
  html,
  objetivos: [
    'Interpretar el diagrama espacio-fase completo, con sensores de planta y equivalentes de banco.',
    'Asociar cada intervalo con las etapas del GRAFCET GP y sus receptividades.',
  ],
  setup(root, ctx) {
    const el = root.querySelector('[data-diagrama="espacio-fase"]');
    ctx.track(montarEspacioFase(el));
  },
});
