import html from './contenido.html?raw';
import { createChapter } from '../chapter.js';

export default createChapter({
  html,
  objetivos: [
    'Observar en 3D la secuencia automática completa de la estación, desde la llegada del frasco hasta la tapadora.',
    'Relacionar cada etapa del GRAFCET con sus sensores, cilindros, contactores y el motor del husillo.',
  ],
  presets: {
    estacion: {
      params: { velocidad: 1 },
    },
  },
});
