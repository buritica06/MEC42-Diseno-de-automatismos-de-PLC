import { createChapter } from '../chapter.js';
import { montarActividades } from '../../components/actividades.js';
import { ACTIVIDADES } from './actividades.js';

export default createChapter({
  html: `<p>Resuelve los siguientes ejercicios y cuestionarios de ingeniería sobre la <strong>Célula de Mecanizado Electroneumática y de Potencia (Semana 7)</strong>. En los problemas numéricos puedes ingresar el valor decimal o una expresión matemática directa (por ejemplo, <code>1800*0.96</code>). Tu progreso se guarda automáticamente en este navegador.</p>`,
  objetivos: [
    'Verificar el dominio conceptual y analítico sobre el GRAFCET IEC 60848, la diferencia entre válvulas monoestables y biestables y el cálculo de fuerzas y corrientes.',
    'Resolver los cinco interrogantes de diagnóstico de fallos, seguridad funcional y programación sin doble bobina de la guía de laboratorio.',
  ],
  setup: montarActividades(ACTIVIDADES),
});
