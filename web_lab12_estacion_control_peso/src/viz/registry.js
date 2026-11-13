/**
 * Registro de visualizaciones. Cada entrada declara su motor, su módulo (cargado
 * con import() solo cuando el bloque se acerca al viewport) y los textos accesibles.
 */
export const VIZ = {
  estacionPeso3D: {
    kind: 'three',
    load: () => import('./three/estacionPeso3D.js'),
    titulo: 'Plano de situación (lámina 1) en 3D',
    descripcion:
      'Alimentación A+, retroceso A− y desbloqueo B−, pesaje con báscula libre (T1 = 3 s), bloqueo B+, clasificación C+ (OK, cinta H1 hasta S5 + T2) o D+ (NOK, canaleta).',
    aria: 'Escena tridimensional de la estación de control de peso con la disposición del plano de situación: alimentador de rodillos hacia el centro de la carcasa, cilindro A que empuja la pieza a la báscula, pasador del cilindro B que bloquea la báscula, empujador en U del cilindro C que devuelve la pieza OK a la cinta H1 con fotocélula S5, placa del cilindro D que expulsa la pieza NOK a la canaleta, y armario S7-1200 con LED de E/S, baliza y botonera S0 / S6. Controles: Espacio marcha o pausa, 0 reinicia, 6 paro de fin de ciclo, T alterna S4, A reconoce la alarma, flechas giran la vista, + y − zoom, R recentra la cámara.',
    tall: true,
  },
};
