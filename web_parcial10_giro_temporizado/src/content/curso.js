/**
 * DATOS DE LA MATERIA.
 * Examen Parcial II · Semana 10: Estación automática de giro temporizado.
 */
export const CURSO = {
  // Identifica este sitio en el navegador (clave del progreso). Debe ser distinta en cada sitio.
  clave: 'web_parcial10_giro_temporizado',

  codigo: 'MEC42',
  asignatura: 'Diseño de automatismos de PLC',
  institucion: 'Institución Universitaria de Barranquilla',
  facultad: 'Facultad de Ingeniería',
  programa: 'Ingeniería Mecatrónica',
  docente: 'Ing. Ricardo D. Buriticá R.',

  // Portada
  titulo: 'Estación automática de giro temporizado',
  etiqueta: 'MEC42 · Examen Parcial II · Semana 10',
  descripcion:
    'Mesa revólver indexada con taladrado, taladro de asiento y desbarbado simultáneos, gobernada por un PLC S7-1200 con GRAFCET IEC 60848 y modos GEMMA.',
  formula: String.raw`T_{\text{ciclo}} = \underbrace{1.9}_{A,C} + \underbrace{1.1}_{E \parallel B,D} + \underbrace{1.1}_{E^- \parallel A,C} + \underbrace{1.5}_{\text{Y}} + \underbrace{1.0}_{\text{retorno}} = 6.6\ \text{s} \quad (t_{\text{lub}} = 3.0\ \text{s})`,
  accionSecundaria: { texto: 'Ver la simulación 3D', capitulo: '02-simulacion' },

  referencias: [
    'IEC 60848:2013 (GRAFCET)',
    'IEC 61131-3:2013',
    'R. Yuste y V. Guerrero, <em>Autómatas programables SIEMENS: Grafcet y Guía GEMMA con TIA Portal</em>, Marcombo, 2017',
  ],
};
