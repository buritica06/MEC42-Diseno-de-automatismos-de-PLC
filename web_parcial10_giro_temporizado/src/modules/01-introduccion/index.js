import html from './contenido.html?raw';
import { createChapter } from '../chapter.js';

export default createChapter({
  html,
  objetivos: [
    'Describir la función de cada subsistema de la estación y su equivalente en el banco de cuatro cilindros.',
  ],
});
