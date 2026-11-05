/**
 * Gráfica de y = f(x; a, b) con expresión editable.
 * La expresión pasa por el evaluador seguro; si no es válida se avisa en el
 * panel y la gráfica conserva el último resultado correcto.
 *
 * Personalizable desde un preset: expresion, a, b, xMin, xMax, muestras, estilo,
 * titulo, ejeX, ejeY.
 */
import { createPlotlyChart, baseLayout, stemTraces } from './plotly-utils.js';
import { compileSafe, EvaluationError } from '../../math/evaluator.js';
import * as Cx from '../../math/complex.js';

export const defaults = {
  expresion: 'a*sin(b*x)',
  a: 1,
  b: 1,
  xMin: -10,
  xMax: 10,
  muestras: 400,
  estilo: 'linea',
  titulo: '',
  ejeX: 'x',
  ejeY: 'y',
};

export const controls = [
  { key: 'expresion', label: 'y = f(x)', type: 'text', lazy: true },
  { key: 'a', label: 'a', min: -10, max: 10, step: 0.01 },
  { key: 'b', label: 'b', min: -10, max: 10, step: 0.01 },
  { key: 'xMin', label: 'x mínimo', min: -100, max: 100, step: 0.5, folder: 'Vista' },
  { key: 'xMax', label: 'x máximo', min: -100, max: 100, step: 0.5, folder: 'Vista' },
  { key: 'muestras', label: 'Número de puntos', min: 5, max: 1000, step: 1, folder: 'Vista' },
  {
    key: 'estilo',
    label: 'Estilo',
    type: 'select',
    options: { Línea: 'linea', 'Tallos (discreto)': 'tallos' },
    folder: 'Vista',
  },
];

function evaluar(p) {
  const f = compileSafe(p.expresion, { variables: ['x', 'a', 'b'] });
  const scope = { a: Cx.C(p.a), b: Cx.C(p.b), x: Cx.C(0) };
  const lo = Math.min(p.xMin, p.xMax);
  const hi = Math.max(p.xMin, p.xMax);
  const n = Math.max(2, Math.round(p.muestras));
  const x = [];
  const y = [];
  for (let i = 0; i < n; i++) {
    const xi = lo + ((hi - lo) * i) / (n - 1);
    scope.x = Cx.C(xi);
    const r = f.evaluateComplexFast(scope);
    x.push(xi);
    // Fuera del dominio real (p. ej. sqrt de un negativo) queda un hueco en la curva.
    y.push(Number.isFinite(r.re) && Math.abs(r.im) < 1e-9 ? r.re : null);
  }
  return { x, y, expresion: p.expresion };
}

export function createChart(container, opts) {
  let ultimo = { x: [], y: [], expresion: '' };

  function compute(p) {
    try {
      ultimo = evaluar(p);
      return { ...ultimo, error: null };
    } catch (err) {
      if (!(err instanceof EvaluationError)) throw err;
      return { ...ultimo, error: err.message };
    }
  }

  function figure(d, p, theme, width) {
    const color = theme.series[0];
    const data =
      p.estilo === 'tallos'
        ? stemTraces({ x: d.x, y: d.y.map((v) => v ?? 0), name: p.ejeY, color, hover: 'y: %{y:.4f}<extra></extra>' })
        : [
            {
              type: 'scatter',
              mode: 'lines',
              name: p.ejeY,
              x: d.x,
              y: d.y,
              line: { color, width: 2.4 },
              hovertemplate: 'y: %{y:.4f}<extra></extra>',
            },
          ];
    const layout = baseLayout(theme, width, {
      title: p.titulo || `y = ${d.expresion}`,
      xTitle: p.ejeX,
      yTitle: p.ejeY,
      legend: false,
    });
    return { data, layout };
  }

  function info(d, p) {
    const validos = d.y.filter((v) => v !== null);
    const paso = Math.max(1, Math.floor(d.x.length / 40));
    return {
      readouts: [
        d.error
          ? { label: 'Expresión', value: `No válida: ${d.error}`, state: 'inestable' }
          : { label: 'Expresión', value: 'Válida', state: 'estable' },
        { label: 'y mínimo', value: validos.length ? Math.min(...validos) : '—' },
        { label: 'y máximo', value: validos.length ? Math.max(...validos) : '—' },
      ],
      aria: `Función y = ${d.expresion} con a = ${p.a} y b = ${p.b}.`,
      table: {
        caption: 'Valores de la función',
        columns: [p.ejeX, p.ejeY],
        rows: d.x.filter((_, i) => i % paso === 0).map((xi, i) => [xi, d.y[i * paso] ?? '—']),
      },
    };
  }

  return createPlotlyChart(container, opts, { compute, figure, info, filename: 'grafica-funcion' });
}
