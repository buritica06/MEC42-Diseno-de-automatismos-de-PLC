import html from './contenido.html?raw';
import { createChapter } from '../chapter.js';

export default createChapter({
  html,
  objetivos: ['[Resultado de aprendizaje que se practica con estos ejemplos.]'],
  presets: {
    crecimiento: {
      titulo: 'Crecimiento del cultivo',
      descripcion: 'Cambia la población inicial (a) y la tasa de crecimiento (b).',
      params: {
        expresion: 'a*exp(b*x)',
        a: 5,
        b: 0.3,
        xMin: 0,
        xMax: 10,
        titulo: 'Población del cultivo',
        ejeX: 'Tiempo (h)',
        ejeY: 'Población (miles)',
      },
    },
  },
});
