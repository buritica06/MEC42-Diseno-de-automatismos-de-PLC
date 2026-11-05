import html from './contenido.html?raw';
import { createChapter } from '../chapter.js';

export default createChapter({
  html,
  objetivos: [
    'Calcular la fuerza efectiva de empuje y clampeo en cilindros monoestables y biestables y la corriente nominal del motor trifásico M1.',
    'Diagnosticar y corregir el conflicto de doble bobina en la tabla de imagen de proceso de salidas (PAA) del PLC.',
    'Ejecutar el protocolo de 8 pasos de montaje neumático, eléctrico de control (24 VDC) y de fuerza trifásica (220 VAC) en el banco de pruebas.',
  ],
  presets: {
    fuerzaCilindros: {
      titulo: 'Curva de Fuerza Efectiva del Cilindro en Función de la Presión P (bar)',
      descripcion:
        'Muestra F_A(x) = 44.18*a*x - 22.5*b con a = 1 (escala de área) y b = 1 (oposición del muelle en Cilindro A). Cambia b = 0 y a = 1.638 para evaluar el Cilindro B biestable (Ø 32 mm).',
      params: {
        expresion: '44.18*a*x - 22.5*b',
        a: 1,
        b: 1,
        xMin: 2,
        xMax: 10,
        titulo: 'Fuerza efectiva F(P) versus presión neumática P (bar)',
        ejeX: 'Presión manométrica P (bar)',
        ejeY: 'Fuerza efectiva F (N)',
      },
    },
  },
});
