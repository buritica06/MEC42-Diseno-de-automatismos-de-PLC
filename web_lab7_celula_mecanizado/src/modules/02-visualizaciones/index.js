import html from './contenido.html?raw';
import { createChapter } from '../chapter.js';

export default createChapter({
  html,
  objetivos: [
    'Inspeccionar en 3D el sincronismo espacial entre el cilindro A (monoestable), el cilindro B (biestable) y el husillo trifásico M1.',
    'Comprobar experimentalmente el efecto de un corte eléctrico de 24 VDC y del disparo térmico RT1 sobre la sujeción de la pieza y el giro del motor.',
    'Analizar el diagrama espacio-fase y la sensibilidad del tiempo de ciclo frente a variaciones en la presión neumática y el temporizador TON.',
  ],
  presets: {
    celula3d: {
      titulo: 'Gemelo Digital 3D — Célula de Mecanizado (A Monoestable, B Biestable, Motor M1)',
      descripcion:
        'Explora en 3D el ciclo automático GRAFCET o inspecciona manualmente cada etapa (0 a 6). Simula cortes de 24 VDC y fallos térmicos RT1 desde el panel lateral.',
      params: {
        modo: 'auto',
        etapaManual: 1,
        presionBar: 6,
        velocidad: 1,
        corteElectrico: false,
        falloTermico: false,
      },
    },
    fasesPlc: {
      titulo: 'Diagrama Espacio-Fase y Sincronismo de Actuadores (A, B, YB-, KM1)',
      descripcion:
        'Trayectorias de desplazamiento de los cilindros A (100 mm) y B (50 mm) junto con los pulsos lógicos de YB- y KM1.',
      params: {
        ejeHorizontal: 'fases',
        tMecanizado: 5,
        presionBar: 6,
        mostrarSolenoides: true,
      },
    },
    tiemposFases: {
      titulo: 'Duración por Etapa GRAFCET según Presión Neumática',
      descripcion:
        'Comparación de tiempos de ejecución por etapa entre operación nominal (6 bar) y baja presión en red (4 bar).',
      params: {
        tipo: 'barras',
        titulo: 'Duración por fase del ciclo GRAFCET (s)',
        ejeX: 'Etapa de la secuencia',
        ejeY: 'Duración (s)',
        etiquetas: [
          'E1: A+ (Avance 1)',
          'E2: A- (Retorno)',
          'E3: B- (Homing)',
          'E4: A+ (Fijación)',
          'E5: B+ (Clampeo)',
          'E6: Motor M1 (CW)',
        ],
        series: [
          { nombre: 'Presión nominal (6 bar)', valores: [0.8, 0.7, 0.5, 0.8, 0.6, 5.0] },
          { nombre: 'Baja presión (4 bar)', valores: [0.98, 0.86, 0.5, 0.98, 0.73, 5.0] },
        ],
      },
    },
  },
});
