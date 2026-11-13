import html from './contenido.html?raw';
import { createChapter } from '../chapter.js';

export default createChapter({
  html,
  objetivos: [
    'Relacionar cada etapa de GP, GL/GM y GS con los movimientos, sensores y salidas que produce en la planta.',
    'Verificar la retención de ventosas en emergencia y el orden de retorno A, C → B, D en la reposición.',
  ],
  presets: {
    estacion: { params: { velocidad: 1 } },
  },
});
