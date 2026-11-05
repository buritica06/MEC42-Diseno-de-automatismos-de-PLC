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
  alimentosDelValle3D: {
    kind: 'three',
    load: () => import('./three/alimentosDelValle3D.js'),
    titulo: 'Estación de dosificación y corte antigoteo',
    descripcion:
      'Secuencia automática del laboratorio: alimentación, sujeción, inmersión, dosificación, succión, ascenso, apertura y expulsión.',
    aria: 'Escena tridimensional de la estación de dosificación de Alimentos Del Valle, con bandas, frascos, cilindros A, B y C, motor M1 y sensores. Con el foco en la escena: Espacio inicia o pausa, 0 reinicia, E activa el paro de emergencia, flechas giran, + y − acercan, R recentra la cámara.',
    tall: true,
  },
};
