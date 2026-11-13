import html from './contenido.html?raw';
import { createChapter } from '../chapter.js';

export default createChapter({
  html,
  objetivos: [
    'Observar en 3D el funcionamiento dinámico de la estación de control de peso y su correspondencia con el GRAFCET.',
    'Verificar la divergencia en OR evaluando las rutas alternativas de clasificación (cilindros C y D).',
    'Comprobar la respuesta de la máquina ante la parada de fin de ciclo, la rotura del cable de S6 y el corte de tensión de mando (tabla de resultados de la guía).',
    'Provocar atascos y fallas de sensor para observar la vigilancia por etapa de 5 s.',
  ],
  presets: {
    estacion: {
      params: { velocidad: 1, modoTolerancia: 'aleatorio', cableS6Roto: false, autoInicio: true },
    },
  },
});
