import html from './contenido.html?raw';
import { createChapter } from '../chapter.js';

export default createChapter({
  html,
  objetivos: [
    'Comprender el funcionamiento de la estación de control de peso y la función de cada cilindro electroneumático.',
    'Identificar la condición inicial invertida del cilindro B y el principio de seguridad positiva en el pulsador NC S6.',
    'Explicar el papel de los temporizadores TON T1 (pesaje) y T2 (evacuación de cinta) y la divergencia en OR según S4.',
  ],
});
