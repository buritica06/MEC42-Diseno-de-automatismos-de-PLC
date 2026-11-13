/**
 * Registro de visualizaciones. Cada entrada declara su motor, su módulo (cargado
 * con import() solo cuando el bloque se acerca al viewport) y los textos accesibles.
 *
 * `fallback` (opcional): imagen en public/assets/images/fallbacks/ para navegadores sin WebGL 2.
 */
export const VIZ = {
  manipulador3D: {
    kind: 'three',
    load: () => import('./three/manipulador3D.js'),
    titulo: 'Figura 1. Equipo de manipulación de 4 ejes',
    descripcion:
      'Ciclo doble: toma en la canaleta 1, descarga en la 2 (C retraído) y en la 3 (C extendido), con T1/T2 de 1,5 s y contador de lote.',
    aria: 'Escena tridimensional del manipulador: unidad giratoria D, eje horizontal C, eje vertical B, pinza A, canaleta de alimentación 1 y canaletas de descarga 2 y 3, terminal de válvulas y columna de señalización. Con el foco en la escena: Espacio da marcha o pausa, S parada a fin de ciclo, E emergencia, X reposición, 0 reinicia, flechas giran, + y − acercan, R recentra la cámara.',
    tall: true,
  },
};
