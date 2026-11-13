import html from './contenido.html?raw';
import { createChapter } from '../chapter.js';

export default createChapter({
  html,
  objetivos: [
    'Identificar los cuatro actuadores de la estampadora y la válvula que gobierna cada uno.',
    'Explicar por qué la sujeción trabaja a 100 bar y el resto del circuito a 40 bar.',
  ],
});
