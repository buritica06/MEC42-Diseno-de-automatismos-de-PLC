/**
 * Gráfica de datos por categorías, pensada para cualquier materia: los datos se
 * pasan desde el preset del capítulo y el estudiante puede cambiar la vista.
 *
 * Preset: { params: { titulo, ejeX, ejeY, tipo, etiquetas: [...], series: [{ nombre, valores: [...] }] } }
 * El tipo 'sectores' solo representa la primera serie.
 */
import { createPlotlyChart, baseLayout } from './plotly-utils.js';

export const defaults = {
  tipo: 'barras',
  titulo: 'Duración por fase del ciclo GRAFCET (s)',
  ejeX: 'Fase de la secuencia',
  ejeY: 'Tiempo (s)',
  etiquetas: ['Fase 1 (A+)', 'Fase 2 (A-)', 'Fase 3 (B-)', 'Fase 4 (A+)', 'Fase 5 (B+)', 'Fase 6 (M1)'],
  series: [
    { nombre: 'Duración nominal (6 bar)', valores: [0.8, 0.7, 0.5, 0.8, 0.6, 5.0] },
    { nombre: 'Duración con baja presión (4 bar)', valores: [0.98, 0.86, 0.5, 0.98, 0.73, 5.0] },
  ],
};

export const controls = [
  {
    key: 'tipo',
    label: 'Tipo de gráfica',
    type: 'select',
    options: { Barras: 'barras', Líneas: 'lineas', Sectores: 'sectores' },
  },
];

const compute = (p) => ({ etiquetas: p.etiquetas, series: p.series });

function figure(d, p, theme, width) {
  const color = (i) => theme.series[i % theme.series.length];
  const layout = baseLayout(theme, width, { title: p.titulo, xTitle: p.ejeX, yTitle: p.ejeY, legend: true });

  if (p.tipo === 'sectores') {
    const s = d.series[0];
    layout.hovermode = 'closest';
    delete layout.xaxis;
    delete layout.yaxis;
    return {
      data: [
        {
          type: 'pie',
          name: s.nombre,
          labels: d.etiquetas,
          values: s.valores,
          marker: { colors: d.etiquetas.map((_, i) => color(i)), line: { color: theme.paper, width: 2 } },
          textinfo: 'percent',
          textposition: 'outside', // fuera del sector: no depende del contraste con cada color
          automargin: true,
          sort: false,
          hovertemplate: `%{label}: %{value} (%{percent})<extra>${s.nombre}</extra>`,
        },
      ],
      layout,
    };
  }

  const lineas = p.tipo === 'lineas';
  return {
    data: d.series.map((s, i) => ({
      type: lineas ? 'scatter' : 'bar',
      ...(lineas && {
        mode: 'lines+markers',
        line: { color: color(i), width: 2.4 },
        marker: { color: color(i), size: 8 },
      }),
      ...(!lineas && { marker: { color: color(i) } }),
      name: s.nombre,
      x: d.etiquetas,
      y: s.valores,
    })),
    layout,
  };
}

function info(d, p) {
  const total = (s) => s.valores.reduce((acc, v) => acc + v, 0);
  return {
    readouts: d.series.map((s) => ({ label: `Total ${s.nombre}`, value: total(s), format: (v) => v.toFixed(1) })),
    table: {
      caption: p.titulo,
      columns: [p.ejeX, ...d.series.map((s) => s.nombre)],
      rows: d.etiquetas.map((e, i) => [e, ...d.series.map((s) => s.valores[i])]),
    },
  };
}

export function createChart(container, opts) {
  return createPlotlyChart(container, opts, { compute, figure, info, filename: 'grafica-datos' });
}
