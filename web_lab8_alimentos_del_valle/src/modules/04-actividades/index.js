import { createChapter } from '../chapter.js';
import { montarActividades } from '../../components/actividades.js';
import { ACTIVIDADES } from './actividades.js';

export default createChapter({
  html: `<p>[Instrucciones de la actividad.] Las respuestas resueltas se guardan en tu progreso, solo en este navegador.</p>`,
  objetivos: ['[Resultado de aprendizaje que se evalúa con estas actividades.]'],
  setup: montarActividades(ACTIVIDADES),
});
