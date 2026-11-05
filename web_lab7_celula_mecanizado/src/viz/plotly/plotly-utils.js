/**
 * Utilidades compartidas por las gráficas Plotly.
 *
 * - loadPlotly(): import() perezoso del bundle parcial oficial
 *   plotly.js-basic-dist-min (solo trazas scatter, bar y pie).
 * - baseLayout(): márgenes, tipografía, título centrado fuera del área de
 *   trazado y leyenda horizontal anclada al borde inferior del contenedor
 *   (nunca encima de los datos). Se adapta al ancho (≥ 320 px).
 * - createPlotlyChart(): ciclo de vida común mount / update / resize /
 *   dispose / restyle / download con Plotly.react (nunca newPlot en updates).
 */
import { cssVar } from '../../ui/theme.js';

let plotlyPromise = null;
export const loadPlotly = () => (plotlyPromise ??= import('plotly.js-basic-dist-min').then((m) => m.default ?? m));

export function chartTheme() {
  return {
    paper: cssVar('--viz-paper'),
    bg: cssVar('--viz-bg'),
    grid: cssVar('--viz-grid'),
    gridStrong: cssVar('--viz-grid-strong'),
    axis: cssVar('--viz-axis'),
    text: cssVar('--viz-text'),
    accent: cssVar('--viz-accent'),
    unstable: cssVar('--viz-unstable'),
    series: [1, 2, 3, 4, 5].map((i) => cssVar(`--viz-series-${i}`)),
  };
}

/**
 * Layout base. `width` es el ancho real del contenedor (px).
 * @param {{ title: string, xTitle: string, yTitle: string, legend?: boolean }} o
 */
export function baseLayout(theme, width, { title, xTitle, yTitle, legend = true }) {
  const narrow = width < 520;
  // Plotly no parte los títulos: se insertan saltos <br> según el ancho disponible.
  const lines = wrapTitle(title, Math.max(24, Math.floor((width - 24) / (narrow ? 7.6 : 8.6))));
  const extraTop = (lines.length - 1) * (narrow ? 17 : 19);
  return {
    autosize: true,
    paper_bgcolor: theme.paper,
    plot_bgcolor: theme.bg,
    font: { family: 'Inter Variable, Inter, system-ui, sans-serif', size: narrow ? 12 : 13, color: theme.text },
    title: {
      text: lines.join('<br>'),
      x: 0.5,
      xanchor: 'center',
      yref: 'container',
      y: 0.98,
      yanchor: 'top',
      font: { size: narrow ? 13 : 15 },
    },
    margin: {
      t: (narrow ? 52 : 60) + extraTop,
      r: narrow ? 14 : 30,
      b: legend ? (narrow ? 104 : 96) : 64,
      l: narrow ? 56 : 70,
    },
    xaxis: axis(theme, xTitle),
    yaxis: axis(theme, yTitle),
    showlegend: legend,
    legend: {
      orientation: 'h',
      xref: 'paper',
      yref: 'container',
      x: 0.5,
      xanchor: 'center',
      y: 0.01,
      yanchor: 'bottom',
      bgcolor: 'rgba(0,0,0,0)',
      font: { size: 12 },
    },
    hovermode: 'x unified',
    hoverlabel: { bgcolor: theme.paper, bordercolor: theme.gridStrong, font: { color: theme.text } },
    modebar: { bgcolor: 'rgba(0,0,0,0)', color: theme.axis, activecolor: theme.series[0] },
    dragmode: 'zoom',
  };
}

/** Parte un título en líneas de como máximo `max` caracteres visibles (ignora etiquetas HTML). */
export function wrapTitle(text, max) {
  const visible = (s) => s.replace(/<[^>]+>/g, '').length;
  const lines = [];
  let cur = '';
  for (const word of text.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && visible(next) > max) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function axis(theme, title, extra = {}) {
  return {
    title: { text: title, standoff: 15 },
    gridcolor: theme.grid,
    zerolinecolor: theme.gridStrong,
    zerolinewidth: 1.5,
    linecolor: theme.axis,
    tickcolor: theme.axis,
    automargin: true,
    showline: true,
    mirror: false,
    ticks: 'outside',
    ...extra,
  };
}

export const baseConfig = (filename) => ({
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ['lasso2d', 'select2d'],
  toImageButtonOptions: { format: 'png', scale: 2, filename },
});

/**
 * Gráfica de tallos (stem): una traza de líneas verticales y otra de marcadores,
 * agrupadas para que la leyenda las muestre/oculte juntas.
 */
export function stemTraces({
  x,
  y,
  name,
  color,
  group,
  symbol = 'circle',
  size = 7,
  hover,
  open = false,
  xaxis,
  yaxis,
}) {
  const sx = [];
  const sy = [];
  x.forEach((xi, i) => {
    sx.push(xi, xi, null);
    sy.push(0, y[i], null);
  });
  const common = { legendgroup: group ?? name, ...(xaxis && { xaxis }), ...(yaxis && { yaxis }) };
  return [
    {
      type: 'scatter',
      mode: 'lines',
      x: sx,
      y: sy,
      line: { color, width: 1.6 },
      hoverinfo: 'skip',
      showlegend: false,
      ...common,
    },
    {
      type: 'scatter',
      mode: 'markers',
      name,
      x,
      y,
      marker: {
        color: open ? 'rgba(0,0,0,0)' : color,
        size,
        symbol,
        line: { color, width: open ? 2 : 0 },
      },
      hovertemplate: hover ?? `${name}: %{y:.4f}<extra></extra>`,
      ...common,
    },
  ];
}

/**
 * Ciclo de vida común. `spec` define:
 *   compute(params)                    → datos (puro, sin DOM)
 *   figure(data, params, theme, width) → { data, layout }
 *   info(data, params)                 → objeto para onInfo (fórmulas, lecturas, tabla)
 *   filename                           → nombre del PNG descargado
 */
export function createPlotlyChart(container, { params, onInfo, ariaLabel }, spec) {
  let Plotly = null;
  let div = null;
  let last = null;

  function draw() {
    if (!Plotly || !div) return;
    const theme = chartTheme();
    const width = div.clientWidth || container.clientWidth;
    const fig = spec.figure(last, params, theme, width);
    Plotly.react(div, fig.data, fig.layout, baseConfig(spec.filename));
  }

  return {
    async mount() {
      Plotly = await loadPlotly();
      div = document.createElement('div');
      div.className = 'viz__plot';
      div.setAttribute('role', 'img');
      div.setAttribute('aria-label', ariaLabel);
      container.appendChild(div);
      last = spec.compute(params);
      const theme = chartTheme();
      const fig = spec.figure(last, params, theme, container.clientWidth);
      await Plotly.newPlot(div, fig.data, fig.layout, baseConfig(spec.filename));
      onInfo?.(spec.info(last, params));
    },
    update(p) {
      Object.assign(params, p);
      last = spec.compute(params);
      draw();
      onInfo?.(spec.info(last, params));
    },
    resize() {
      if (!div) return;
      draw(); // recalcula márgenes y fuentes según el nuevo ancho
      Plotly.Plots.resize(div);
    },
    restyle: () => draw(),
    download() {
      if (div) Plotly.downloadImage(div, { format: 'png', scale: 2, filename: spec.filename });
    },
    dispose() {
      if (Plotly && div) Plotly.purge(div);
      div?.remove();
      div = null;
    },
  };
}

/** Formato de número para hover/tabla. */
export const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '—');
