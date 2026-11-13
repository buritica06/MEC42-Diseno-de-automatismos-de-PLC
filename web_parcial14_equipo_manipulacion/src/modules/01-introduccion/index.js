import html from './contenido.html?raw';
import { createChapter } from '../chapter.js';

export default createChapter({
  html,
  objetivos: [
    'Identificar los cuatro actuadores del manipulador y la válvula que gobierna cada uno.',
    'Explicar por qué la parada de emergencia trata distinto a la zona A-B-C y a la unidad giratoria D.',
  ],
});
