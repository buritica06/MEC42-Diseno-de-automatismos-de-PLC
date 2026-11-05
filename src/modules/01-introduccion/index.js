import html from './contenido.html?raw';
import { createChapter } from '../chapter.js';

export default createChapter({
  html,
  objetivos: [
    'Modelar mediante un diagrama GRAFCET normalizado (IEC 60848) la secuencia industrial A+ → A- → B- → A+ → B+ → Motor trifásico M1 giro a la derecha.',
    'Diferenciar el comportamiento físico y de seguridad entre un cilindro neumático monoestable (retorno por muelle) y uno biestable (memoria mecánica de doble solenoide).',
    'Formular las ecuaciones booleanas Set/Reset y el direccionamiento de entradas/salidas en el PLC sin incurrir en el error de doble bobina.',
  ],
});
