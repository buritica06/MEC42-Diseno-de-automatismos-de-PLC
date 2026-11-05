# Plantilla web transversal — IUB

Sitio educativo listo para adaptar a **cualquier materia**, numérica o no: capítulos con navegación, barra de
progreso, tema claro/oscuro, versión móvil, actividades con corrección inmediata y visualizaciones opcionales.
Lleva la identidad de la Institución Universitaria de Barranquilla.

Lo que aparece entre `[corchetes]` es de relleno y hay que reemplazarlo.

## Crear el sitio de una materia

Requiere Node.js 20.19 o superior. Desde esta carpeta, en PowerShell:

```bash
.\nueva_materia.ps1 -Nombre web_mec40_cinematica
```

Esto crea `generacion/web_mec40_cinematica/` con su propia clave de progreso; la plantilla queda intacta. Luego, en la
carpeta nueva:

```bash
npm install
```

```bash
npm run dev
```

El sitio se abre en http://localhost:5173 y se actualiza al guardar.

## Qué editar, en orden

| #   | Archivo                                     | Qué contiene                                                  |
| --- | ------------------------------------------- | ------------------------------------------------------------- |
| 1   | `src/content/curso.js`                      | Código, asignatura, programa, docente, portada y bibliografía |
| 2   | `src/content/capitulos.js`                  | Lista de capítulos: añade, quita o renombra                   |
| 3   | `src/modules/NN-*/contenido.html`           | El texto de cada capítulo                                     |
| 4   | `src/modules/NN-*/index.js`                 | Objetivos y valores iniciales de las visualizaciones          |
| 5   | `src/modules/04-actividades/actividades.js` | Las preguntas                                                 |

Los cinco capítulos incluidos son modelos: teoría, visualizaciones, ejemplos, actividades y cierre.

## Añadir un capítulo

1. Crea `src/modules/06-mi-tema/contenido.html` y `src/modules/06-mi-tema/index.js`:
   ```js
   import html from './contenido.html?raw';
   import { createChapter } from '../chapter.js';

   export default createChapter({ html, objetivos: ['Primer objetivo.'] });
   ```
2. Regístralo en `src/content/capitulos.js`. El id lleva dos dígitos, guion y minúsculas sin tildes.

La navegación, la portada, el progreso y los botones anterior/siguiente se actualizan solos.

## Bloques de contenido

Todos aparecen funcionando en el capítulo 1; copia el que necesites.

| Bloque               | Código                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| Definición           | `<div class="callout callout--def" role="note">`                                                             |
| Teorema o idea clave | `callout callout--thm`                                                                                       |
| Enunciado de ejemplo | `callout callout--ex`                                                                                        |
| Advertencia          | `callout callout--warn`                                                                                      |
| Tabla                | `<div class="table-wrap"><table>…`                                                                           |
| Figura               | `<figure class="figura"><img src="./assets/images/x.png" alt="…">` (la imagen va en `public/assets/images/`) |
| Video                | `<div class="video-wrap"><iframe …>`                                                                         |
| Desplegable          | `<details class="disclosure">`                                                                               |
| Fórmula (opcional)   | `\( en línea \)` y `\[ en bloque \]`; dentro de ellas, `<` se escribe `&lt;`                                 |

## Actividades

Cuatro tipos, definidos en `actividades.js`:

| `tipo`     | Uso                                           | Corrección                                  |
| ---------- | --------------------------------------------- | ------------------------------------------- |
| `opcion`   | Una o varias respuestas correctas             | Automática                                  |
| `texto`    | Término o palabra clave                       | Automática; ignora mayúsculas y tildes      |
| `numerica` | Cálculo; admite expresiones como `log(2)/0.3` | Automática, 0.5 % de tolerancia por defecto |
| `abierta`  | Desarrollo o reflexión                        | Autoevaluación con respuesta modelo         |

Para usarlas en otro capítulo: `setup: montarActividades(LISTA)`. Cada `id` (`ej-N`) debe ser único y no cambiar
después de publicar. El progreso se guarda solo en el navegador del estudiante: **no es una calificación y el
docente no lo recibe**.

## Visualizaciones

Se insertan con `<div data-viz="nombre" data-preset="clave"></div>` y se configuran en los `presets` del `index.js`
del capítulo. Las que un capítulo no use no se descargan, así que no hace falta borrarlas.

| Nombre           | Sirve para                                  | Parámetros del preset                                                                 |
| ---------------- | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| `graficaDatos`   | Barras, líneas o sectores con datos propios | `tipo`, `titulo`, `ejeX`, `ejeY`, `etiquetas`, `series`                               |
| `graficaFuncion` | `y = f(x)` con parámetros `a` y `b`         | `expresion`, `a`, `b`, `xMin`, `xMax`, `muestras`, `estilo`, `titulo`, `ejeX`, `ejeY` |
| `superficie3D`   | `z = f(x, y)` que se puede rotar            | `expresion`, `a`, `b`, `rango`, `altura`, `ejeX`, `ejeY`, `ejeZ`                      |

El preset también admite `titulo` y `descripcion` del bloque, y `hideControls: ['a']` para ocultar controles. Una
visualización nueva, propia de una materia, se añade como archivo en `src/viz/` y una entrada en `src/viz/registry.js`;
`web_ecuaciones_vite` (plano z, lugar de raíces, Bode) sirve de ejemplo porque usa el mismo motor.

## Publicar

Comprueba antes que no quede ningún `[corchete]`.

**En el hub `control-digital-web`:** añade una entrada con `"tipo": "vite"` a la lista `paginas` de
`src/sincronizar_web_repo.py`, como la de `web_ecuaciones_vite`, y ejecuta el script. Con `--sin-publicar` solo
actualiza el hub local, sin commit ni push.

**En un repositorio propio:** sube la carpeta como raíz del repositorio y, en GitHub, elige _Settings → Pages →
Source: GitHub Actions_. El flujo `.github/workflows/deploy.yml` prueba, compila y publica en cada push a `main`.

## Comandos

| Comando                           | Qué hace                                 |
| --------------------------------- | ---------------------------------------- |
| `npm run dev`                     | Servidor de desarrollo                   |
| `npm run build`                   | Sitio optimizado en `dist/`              |
| `npm run preview`                 | Sirve `dist/` para revisarlo             |
| `npm test`                        | Pruebas del evaluador y de la corrección |
| `npm run lint` / `npm run format` | ESLint / Prettier                        |

## Identidad visual

Colores, tipografía y espaciado están en `src/styles/theme.css`. El logo está en `public/assets/images/`.
