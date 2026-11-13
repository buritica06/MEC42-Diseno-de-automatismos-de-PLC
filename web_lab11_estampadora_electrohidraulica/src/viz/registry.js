/**
 * Registro de visualizaciones. Cada entrada declara su motor, su módulo (cargado
 * con import() solo cuando el bloque se acerca al viewport) y los textos accesibles.
 *
 * `fallback` (opcional): imagen en public/assets/images/fallbacks/ para navegadores sin WebGL 2.
 */
export const VIZ = {
  estampadora3D: {
    kind: 'three',
    load: () => import('./three/estampadora3D.js'),
    titulo: 'Figura 1. Estampadora electrohidráulica',
    descripcion:
      'Ciclo automático: sujeción (A+), avance (B+), estampado (D, 3 s), retroceso (B−), apertura (A−) y expulsión (C+, C−).',
    aria: 'Escena tridimensional de la prensa estampadora: bastidor en C, carro B, mordaza A, expulsor C, motor D con volante y troquel, guarda y central hidráulica. Con el foco en la escena: Espacio da marcha o pausa, 0 reinicia, E activa el paro de emergencia, 2 rearma, G mueve la guarda, flechas giran, + y − acercan, R recentra la cámara.',
    tall: true,
  },
};
