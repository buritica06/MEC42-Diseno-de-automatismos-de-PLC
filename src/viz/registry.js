/**
 * Registro de visualizaciones. Cada entrada declara su motor ('three' o 'plotly'),
 * su módulo (cargado con import() solo cuando el bloque se acerca al viewport) y
 * los textos accesibles. Lo que un capítulo no use no se descarga, así que no
 * hace falta borrar nada para materias sin gráficas ni 3D.
 *
 * Cada capítulo puede cambiar el título y la descripción desde sus presets.
 * `fallback` (opcional): imagen en public/assets/images/fallbacks/ para navegadores sin WebGL 2.
 */
export const VIZ = {
  graficaFuncion: {
    kind: 'plotly',
    load: () => import('./plotly/graficaFuncion.js'),
    titulo: 'Gráfica de una función',
    descripcion: 'Escribe cualquier expresión y = f(x) y mueve los parámetros a y b para ver cómo cambia.',
    aria: 'Gráfica de una función y = f(x) con parámetros ajustables.',
  },
  graficaDatos: {
    kind: 'plotly',
    load: () => import('./plotly/graficaDatos.js'),
    titulo: 'Gráfica de datos',
    descripcion: 'Datos propios de la materia en barras, líneas o sectores. Se cargan desde el capítulo.',
    aria: 'Gráfica de datos por categorías.',
  },
  superficie3D: {
    kind: 'three',
    load: () => import('./three/superficie3D.js'),
    titulo: 'Superficie 3D',
    descripcion: 'Superficie z = f(x, y) que puedes rotar y deformar. Arrastra para girarla.',
    aria: 'Superficie tridimensional z = f(x, y). Usa las flechas para rotar, + y − para acercar, R para reiniciar la cámara.',
    tall: true,
  },
  celulaMecanizado3D: {
    kind: 'three',
    load: () => import('./three/celulaMecanizado3D.js'),
    titulo: 'Célula de Mecanizado Electroneumática en 3D',
    descripcion:
      'Gemelo digital 3D del Cilindro A (Monoestable con muelle), Cilindro B (Biestable de doble solenoide) y Husillo Trifásico M1 (giro horario CW). Arrastra para rotar o usa las flechas del teclado.',
    aria: 'Escena tridimensional de la célula de mecanizado con cilindro A monoestable, cilindro B biestable y motor trifásico M1. Usa las flechas para rotar, + y − para acercar, R para reiniciar la cámara.',
    tall: true,
  },
  diagramaFasesPlc: {
    kind: 'plotly',
    load: () => import('./plotly/diagramaFasesPlc.js'),
    titulo: 'Diagrama Espacio-Fase y Sincronismo de Actuadores',
    descripcion:
      'Trayectorias sincronizadas de los cilindros A y B, el pulso de homing YB- y la activación del contactor KM1 del motor trifásico.',
    aria: 'Diagrama espacio-fase y de tiempos de los cilindros A y B y el motor trifásico M1.',
  },
};
