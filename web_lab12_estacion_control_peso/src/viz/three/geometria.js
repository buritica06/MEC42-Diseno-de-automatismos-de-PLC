/**
 * Ayudas de modelado para las escenas: primitivas ya colocadas en el mundo y
 * fusión por material (una llamada de dibujo por material para todo lo estático).
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CylinderGeometry,
  Matrix4,
  Mesh,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const Y_UP = new Vector3(0, 1, 0);
const UNO = new Vector3(1, 1, 1);

export const v3 = (x, y, z) => new Vector3(x, y, z);

/** Caja definida por sus límites: más legible que centro + tamaño al leer un plano. */
export function bloque(x0, x1, y0, y1, z0, z1) {
  const g = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

/** Cilindro entre dos puntos; r2 es el radio en el extremo b. */
export function cilindro(a, b, r, seg = 20, r2 = r) {
  const d = new Vector3().subVectors(b, a);
  const g = new CylinderGeometry(r2, r, d.length(), seg);
  const q = new Quaternion().setFromUnitVectors(Y_UP, d.clone().normalize());
  g.applyMatrix4(new Matrix4().compose(new Vector3().addVectors(a, b).multiplyScalar(0.5), q, UNO));
  return g;
}

/** Tubería o manguera fija que pasa por los puntos dados. */
export const tubo = (puntos, radio = 0.045) =>
  new TubeGeometry(new CatmullRomCurve3(puntos, false, 'catmullrom', 0.35), puntos.length * 10, radio, 8, false);

/** Agrupa geometrías por material y las fusiona. */
export function crearLote({ sombras = true } = {}) {
  const grupos = new Map();
  return {
    add(material, ...geometrias) {
      if (!grupos.has(material)) grupos.set(material, []);
      grupos.get(material).push(...geometrias);
    },
    construir(padre) {
      for (const [material, geometrias] of grupos) {
        // mergeGeometries exige los mismos atributos: las primitivas indexadas y las no indexadas no se mezclan.
        const lista = geometrias.map((g) => (g.index ? g.toNonIndexed() : g));
        const mesh = new Mesh(mergeGeometries(lista, false), material);
        mesh.castShadow = sombras && !material.transparent;
        mesh.receiveShadow = sombras;
        padre.add(mesh);
        geometrias.forEach((g) => g.dispose());
        lista.forEach((g) => g.dispose());
      }
      grupos.clear();
    },
  };
}

/**
 * Manguera flexible entre un punto fijo y otro móvil. La malla se crea una vez y
 * actualizar() solo reescribe sus vértices: sin objetos nuevos durante la animación.
 */
export function crearManguera(material, { radio = 0.05, tramos = 18, lados = 8, caida = 0.9 } = {}) {
  const n = (tramos + 1) * lados;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const idx = [];
  for (let i = 0; i < tramos; i++) {
    for (let j = 0; j < lados; j++) {
      const a = i * lados + j;
      const b = i * lados + ((j + 1) % lados);
      idx.push(a, b, a + lados, b, b + lados, a + lados);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('normal', new BufferAttribute(nor, 3));
  geo.setIndex(idx);
  const mesh = new Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.castShadow = true;

  const c = new Vector3();
  const t = new Vector3();
  const n1 = new Vector3();
  const n2 = new Vector3();
  const ref = new Vector3(0, 1, 0);

  /** Curva de Bézier cuadrática con el punto de control descolgado: imita el peso de la manguera. */
  function actualizar(a, b) {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const mz = Math.min(a.z, b.z) - caida;
    for (let i = 0; i <= tramos; i++) {
      const s = i / tramos;
      const k0 = (1 - s) * (1 - s);
      const k1 = 2 * s * (1 - s);
      const k2 = s * s;
      c.set(k0 * a.x + k1 * mx + k2 * b.x, k0 * a.y + k1 * my + k2 * b.y, k0 * a.z + k1 * mz + k2 * b.z);
      t.set(
        2 * (1 - s) * (mx - a.x) + 2 * s * (b.x - mx),
        2 * (1 - s) * (my - a.y) + 2 * s * (b.y - my),
        2 * (1 - s) * (mz - a.z) + 2 * s * (b.z - mz)
      ).normalize();
      n1.crossVectors(t, ref).normalize();
      n2.crossVectors(n1, t);
      for (let j = 0; j < lados; j++) {
        const ang = (j / lados) * Math.PI * 2;
        const cs = Math.cos(ang);
        const sn = Math.sin(ang);
        const o = (i * lados + j) * 3;
        const nx = n1.x * cs + n2.x * sn;
        const ny = n1.y * cs + n2.y * sn;
        const nz = n1.z * cs + n2.z * sn;
        nor[o] = nx;
        nor[o + 1] = ny;
        nor[o + 2] = nz;
        pos[o] = c.x + nx * radio;
        pos[o + 1] = c.y + ny * radio;
        pos[o + 2] = c.z + nz * radio;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
  }
  return { mesh, actualizar };
}

/** Malla de la guarda: líneas opacas sobre fondo transparente. */
export function texturaRejilla() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 64, 64);
  x.strokeStyle = '#f2c81e';
  x.lineWidth = 7;
  x.strokeRect(0, 0, 64, 64);
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Carátula del manómetro (0 a 160 bar) con la zona de apriete marcada. */
export function texturaManometro() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#f7f7f2';
  x.beginPath();
  x.arc(128, 128, 126, 0, Math.PI * 2);
  x.fill();
  const ang = (bar) => ((-225 + (270 * bar) / 160) * Math.PI) / 180;
  x.lineWidth = 16;
  x.strokeStyle = '#2aa36b';
  x.beginPath();
  x.arc(128, 128, 104, ang(85), ang(110));
  x.stroke();
  x.strokeStyle = '#c2323a';
  x.beginPath();
  x.arc(128, 128, 104, ang(110), ang(160));
  x.stroke();
  x.strokeStyle = '#1b1b24';
  for (let bar = 0; bar <= 160; bar += 10) {
    const a = ang(bar);
    const largo = bar % 40 === 0 ? 30 : 16;
    x.lineWidth = bar % 40 === 0 ? 7 : 4;
    x.beginPath();
    x.moveTo(128 + Math.cos(a) * 118, 128 + Math.sin(a) * 118);
    x.lineTo(128 + Math.cos(a) * (118 - largo), 128 + Math.sin(a) * (118 - largo));
    x.stroke();
  }
  x.fillStyle = '#1b1b24';
  x.font = 'bold 30px sans-serif';
  x.textAlign = 'center';
  x.fillText('bar', 128, 200);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
