import html from './contenido.html?raw';
import { createChapter } from '../chapter.js';

export default createChapter({
  html,
  objetivos: ['[Primer resultado de aprendizaje, con un verbo observable.]', '[Segundo resultado de aprendizaje.]'],
});
