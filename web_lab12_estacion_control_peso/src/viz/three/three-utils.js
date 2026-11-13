/**
 * Utilidades compartidas por las escenas Three.js.
 *
 * createStage() encapsula todo lo que es igual en cada escena:
 *   renderer (configuración profesional), cámara z-arriba, OrbitControls,
 *   luces, post-procesado (RenderPass → UnrealBloom → SMAA → OutputPass),
 *   bucle requestAnimationFrame con THREE.Clock que se pausa fuera del viewport,
 *   teclado accesible, etiquetas de texto 3D (troika) y dispose() completo.
 *
 * Imports nombrados (tree-shaking): nunca `import * as THREE`.
 */
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Clock,
  Color,
  Vector2,
  Vector3,
  Spherical,
  HemisphereLight,
  DirectionalLight,
  SRGBColorSpace,
  ACESFilmicToneMapping,
  GridHelper,
  Mesh,
  ConeGeometry,
  MeshBasicMaterial,
  Group,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { Text } from 'troika-three-text';
import labelFontUrl from '@fontsource/inter/files/inter-latin-500-normal.woff?url';
import { cssVar } from '../../ui/theme.js';

/* ───────────────────────── Colores del tema ───────────────────────── */

const THEME_KEYS = [
  'bg',
  'grid',
  'grid-strong',
  'axis',
  'text',
  'pole',
  'zero',
  'unstable',
  'stable-region',
  'accent',
  'series-1',
  'series-2',
  'series-3',
  'series-4',
  'series-5',
];

/** Lee los tokens --viz-* del CSS activo (claro/oscuro) como THREE.Color. */
export function readThemeColors() {
  const out = {};
  for (const k of THEME_KEYS) out[k] = new Color(cssVar(`--viz-${k}`) || '#888888');
  out.isDark = document.documentElement.dataset.theme === 'dark';
  return out;
}

/* ──────────────────────────── Shaders ──────────────────────────── */

/**
 * Mapas de color perceptualmente uniformes (aproximación polinómica de
 * viridis y magma de matplotlib; Matt Zucker, CC0). Nunca "rainbow".
 * Devuelven sRGB; se pasan a lineal porque OutputPass convierte a sRGB al final.
 */
export const GLSL_COLORMAPS = /* glsl */ `
vec3 viridis(float t) {
  const vec3 c0 = vec3(0.2777273272234177, 0.005407344544966578, 0.3340998053353061);
  const vec3 c1 = vec3(0.1050930431085774, 1.404613529898575, 1.384590162594685);
  const vec3 c2 = vec3(-0.3308618287255563, 0.214847559468213, 0.09509516302823659);
  const vec3 c3 = vec3(-4.634230498983486, -5.799100973351585, -19.33244095627987);
  const vec3 c4 = vec3(6.228269936347081, 14.17993336680509, 56.69055260068105);
  const vec3 c5 = vec3(4.776384997670288, -13.74514537774601, -65.35303263337234);
  const vec3 c6 = vec3(-5.435455855934631, 4.645852612178535, 26.3124352495832);
  return c0 + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * (c5 + t * c6)))));
}
vec3 magma(float t) {
  const vec3 c0 = vec3(-0.002136485053939582, -0.000749655052795221, -0.005386127855323933);
  const vec3 c1 = vec3(0.2516605407371642, 0.6775232436837668, 2.494026599312351);
  const vec3 c2 = vec3(8.353717279216625, -3.577719514958484, 0.3144679030132573);
  const vec3 c3 = vec3(-27.66873308576866, 14.26473078096533, -13.64921318813922);
  const vec3 c4 = vec3(52.17613981234068, -27.94360607168351, 12.94416944238394);
  const vec3 c5 = vec3(-50.76852536473588, 29.04658282127291, 4.23415299384598);
  const vec3 c6 = vec3(18.65570506591883, -11.48977351997711, -5.601961508734096);
  return c0 + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * (c5 + t * c6)))));
}
vec3 srgbToLinear(vec3 c) { return pow(clamp(c, 0.0, 1.0), vec3(2.2)); }
`;

/* ─────────────────────────── Escenario ─────────────────────────── */

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * @param {HTMLElement} container
 * @param {{ ariaLabel: string, camera?: number[], target?: number[], fov?: number,
 *           bloom?: boolean, minDistance?: number, maxDistance?: number }} opts
 */
export function createStage(container, opts) {
  const reduce = reducedMotion();
  const size = () => ({
    w: Math.max(1, container.clientWidth),
    h: Math.max(1, container.clientHeight),
  });
  let { w, h } = size();

  const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', opts.ariaLabel);
  canvas.tabIndex = 0;
  container.appendChild(canvas);

  let theme = readThemeColors();
  const scene = new Scene();
  scene.background = theme.bg.clone();

  // En lienzos verticales (móvil) se abre el campo de visión para conservar el encuadre horizontal.
  const baseFov = opts.fov ?? 40;
  const fovFor = (aspect) => {
    const ref = 1.3;
    if (aspect >= ref) return baseFov;
    return (2 * Math.atan((Math.tan((baseFov * Math.PI) / 360) * ref) / aspect) * 180) / Math.PI;
  };
  const camera = new PerspectiveCamera(fovFor(w / h), w / h, 0.01, 500);
  camera.up.set(0, 0, 1); // convención: plano XY como base, eje vertical = Z
  const home = {
    position: new Vector3(...(opts.camera ?? [3, -4, 3])),
    target: new Vector3(...(opts.target ?? [0, 0, 0])),
  };
  camera.position.copy(home.position);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(home.target);
  controls.enableDamping = !reduce;
  controls.dampingFactor = 0.08;
  controls.minDistance = opts.minDistance ?? 1.5;
  controls.maxDistance = opts.maxDistance ?? 25;
  controls.update();

  const hemi = new HemisphereLight(0xffffff, 0x444466, 1.1);
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(3, -4, 6);
  scene.add(hemi, sun);

  // Post-procesado
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector2(w, h), 0.55, 0.35, 0.82);
  bloom.enabled = Boolean(opts.bloom);
  composer.addPass(bloom);
  const smaa = new SMAAPass();
  composer.addPass(smaa);
  composer.addPass(new OutputPass());

  const lineMaterials = new Set();
  const labels = new Set();
  const tickHandlers = new Set();
  let dirty = true;
  let visible = true;
  let pageVisible = !document.hidden;
  let rafId = 0;
  const clock = new Clock();

  const requestRender = () => {
    dirty = true;
  };
  controls.addEventListener('change', requestRender);

  function frame() {
    rafId = 0;
    if (!visible || !pageVisible) return; // el bucle se detiene; se reanuda al volver
    const dt = Math.min(clock.getDelta(), 0.1);
    const elapsed = clock.elapsedTime;
    if (controls.enableDamping) controls.update();
    for (const fn of tickHandlers) if (fn(dt, elapsed)) dirty = true;
    if (dirty) {
      for (const l of labels) l.quaternion.copy(camera.quaternion); // etiquetas siempre de frente
      composer.render(dt);
      dirty = false;
    }
    rafId = requestAnimationFrame(frame);
  }
  const start = () => {
    if (!rafId && visible && pageVisible) {
      clock.getDelta();
      rafId = requestAnimationFrame(frame);
    }
  };

  // Pausa fuera del viewport y con la pestaña oculta
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible) {
      dirty = true;
      start();
    }
  });
  io.observe(container);
  const onVisibility = () => {
    pageVisible = !document.hidden;
    if (pageVisible) start();
  };
  document.addEventListener('visibilitychange', onVisibility);

  // Teclado: rotar, acercar y reiniciar (OrbitControls no rota con flechas)
  const spherical = new Spherical();
  const offset = new Vector3();
  function orbit(dTheta, dPhi, zoom = 1) {
    offset.copy(camera.position).sub(controls.target);
    // Spherical de three asume eje Y vertical: rotamos a ese marco y volvemos.
    const yUp = new Vector3(offset.x, offset.z, -offset.y);
    spherical.setFromVector3(yUp);
    spherical.theta += dTheta;
    spherical.phi = Math.min(Math.max(0.05, spherical.phi + dPhi), Math.PI - 0.05);
    spherical.radius = Math.min(Math.max(controls.minDistance, spherical.radius * zoom), controls.maxDistance);
    yUp.setFromSpherical(spherical);
    camera.position.set(controls.target.x + yUp.x, controls.target.y - yUp.z, controls.target.z + yUp.y);
    camera.lookAt(controls.target);
    controls.update();
    requestRender();
  }
  const onKey = (e) => {
    const step = 0.12;
    const map = {
      ArrowLeft: () => orbit(-step, 0),
      ArrowRight: () => orbit(step, 0),
      ArrowUp: () => orbit(0, -step),
      ArrowDown: () => orbit(0, step),
      '+': () => orbit(0, 0, 0.9),
      '=': () => orbit(0, 0, 0.9),
      '-': () => orbit(0, 0, 1.1),
      r: () => resetCamera(),
      R: () => resetCamera(),
    };
    if (map[e.key]) {
      e.preventDefault();
      map[e.key]();
    }
  };
  canvas.addEventListener('keydown', onKey);

  function resetCamera() {
    camera.position.copy(home.position);
    controls.target.copy(home.target);
    controls.update();
    requestRender();
  }

  function resize() {
    ({ w, h } = size());
    camera.aspect = w / h;
    camera.fov = fovFor(w / h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    for (const m of lineMaterials) m.resolution.set(w, h);
    requestRender();
  }

  /** Línea gruesa (Line2). `points` = array plano [x,y,z, x,y,z, …]. */
  function makeLine(points, { color = 0xffffff, width = 2, dashed = false, opacity = 1, vertexColors = null } = {}) {
    const geom = new LineGeometry();
    geom.setPositions(points);
    if (vertexColors) geom.setColors(vertexColors);
    const mat = new LineMaterial({
      color: vertexColors ? 0xffffff : color,
      linewidth: width,
      dashed,
      dashSize: 0.06,
      gapSize: 0.05,
      transparent: opacity < 1,
      opacity,
      vertexColors: Boolean(vertexColors),
      worldUnits: false,
    });
    mat.resolution.set(w, h);
    lineMaterials.add(mat);
    const line = new Line2(geom, mat);
    if (dashed) line.computeLineDistances();
    return line;
  }

  /** Actualiza una Line2 existente reutilizando su material. */
  function setLinePoints(line, points, colors) {
    line.geometry.dispose();
    const geom = new LineGeometry();
    geom.setPositions(points);
    if (colors) geom.setColors(colors);
    line.geometry = geom;
    if (line.material.dashed) line.computeLineDistances();
  }

  /** Etiqueta de texto 3D (troika-three-text, SDF): nítida a cualquier zoom y siempre de frente. */
  function makeLabel(text, { size = 0.12, color = theme.text, anchorX = 'left', anchorY = 'middle' } = {}) {
    const t = new Text();
    t.text = text;
    t.font = labelFontUrl;
    t.fontSize = size;
    t.color = color;
    t.anchorX = anchorX;
    t.anchorY = anchorY;
    t.outlineWidth = '8%';
    t.outlineColor = theme.bg;
    t.depthOffset = -1;
    t.sync(requestRender);
    labels.add(t);
    return t;
  }
  function setLabel(t, text, color) {
    if (t.text !== text) t.text = text;
    if (color) t.color = color;
    t.sync(requestRender);
  }

  /** Rejilla en el plano XY. */
  function makeGrid(sizeW = 4, divisions = 16) {
    const g = new GridHelper(sizeW, divisions, theme['grid-strong'], theme.grid);
    g.rotation.x = Math.PI / 2;
    g.material.transparent = true;
    g.material.opacity = theme.isDark ? 0.55 : 0.8;
    g.material.depthWrite = false;
    return g;
  }

  /** Eje con flecha y etiqueta. dir = 'x' | 'y' | 'z'. */
  function makeAxis(dir, from, to, labelText, { color = theme.axis, width = 2 } = {}) {
    const a = new Vector3();
    const b = new Vector3();
    a.setComponent('xyz'.indexOf(dir), from);
    b.setComponent('xyz'.indexOf(dir), to);
    const group = new Group();
    const line = makeLine([a.x, a.y, a.z, b.x, b.y, b.z], { color, width });
    const cone = new Mesh(new ConeGeometry(0.035, 0.12, 16), new MeshBasicMaterial({ color }));
    cone.position.copy(b);
    // ConeGeometry apunta a +Y por defecto
    if (dir === 'x') cone.rotation.z = -Math.PI / 2;
    if (dir === 'z') cone.rotation.x = Math.PI / 2;
    const label = makeLabel(labelText, { size: 0.14 });
    label.position
      .copy(b)
      .add(new Vector3(dir === 'x' ? 0.1 : 0.04, dir === 'y' ? 0.1 : 0.04, dir === 'z' ? 0.1 : 0.04));
    group.add(line, cone, label);
    group.userData = { line, cone, label };
    return group;
  }

  /** Relee los colores del tema activo; cada escena repinta sus objetos con ellos. */
  function refreshTheme() {
    theme = readThemeColors();
    scene.background = theme.bg.clone();
    for (const l of labels) l.outlineColor = theme.bg;
    requestRender();
    return theme;
  }

  function dispose() {
    cancelAnimationFrame(rafId);
    rafId = 0;
    io.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('keydown', onKey);
    controls.removeEventListener('change', requestRender);
    controls.dispose();
    disposeObject(scene);
    for (const l of labels) l.dispose();
    labels.clear();
    lineMaterials.clear();
    tickHandlers.clear();
    composer.passes.forEach((p) => p.dispose?.());
    composer.dispose?.();
    renderer.dispose();
    renderer.forceContextLoss(); // libera el contexto: el navegador limita los contextos WebGL vivos
    canvas.remove();
  }

  return {
    renderer,
    scene,
    camera,
    controls,
    composer,
    bloom,
    reducedMotion: reduce,
    get theme() {
      return theme;
    },
    requestRender,
    start,
    onTick: (fn) => tickHandlers.add(fn),
    resize,
    resetCamera,
    makeLine,
    setLinePoints,
    makeLabel,
    setLabel,
    makeGrid,
    makeAxis,
    refreshTheme,
    dispose,
  };
}

/** Libera geometrías, materiales y texturas de un árbol de objetos. */
export function disposeObject(root) {
  root.traverse((obj) => {
    obj.geometry?.dispose?.();
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
      m.dispose?.();
    }
  });
}

/** Interpolación exponencial independiente del frame-rate (para marcadores animados). */
export const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));
