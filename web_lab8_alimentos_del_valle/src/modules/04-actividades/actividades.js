/**
 * Banco de actividades: un modelo de cada tipo. Reemplázalas por las de tu tema.
 * Los campos están explicados en src/components/actividades.js.
 * No cambies el id de una actividad ya publicada: se perdería el progreso guardado.
 */
const R = String.raw;

export const ACTIVIDADES = [
  {
    id: 'ej-1',
    tipo: 'opcion',
    nivel: 'Básico',
    titulo: '[Pregunta conceptual, una respuesta]',
    enunciado: R`<p>¿Cuál es la capital de Colombia? [Sustituye por tu pregunta.]</p>`,
    opciones: ['Barranquilla', 'Bogotá', 'Medellín', 'Cali'],
    correcta: 1,
    pista: R`<p>[Orienta sin dar la respuesta.]</p>`,
    solucion: R`<p>[Explica por qué esa opción es la correcta y por qué las demás no.]</p>`,
  },
  {
    id: 'ej-2',
    tipo: 'opcion',
    nivel: 'Básico',
    titulo: '[Pregunta con varias respuestas]',
    enunciado: R`<p>¿Cuáles de estos números son primos? [Sustituye por tu pregunta.]</p>`,
    opciones: ['2', '9', '11', '15'],
    correcta: [0, 2],
    solucion: R`<p>2 y 11 solo son divisibles por 1 y por sí mismos; \(9 = 3^2\) y \(15 = 3 \cdot 5\).</p>`,
  },
  {
    id: 'ej-3',
    tipo: 'texto',
    nivel: 'Básico',
    titulo: '[Término o palabra clave]',
    enunciado: R`<p>¿Cómo se llama el proceso por el que las plantas producen su alimento con luz solar? [Sustituye por tu pregunta.]</p>`,
    etiqueta: 'Respuesta',
    aceptadas: ['fotosíntesis', 'la fotosíntesis'],
    pista: R`<p>La corrección ignora mayúsculas y tildes. Empieza por «foto».</p>`,
  },
  {
    id: 'ej-4',
    tipo: 'numerica',
    nivel: 'Intermedio',
    titulo: '[Problema de cálculo]',
    enunciado: R`<p>Con \(P(t) = 5\,e^{0.3t}\), calcula \(P(4)\) y el tiempo de duplicación. Puedes escribir un número o una expresión, como <code>log(2)/0.3</code>.</p>`,
    respuestas: [
      { etiqueta: 'P(4) (miles)', valor: 5 * Math.exp(1.2) },
      { etiqueta: 'Tiempo de duplicación (h)', valor: Math.log(2) / 0.3 },
    ],
    pista: R`<p>Para duplicar, resuelve \(2 = e^{0.3 t}\).</p>`,
    solucion: R`<p>\(P(4) = 5e^{1.2} \approx 16.60\) y \(t_d = \ln 2 / 0.3 \approx 2.31\ \text{h}\).</p>`,
  },
  {
    id: 'ej-5',
    tipo: 'abierta',
    nivel: 'Avanzado',
    titulo: '[Pregunta de desarrollo o reflexión]',
    enunciado: R`<p>[Plantea una pregunta de análisis o argumentación. El estudiante compara su texto con la respuesta modelo y se autoevalúa; nada se guarda ni se envía.]</p>`,
    respuestaModelo: R`<p>[Respuesta modelo, con los puntos que no deberían faltar.]</p>`,
  },
];
