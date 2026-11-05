/**
 * Superficie z = f(x, y; a, b) con expresión editable.
 *
 * - BufferGeometry reutilizable: al cambiar un parámetro solo se recalculan las
 *   alturas, el color y las normales; el índice y las coordenadas x, y se conservan.
 * - La expresión pasa por el evaluador seguro; si no es válida se avisa en el
 *   panel y la superficie conserva el último resultado correcto.
 * - La altura se normaliza entre el mínimo y el máximo de la función, así que
 *   cualquier escala cabe en la escena; el panel muestra los valores reales.
 *
 * Personalizable desde un preset: expresion, a, b, rango, ejeX, ejeY, ejeZ.
 */
import { BufferGeometry, Float32BufferAttribute, Mesh, ShaderMaterial, DoubleSide } from 'three';
import { createStage, GLSL_COLORMAPS } from './three-utils.js';
import { compileSafe, EvaluationError } from '../../math/evaluator.js';
import * as Cx from '../../math/complex.js';

export const defaults = {
  expresion: 'a*cos(b*x)*cos(b*y)',
  a: 1,
  b: 1,
  rango: 5,
  altura: 1.4,
  mapa: 'viridis',
  curvas: true,
  ejeX: 'x',
  ejeY: 'y',
  ejeZ: 'z',
};

export const controls = [
  { key: 'expresion', label: 'z = f(x, y)', type: 'text', lazy: true },
  { key: 'a', label: 'a', min: -10, max: 10, step: 0.01 },
  { key: 'b', label: 'b', min: -5, max: 5, step: 0.01 },
  { key: 'rango', label: 'Rango de x e y (±)', min: 0.5, max: 50, step: 0.5, folder: 'Vista' },
  { key: 'altura', label: 'Altura visual', min: 0.3, max: 3, step: 0.1, folder: 'Vista' },
  {
    key: 'mapa',
    label: 'Mapa de color',
    type: 'select',
    options: { Viridis: 'viridis', Magma: 'magma' },
    folder: 'Vista',
  },
  { key: 'curvas', label: 'Curvas de nivel', type: 'boolean', folder: 'Vista' },
];

const N = 96; // vértices por lado
const W = 1.6; // semiancho de la superficie en la escena

const VERT = /* glsl */ `
attribute float aT;
varying float vT;
varying vec3 vNormalV;
void main() {
  vT = aT;
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
${GLSL_COLORMAPS}
uniform int uMap;
uniform float uContours;
varying float vT;
varying vec3 vNormalV;
void main() {
  vec3 base = uMap == 0 ? viridis(vT) : magma(vT);
  vec3 n = normalize(vNormalV);
  if (!gl_FrontFacing) n = -n;
  float diff = max(dot(n, normalize(vec3(0.35, 0.55, 0.75))), 0.0);
  vec3 col = srgbToLinear(base) * (0.55 + 0.55 * diff);
  if (uContours > 0.5) {
    float f = vT * 10.0;
    float line = 1.0 - smoothstep(0.0, 1.2 * fwidth(f), abs(fract(f - 0.5) - 0.5));
    col = mix(col, col * 0.35, line * 0.8);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export function createScene(container, { params, onInfo, ariaLabel }) {
  let stage;
  const objs = {};
  let ultimo = { min: 0, max: 0, muestras: [] };

  function buildGeometry() {
    const geom = new BufferGeometry();
    const pos = new Float32Array(N * N * 3);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const v = j * N + i;
        pos[3 * v] = -W + (2 * W * i) / (N - 1);
        pos[3 * v + 1] = -W + (2 * W * j) / (N - 1);
      }
    }
    const index = [];
    for (let j = 0; j < N - 1; j++) {
      for (let i = 0; i < N - 1; i++) {
        const a = j * N + i;
        index.push(a, a + 1, a + N + 1, a, a + N + 1, a + N);
      }
    }
    geom.setIndex(index);
    geom.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geom.setAttribute('aT', new Float32BufferAttribute(new Float32Array(N * N), 1));
    return geom;
  }

  function buildStatic() {
    objs.grid = stage.makeGrid(2 * W, 12);
    objs.grid.position.z = -0.003;
    objs.geom = buildGeometry();
    objs.mat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uMap: { value: 0 }, uContours: { value: 1 } },
      side: DoubleSide,
    });
    objs.axisX = stage.makeAxis('x', -W, W + 0.15, params.ejeX);
    objs.axisY = stage.makeAxis('y', -W, W + 0.15, params.ejeY);
    objs.axisZ = stage.makeAxis('z', 0, 2.2, params.ejeZ);
    objs.tickX = stage.makeLabel('', { size: 0.09, anchorX: 'center', anchorY: 'top' });
    objs.tickX.position.set(W, -0.06, 0.01);
    objs.tickY = stage.makeLabel('', { size: 0.09, anchorX: 'right' });
    objs.tickY.position.set(-0.06, W, 0.01);
    stage.scene.add(
      new Mesh(objs.geom, objs.mat),
      objs.grid,
      objs.axisX,
      objs.axisY,
      objs.axisZ,
      objs.tickX,
      objs.tickY
    );
  }

  function calcular() {
    const f = compileSafe(params.expresion, { variables: ['x', 'y', 'a', 'b'] });
    const scope = { a: Cx.C(params.a), b: Cx.C(params.b), x: Cx.C(0), y: Cx.C(0) };
    const z = new Float64Array(N * N);
    let min = Infinity;
    let max = -Infinity;
    for (let j = 0; j < N; j++) {
      scope.y = Cx.C(params.rango * (-1 + (2 * j) / (N - 1)));
      for (let i = 0; i < N; i++) {
        scope.x = Cx.C(params.rango * (-1 + (2 * i) / (N - 1)));
        const r = f.evaluateComplexFast(scope);
        const v = Number.isFinite(r.re) && Math.abs(r.im) < 1e-9 ? r.re : NaN;
        z[j * N + i] = v;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    return { z, min, max };
  }

  function update(p) {
    Object.assign(params, p);
    let error = null;
    try {
      const { z, min, max } = calcular();
      const pos = objs.geom.attributes.position.array;
      const tAttr = objs.geom.attributes.aT.array;
      const span = max - min;
      for (let v = 0; v < N * N; v++) {
        // Función constante: superficie plana a media altura. Fuera del dominio: en la base.
        const t = Number.isNaN(z[v]) ? 0 : span > 1e-12 ? (z[v] - min) / span : 0.5;
        tAttr[v] = t;
        pos[3 * v + 2] = t * params.altura;
      }
      objs.geom.attributes.position.needsUpdate = true;
      objs.geom.attributes.aT.needsUpdate = true;
      objs.geom.computeVertexNormals();
      objs.geom.computeBoundingSphere();
      ultimo = { min, max, z };
    } catch (err) {
      if (!(err instanceof EvaluationError)) throw err;
      error = err.message;
    }
    objs.mat.uniforms.uMap.value = params.mapa === 'magma' ? 1 : 0;
    objs.mat.uniforms.uContours.value = params.curvas ? 1 : 0;
    stage.setLabel(objs.tickX, `${params.rango}`);
    stage.setLabel(objs.tickY, `${params.rango}`);
    stage.requestRender();

    const { min, max, z } = ultimo;
    const paso = Math.floor(N / 8);
    const filas = [];
    if (z) {
      for (let j = 0; j < N; j += paso) {
        for (let i = 0; i < N; i += paso) {
          const c = (k) => params.rango * (-1 + (2 * k) / (N - 1));
          filas.push([c(i), c(j), Number.isNaN(z[j * N + i]) ? '—' : z[j * N + i]]);
        }
      }
    }
    onInfo?.({
      readouts: [
        error
          ? { label: 'Expresión', value: `No válida: ${error}`, state: 'inestable' }
          : { label: 'Expresión', value: 'Válida', state: 'estable' },
        { label: 'z mínimo', value: Number.isFinite(min) ? min : '—' },
        { label: 'z máximo', value: Number.isFinite(max) ? max : '—' },
      ],
      aria: `Superficie z = ${params.expresion}, con valores entre ${Number.isFinite(min) ? min.toFixed(2) : 'sin dato'} y ${Number.isFinite(max) ? max.toFixed(2) : 'sin dato'}.`,
      table: {
        caption: 'Muestra de valores de la superficie',
        columns: [params.ejeX, params.ejeY, params.ejeZ],
        rows: filas,
      },
    });
  }

  function restyle() {
    const theme = stage.refreshTheme();
    for (const ax of [objs.axisX, objs.axisY, objs.axisZ]) {
      ax.userData.line.material.color.copy(theme.axis);
      ax.userData.cone.material.color.copy(theme.axis);
      ax.userData.label.color = theme.text;
    }
    objs.tickX.color = theme.text;
    objs.tickY.color = theme.text;
    stage.scene.remove(objs.grid);
    objs.grid.geometry.dispose();
    objs.grid.material.dispose();
    objs.grid = stage.makeGrid(2 * W, 12);
    objs.grid.position.z = -0.003;
    stage.scene.add(objs.grid);
    update(params);
  }

  return {
    mount() {
      stage = createStage(container, { ariaLabel, camera: [2.8, -3.8, 3.1], target: [0, 0, 0.5] });
      buildStatic();
      update(params);
      stage.start();
    },
    update,
    resize: () => stage.resize(),
    restyle,
    dispose: () => stage?.dispose(),
    get renderer() {
      return stage?.renderer;
    },
  };
}
