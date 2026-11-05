/**
 * Banco de actividades evaluativas de la Práctica N.º 07: Célula de Mecanizado.
 * Cubre los cuatro tipos de reactivos (opción única/múltiple, texto, numérica calculada con expresión y abierta)
 * e integra las cinco preguntas de análisis de ingeniería de la guía de laboratorio.
 */
const R = String.raw;

export const ACTIVIDADES = [
  {
    id: 'ej-1',
    tipo: 'opcion',
    nivel: 'Básico',
    titulo: 'Comportamiento ante corte de 24 VDC en plena Etapa 6',
    enunciado: R`<p>Durante la <strong>Etapa 6</strong> (con la pieza fijada por \(A+\) y \(B+\) y el motor trifásico \(M_1\) girando hacia la derecha), ocurre un corte súbito en la fuente de control de \(24\text{ VDC}\), pero la presión neumática de \(6\text{ bar}\) se mantiene en la red. ¿Qué ocurre físicamente con los cilindros \(A\) (monoestable) y \(B\) (biestable)?</p>`,
    opciones: [
      'Ambos cilindros se retraen inmediatamente a 0 mm porque sus bobinas pierden energía.',
      'El cilindro A se retrae por acción de su muelle interno (A-), mientras que el cilindro B mantiene la pieza prensada (B+) gracias a la memoria mecánica de su electroválvula 5/2 biestable.',
      'El cilindro A permanece extendido y el cilindro B se retrae lentamente por caída de presión.',
      'Ambos cilindros quedan bloqueados en su posición extendida (a1 = 1 y b1 = 1) hasta que regrese la tensión.',
    ],
    correcta: 1,
    pista: R`<p>Recuerda qué elemento físico devuelve la corredera en una válvula monoestable y cómo conmuta una válvula biestable de doble solenoide.</p>`,
    solucion: R`<p>Al caer los \(24\text{ VDC}\), la bobina \(Y_A\) se desenergiza y el resorte antagonista de la electroválvula 5/2 monoestable conmuta la corredera, retrayendo el cilindro \(A\). En cambio, la electroválvula 5/2 biestable del cilindro \(B\) carece de muelle y conserva mecánicamente su última posición (\(B+\)), manteniendo la pieza sujeta mientras el husillo se detiene por inercia.</p>`,
  },
  {
    id: 'ej-2',
    tipo: 'opcion',
    nivel: 'Básico',
    titulo: 'Etapas GRAFCET que activan la bobina YA (%Q0.0)',
    enunciado: R`<p>En la ecuación consolidada de salida \(Y_A = M_1 + M_4 + M_5 + M_6\) para el cilindro monoestable \(A\), selecciona <strong>todas las etapas GRAFCET</strong> en las cuales la bobina física <code>%Q0.0 (YA)</code> debe permanecer energizada a \(24\text{ VDC}\) para vencer el muelle de retorno:</p>`,
    opciones: [
      'Etapa 1: Primer avance A+ (alimentación y asentamiento de pieza)',
      'Etapa 2: Retorno A- por resorte',
      'Etapa 3: Aseguramiento / Homing B- del cilindro biestable',
      'Etapa 4, Etapa 5 y Etapa 6: Segundo avance A+ y retención axial durante el clampeo B+ y el mecanizado M1',
    ],
    correcta: [0, 3],
    pista: R`<p>Como el cilindro A es monoestable, si desenergizas \(Y_A\) en la Etapa 5 o 6 el resorte retraerá el vástago inmediatamente.</p>`,
    solucion: R`<p>La bobina \(Y_A\) debe energizarse en la <strong>Etapa 1</strong> (primer avance \(A+\)) y nuevamente de forma ininterrumpida durante las <strong>Etapas 4, 5 y 6</strong> para sostener la fijación axial mientras \(B\) prensa la pieza y el motor \(M_1\) ejecuta el mecanizado. En las Etapas 2 y 3 permanece en <code>0</code>.</p>`,
  },
  {
    id: 'ej-3',
    tipo: 'texto',
    nivel: 'Básico',
    titulo: 'Diagnóstico de programación Ladder en TIA Portal',
    enunciado: R`<p>¿Con qué nombre técnico (dos palabras) se conoce el error de programación en PLC que ocurre al colocar dos instrucciones de asignación <code>--( )--</code> hacia la misma salida física <code>%Q0.0</code> en segmentos distintos del bloque <code>OB1</code>, provocando que el último segmento sobrescriba al primero en la imagen de proceso (PAA)?</p>`,
    etiqueta: 'Nombre del error',
    aceptadas: [
      'doble bobina',
      'error de doble bobina',
      'conflicto de doble bobina',
      'doble asignacion',
      'doble asignación',
    ],
    pista: R`<p>Se refiere a duplicar el símbolo de la bobina de salida en dos peldaños de la escalera.</p>`,
  },
  {
    id: 'ej-4',
    tipo: 'numerica',
    nivel: 'Intermedio',
    titulo: 'Cálculo de fuerzas efectivas en los cilindros A y B a 6 bar',
    enunciado: R`<p>La red neumática del laboratorio opera a \(P = 6\text{ bar} = 6 \times 10^5\text{ Pa}\) con rendimiento mecánico \(\eta = 0.90\). Calcula:</p>
    <ol>
      <li>La fuerza efectiva de avance \(F_{\text{ef},A}\) del cilindro monoestable \(A\) (\(D_A = 25\text{ mm} = 0.025\text{ m}\), fuerza de resorte \(F_{\text{muelle}} = 25\text{ N}\)).</li>
      <li>La fuerza efectiva de clampeo \(F_{\text{ef},B}\) del cilindro biestable \(B\) (\(D_B = 32\text{ mm} = 0.032\text{ m}\), sin resorte).</li>
    </ol>
    <p>Puedes escribir el valor decimal o la fórmula directa con <code>pi</code>.</p>`,
    respuestas: [
      {
        etiqueta: 'Fuerza efectiva Cilindro A (N)',
        valor: 0.9 * (6e5 * ((Math.PI * 0.025 ** 2) / 4) - 25),
      },
      {
        etiqueta: 'Fuerza efectiva Cilindro B (N)',
        valor: 0.9 * (6e5 * ((Math.PI * 0.032 ** 2) / 4)),
      },
    ],
    pista: R`<p>Usa \(A = \pi D^2 / 4\). Recuerda restar \(25\text{ N}\) antes de multiplicar por \(\eta = 0.90\) en el cilindro A.</p>`,
    solucion: R`<p>Para el cilindro A: \(F_{\text{ef},A} = 0.90 \cdot (6\times 10^5 \cdot \frac{\pi \cdot 0.025^2}{4} - 25) \approx 242.57\text{ N}\). Para el cilindro B: \(F_{\text{ef},B} = 0.90 \cdot (6\times 10^5 \cdot \frac{\pi \cdot 0.032^2}{4}) \approx 434.29\text{ N}\).</p>`,
  },
  {
    id: 'ej-5',
    tipo: 'numerica',
    nivel: 'Intermedio',
    titulo: 'Velocidad de giro horario y corriente nominal del husillo trifásico M1',
    enunciado: R`<p>El motor trifásico de inducción \(M_1\) tiene potencia nominal \(P_n = 370\text{ W}\), tensión de línea \(V_L = 220\text{ V}\), frecuencia \(f = 60\text{ Hz}\), \(p = 4\text{ polos}\), deslizamiento nominal \(s = 0.04\), factor de potencia \(\cos\varphi = 0.80\) y rendimiento \(\eta_m = 0.78\). Calcula la velocidad del rotor \(n_r\) en rpm y la corriente nominal de línea \(I_n\) en amperios (A) para tarar el guardamotor \(\text{RT1}\).</p>`,
    respuestas: [
      {
        etiqueta: 'Velocidad nominal del husillo (rpm)',
        valor: ((120 * 60) / 4) * (1 - 0.04),
      },
      {
        etiqueta: 'Corriente nominal de línea In (A)',
        valor: 370 / (Math.sqrt(3) * 220 * 0.8 * 0.78),
      },
    ],
    pista: R`<p>Usa \(n_s = 120 f / p\), \(n_r = n_s(1 - s)\) e \(I_n = P_n / (\sqrt{3}\,V_L\,\cos\varphi\,\eta_m)\).</p>`,
    solucion: R`<p>La velocidad síncrona es \(n_s = 1800\text{ rpm}\), por lo que \(n_r = 1800(0.96) = 1728\text{ rpm}\). La corriente de línea es \(I_n = 370 / (\sqrt{3}\cdot 220 \cdot 0.80 \cdot 0.78) \approx 1.56\text{ A}\).</p>`,
  },
  {
    id: 'ej-6',
    tipo: 'opcion',
    nivel: 'Intermedio',
    titulo: 'Justificación de la Etapa 3 (B-) con el cilindro B previamente retraído',
    enunciado: R`<p>En el planteamiento del laboratorio se especifica que <em>«B no está afuera antes de iniciar la secuencia»</em> (\(b_0 = 1\)). ¿Por qué el diseño GRAFCET ejecuta explícitamente la <strong>Etapa 3 (\(B-\), activando \(Y_{B-}\))</strong> antes del segundo avance de \(A\)?</p>`,
    opciones: [
      'Porque el PLC necesita consumir al menos 0.5 segundos entre dos movimientos consecutivos del cilindro A.',
      'Porque la electroválvula 5/2 biestable no tiene muelle y, tras una purga de aire o mantenimiento, su corredera interna puede quedar en estado indeterminado; el pulso YB- garantiza el enclavamiento mecánico y la presurización de la cámara de retracción (Homing seguro).',
      'Porque el sensor magnético b0 solo funciona después de energizar la bobina YB- por primera vez.',
      'Porque al activar YB- se incrementa la presión disponible para el cilindro A.',
    ],
    correcta: 1,
    pista: R`<p>Piensa qué ocurre dentro de una válvula 5/2 sin resorte cuando se despresuriza la red neumática durante una parada de planta.</p>`,
    solucion: R`<p>En válvulas biestables, la posición del vástago (\(b_0 = 1\)) no garantiza por sí sola que la corredera distribuidora esté asentada en el extremo de retracción ni que la cámara delantera tenga presión de retención. El pulso \(Y_{B-}\) realiza un <em>Homing</em> activo que asegura el estado mecánico de la válvula antes de introducir la pieza en la fase de clampeo.</p>`,
  },
  {
    id: 'ej-7',
    tipo: 'abierta',
    nivel: 'Avanzado',
    titulo: 'Coordinación de protecciones (RT1) y verificación del sentido de giro horario',
    enunciado: R`<p>Explica cómo debes integrar el contacto auxiliar normalmente cerrado (<code>95-96</code>) del relé térmico \(\text{RT1}\) tanto en el cableado físico como en el programa del PLC, y qué modificación física realizarías en el circuito de potencia si durante la prueba inicial el motor trifásico \(M_1\) gira hacia la izquierda (antihorario) en lugar de hacia la derecha.</p>`,
    respuestaModelo: R`<p><strong>1. Doble protección con RT1 (95-96):</strong> En hardware, el contacto NC <code>95-96</code> se conecta en serie directa con el borne <code>A1</code> de la bobina del contactor \(KM_1\), garantizando el corte físico inmediato ante sobrecarga incluso si el PLC fallara. Simultáneamente, una señal desde el contacto auxiliar de \(\text{RT1}\) ingresa a <code>%I0.6</code> del PLC para resetear el GRAFCET a la Etapa 0 y desactivar las salidas lógicas.<br/><strong>2. Corrección de sentido de giro:</strong> En un motor de inducción trifásico, para invertir el campo magnético rotatorio de antihorario (CCW) a horario (CW, giro hacia la derecha) se aplica primero las 5 Reglas de Oro (desenergización y bloqueo) y se permutan entre sí dos de las tres fases de fuerza (por ejemplo, intercambiar \(L_1\) y \(L_2\) aguas abajo del contactor \(KM_1\), en los bornes \(U_1\) y \(V_1\)), manteniendo intacto el conductor de puesta a tierra <code>PE</code>.</p>`,
  },
  {
    id: 'ej-8',
    tipo: 'abierta',
    nivel: 'Avanzado',
    titulo: 'Diseño de diagnóstico por tiempo máximo (Watchdog) en Etapa 5 (B+)',
    enunciado: R`<p>Si durante la ejecución de la <strong>Etapa 5 (\(B+\))</strong> se desconecta accidentalmente la manguera neumática de avance del cilindro \(B\), el sensor magnético \(b_1\) jamás se activará. Diseña la lógica de supervisión con un temporizador <code>TON</code> de \(3.0\text{ s}\) que detecte esta anomalía y lleve la célula a un estado seguro.</p>`,
    respuestaModelo: R`<p><strong>Diseño del Watchdog neumático:</strong><br/>1. Se instancia un temporizador a la conexión <code>TON_Watchdog_B</code> con tiempo preseleccionado <code>PT := T#3s</code>.<br/>2. Su entrada de habilitación <code>IN</code> se alimenta con la condición booleana \(M_5 \cdot \overline{b_1}\) (Etapa 5 activa y sensor de final de carrera \(b_1\) aún en <code>0</code>).<br/>3. Si transcurren \(3.0\text{ s}\) sin que el émbolo alcance \(b_1\), la salida <code>TON_Watchdog_B.Q</code> pasa a <code>1</code>, ejecutando el <code>Reset</code> inmediato de \(M_5\), el <code>Set</code> de la etapa de reposo \(M_0\) (o de una marca de alarma <code>M_Fallo_Neumatico</code>) y bloqueando el paso a la Etapa 6 (\(KM_1 = 0\)) hasta que el operador corrija la fuga y rearme el sistema.</p>`,
  },
];
