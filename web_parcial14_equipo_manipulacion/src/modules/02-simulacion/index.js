import html from './contenido.html?raw';
import { createChapter } from '../chapter.js';

export default createChapter({
  html,
  objetivos: [
    'Relacionar cada etapa del GRAFCET con el movimiento, los sensores y las bobinas del manipulador.',
    'Comprobar la parada de emergencia, la reposición de D, el fin de lote y la falta de material.',
  ],
  presets: {
    maquina: {
      params: { velocidad: 1, autoInicio: true },
    },
  },
});
