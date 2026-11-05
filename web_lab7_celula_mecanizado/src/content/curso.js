/**
 * DATOS DE LA MATERIA.
 * Práctica N.º 07: Célula de Mecanizado Electroneumática y Husillo Trifásico (Semana 7).
 */
export const CURSO = {
  clave: 'web_lab7_celula_mecanizado',

  codigo: 'MEC42',
  asignatura: 'Diseño de automatismos de PLC',
  institucion: 'Institución Universitaria de Barranquilla',
  facultad: 'Facultad de Ingeniería',
  programa: 'Ingeniería Mecatrónica',
  docente: 'Ing. Ricardo D. Buriticá R.',

  // Portada
  titulo: 'Práctica N.º 07: Célula de Mecanizado Electroneumática y Husillo Trifásico',
  etiqueta: 'MEC42 · Diseño de automatismos de PLC · Semana 7 · RA2 (CE2.1, CE2.3)',
  descripcion:
    'Modela en GRAFCET (IEC 60848), explora en 3D el comportamiento de cilindros monoestables, mordazas biestables y motor trifásico, programa en Ladder (IEC 61131-3) y aplica las 5 Reglas de Oro de la seguridad eléctrica.',
  formula:
    'A+ \\;\\xrightarrow{a_1}\\; A- \\;\\xrightarrow{a_0}\\; B- \\;\\xrightarrow{b_0}\\; A+ \\;\\xrightarrow{a_1}\\; B+ \\;\\xrightarrow{b_1}\\; KM_1\\text{ (Motor Derecha)}',
  accionSecundaria: { texto: 'Abrir gemelo digital 3D', capitulo: '02-visualizaciones' },

  // Bibliografía que aparece en el pie de todas las páginas (formato IEEE).
  referencias: [
    'IEC, <em>Preparation of function charts for control systems — GRAFCET</em>, IEC 60848, 2.ª ed., 2013.',
    'IEC, <em>Programmable controllers — Part 3: Programming languages</em>, IEC 61131-3, 3.ª ed., 2013.',
    'Ministerio de Minas y Energía de Colombia, <em>Reglamento Técnico de Instalaciones Eléctricas (RETIE)</em>, Res. 90708, 2013.',
    'R. Piedrafita Moreno, <em>Ingeniería de la automatización industrial</em>, 2.ª ed., Alfaomega / Marcombo, 2004.',
    'E. Mandado Pérez et al., <em>Autómatas Programables y Sistemas de Automatización</em>, Marcombo, 2010.',
    'Festo Didactic, <em>Electroneumática: Nivel Básico (TP 201)</em>, Festo AG & Co. KG, 2015.',
  ],
};
