/**
 * Registro de visualizaciones. Cada entrada declara su motor ('three'), su módulo
 * (cargado con import() solo cuando el bloque se acerca al viewport) y los textos
 * accesibles. Cada capítulo puede cambiar el título y la descripción desde sus presets.
 */
export const VIZ = {
  giroTemporizado3D: {
    kind: 'three',
    load: () => import('./three/giroTemporizado3D.js'),
    titulo: 'Figura 1 · Estación automática de giro temporizado',
    descripcion:
      'Mesa revólver de seis cunas, transportes 1 y 2, herramientas F a K, lubricación central, barrido de virutas y PLC S7-1200 ejecutando GP, GL/GM y GS.',
    aria: 'Escena tridimensional de la estación de giro temporizado: cintas 1 y 2, transportes con cilindros A, B, C y D, mesa revólver con cilindro E y unidades de mecanizado F a K. Con el foco en la escena: Espacio da MARCHA, P pausa, 0 reinicia, E acciona la seta de emergencia, Escape pide PARADA; flechas giran, + y − acercan, R recentra la cámara.',
    hint: 'Arrastra para girar · rueda o pellizco para acercar · teclado: Espacio MARCHA, P pausa, E emergencia, 0 reinicia, R recentra.',
    tall: true,
  },
};
