/**
 * Diagrama 2D interactivo Desplazamiento-Fase y Desplazamiento-Tiempo (Plotly)
 * para la Célula de Mecanizado Electroneumática (Semana 7).
 *
 * Representa las trayectorias sincronizadas de:
 *   - Cilindro A (Monoestable, carrera 0 a 100 mm)
 *   - Cilindro B (Biestable, carrera 0 a 50 mm; normalizado o en mm)
 *   - Pulso Homing YB- (%Q0.2) en Fase 3 (cuando B ya está en 0 mm)
 *   - Activación del Motor Trifásico M1 (KM1 %Q0.3, giro derecha CW) en Fase 6
 */
import { createPlotlyChart, baseLayout, fmt } from './plotly-utils.js';
import { calcularTiemposCiclo } from '../../math/celula.js';

export const defaults = {
  ejeHorizontal: 'fases',
  tMecanizado: 5,
  presionBar: 6,
  mostrarSolenoides: true,
};

export const controls = [
  {
    key: 'ejeHorizontal',
    label: 'Eje horizontal',
    type: 'select',
    options: {
      'Índice de fase GRAFCET (0 a 6)': 'fases',
      'Tiempo real de ciclo (s)': 'tiempo',
    },
  },
  {
    key: 'tMecanizado',
    label: 'Temporizador TON M1 (s)',
    min: 2,
    max: 10,
    step: 0.5,
  },
  {
    key: 'presionBar',
    label: 'Presión de línea (bar)',
    min: 4,
    max: 8,
    step: 0.5,
  },
  {
    key: 'mostrarSolenoides',
    label: 'Mostrar pulsos YB- y KM1',
    type: 'boolean',
  },
];

function compute(p) {
  const ciclo = calcularTiemposCiclo(p.tMecanizado, p.presionBar);
  const { tAcumulado_s, duraciones_s, tiempoTotal_s } = ciclo;

  // Puntos detallados para trazar las rampas lineales de los cilindros y escalones digitales
  // Fases: 0 (Reposo), 1 (A+), 2 (A-), 3 (B- Homing), 4 (A+), 5 (B+), 6 (Motor M1), 7 (Retorno a 0)
  const xFases = [0, 1, 2, 3, 4, 5, 6, 7];
  const t0 = 0.4; // breve ventana de reposo inicial para visualización
  const xTiempo = [
    0,
    t0,
    t0 + duraciones_s[0],
    t0 + tAcumulado_s[2],
    t0 + tAcumulado_s[3],
    t0 + tAcumulado_s[4],
    t0 + tAcumulado_s[5],
    t0 + tAcumulado_s[6],
  ];

  // Posiciones físicas al final de cada frontera de fase:
  // Fronteras: [Inicio E0, Fin E0 / Inicio E1, Fin E1 (A+), Fin E2 (A-), Fin E3 (B-), Fin E4 (A+), Fin E5 (B+), Fin E6 (M1)]
  const posA_mm = [0, 0, 100, 0, 0, 100, 100, 100];
  const posB_mm = [0, 0, 0, 0, 0, 0, 50, 50];

  // Señales lógicas expresadas en escala equivalente (0 o 100 %) para comparar sincronismo
  const pulsoYB_minus = [0, 0, 0, 0, 100, 0, 0, 0];
  const estadoKM1 = [0, 0, 0, 0, 0, 0, 0, 100];

  return {
    xFases,
    xTiempo,
    posA_mm,
    posB_mm,
    pulsoYB_minus,
    estadoKM1,
    duraciones_s,
    tiempoTotal_s,
  };
}

function figure(d, p, theme, width) {
  const usaTiempo = p.ejeHorizontal === 'tiempo';
  const x = usaTiempo ? d.xTiempo : d.xFases;
  const xTitle = usaTiempo
    ? 'Tiempo acumulado del ciclo t (s)'
    : 'Frontera de Etapa GRAFCET (E0 → E1:A+ → E2:A- → E3:B- → E4:A+ → E5:B+ → E6:M1)';

  const layout = baseLayout(theme, width, {
    title: 'Diagrama Espacio-Fase y Sincronismo de Actuadores (mm / %)',
    xTitle,
    yTitle: 'Carrera (mm) / Estado lógico (%)',
    legend: true,
  });

  const traces = [
    {
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Cilindro A Monoestable (mm)',
      x,
      y: d.posA_mm,
      line: { color: theme.series[0], width: 3 },
      marker: { color: theme.series[0], size: 8 },
      hovertemplate: 'Cilindro A: %{y:.0f} mm<extra></extra>',
    },
    {
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Cilindro B Biestable (mm)',
      x,
      y: d.posB_mm,
      line: { color: theme.series[1], width: 3 },
      marker: { color: theme.series[1], size: 8, symbol: 'square' },
      hovertemplate: 'Cilindro B: %{y:.0f} mm<extra></extra>',
    },
  ];

  if (p.mostrarSolenoides) {
    traces.push(
      {
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Pulso Homing YB- (% lógica)',
        x,
        y: d.pulsoYB_minus,
        line: { color: theme.series[2], width: 2.2, dash: 'dot', shape: 'hv' },
        marker: { color: theme.series[2], size: 7, symbol: 'diamond' },
        hovertemplate: 'Solenoide YB-: %{y:.0f} %<extra></extra>',
      },
      {
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Motor Trifásico KM1 (% lógica)',
        x,
        y: d.estadoKM1,
        line: { color: theme.series[3], width: 2.5, dash: 'dash', shape: 'hv' },
        marker: { color: theme.series[3], size: 7, symbol: 'triangle-up' },
        hovertemplate: 'Contactor KM1 (Giro CW): %{y:.0f} %<extra></extra>',
      }
    );
  }

  return { data: traces, layout };
}

function info(d, p) {
  const etiquetasFases = [
    'E0: Reposo inicial',
    'E1: A+ (Alimentación)',
    'E2: A- (Retorno muelle)',
    'E3: B- (Homing seguro)',
    'E4: A+ (Fijación axial)',
    'E5: B+ (Clampeo biestable)',
    'E6: Motor M1 (Giro CW)',
    'Fin de etapa E6',
  ];

  return {
    latex: String.raw`T_{\text{ciclo}} = \sum_{k=1}^{5} t_k(P) + T_{\text{TON}} = ${fmt(d.tiempoTotal_s, 2)}\text{ s}`,
    readouts: [
      { label: 'Tiempo total de ciclo', value: `${fmt(d.tiempoTotal_s, 2)} s`, state: 'estable' },
      { label: 'Duración Fase 1 / 4 (A+)', value: `${fmt(d.duraciones_s[0], 2)} s` },
      { label: 'Duración Fase 2 (A-)', value: `${fmt(d.duraciones_s[1], 2)} s` },
      { label: 'Duración Fase 5 (B+)', value: `${fmt(d.duraciones_s[4], 2)} s` },
      { label: 'Mecanizado E6 (KM1)', value: `${fmt(p.tMecanizado, 2)} s` },
    ],
    aria: `Diagrama de fases de la célula de mecanizado con tiempo total de ciclo de ${fmt(d.tiempoTotal_s, 2)} segundos a ${p.presionBar} bar.`,
    table: {
      caption: 'Datos del Diagrama Espacio-Fase y Tiempos Acumulados',
      columns: ['Punto de secuencia', 'Tiempo (s)', 'Posición A (mm)', 'Posición B (mm)', 'YB- (%)', 'KM1 (%)'],
      rows: etiquetasFases.map((et, i) => [
        et,
        fmt(d.xTiempo[i], 2),
        d.posA_mm[i],
        d.posB_mm[i],
        d.pulsoYB_minus[i],
        d.estadoKM1[i],
      ]),
    },
  };
}

export function createChart(container, opts) {
  return createPlotlyChart(container, opts, {
    compute,
    figure,
    info,
    filename: 'diagrama-fases-celula-mecanizado',
  });
}
