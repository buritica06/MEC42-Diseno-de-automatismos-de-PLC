import html from './contenido.html?raw';
import { createChapter } from '../chapter.js';

export default createChapter({
  html,
  objetivos: [
    'Observar en 3D el ciclo automático completo y relacionar cada etapa del GRAFCET con sus sensores y solenoides.',
    'Comprobar la respuesta del automatismo ante el paro de emergencia, una fuga de presión y un atasco del carro.',
  ],
  presets: {
    maquina: {
      params: { velocidad: 1, continuo: true, autoInicio: true },
    },
  },
});
