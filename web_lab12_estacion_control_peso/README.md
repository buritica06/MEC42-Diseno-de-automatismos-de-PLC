# Laboratorio 12 — Estación de Control de Peso y Clasificación por Tolerancia

Sitio web interactivo del reto de la Semana 12 de **MEC42 — Diseño de automatismos de PLC** (Institución Universitaria de Barranquilla - IUB):
- **Capítulo 1 · Introducción:** Contextualización del proyecto, tecnologías electroneumáticas Festo a 6 bar, PLC Siemens S7-1200 e inventario de hardware.
- **Capítulo 2 · Plano de situación en 3D:** misma disposición que el plano isométrico y la vista en planta de la guía (cilindros con mordazas de sujeción, A hacia la báscula, pasador de B bajo la báscula, empujador en U de C hacia la línea y la cinta H1, placa de D hacia la canaleta). Báscula con indicador y tendencia, panel de E/S del S7-1200, pruebas de la tabla de resultados (S6, cable de S6, corte de tensión, Reset_Conteo), vigilancia por etapa de 5 s e inyección de fallas (atascos de A–D y fotocélula S5).
- **Capítulo 3 · Diagrama de fases:** Representación espacio-fase VDI 3260 interactiva con bifurcación de trayectorias y correspondencia con el GRAFCET tecnológico IEC 60848.
- **Capítulo 4 · Diagrama de Gantt:** Plan de trabajo de las 4 horas de taller presencial (8 pasos) y cronogramas de ejecución cinemática para las rutas conforme y no conforme.

## Comandos

Requiere Node.js 20.19 o superior. Desde esta carpeta:

```bash
npm install
npm run dev
```

La simulación queda en `http://localhost:5173/#/capitulo/02-simulacion` (puerto por defecto de Vite).
Si `node_modules` es un enlace a otra carpeta, `vite.config.js` ya permite servir sus fuentes.

| Comando         | Qué hace                    |
| --------------- | --------------------------- |
| `npm test`      | Pruebas unitarias de la lógica (Vitest) |
| `npm run lint`  | Validación con ESLint       |
| `npm run build` | Compilación optimizada en `dist/` |

## Archivos principales

| Archivo                                   | Contenido                                                |
| ----------------------------------------- | -------------------------------------------------------- |
| `src/content/capitulos.js`                | Estructura y orden de navegación de capítulos            |
| `src/content/curso.js`                    | Metadatos institucionales del proyecto y la asignatura   |
| `src/viz/three/estacionPesoLogica.js`     | Modelo de la planta, GRAFCET GP/GM y cinemática          |
| `src/viz/three/estacionPeso3D.js`         | Escena 3D, materiales PBR, actuadores y visualizador     |
| `src/components/diagramaFases.js`         | Diagrama espacio-fase en SVG con selector de rama OR     |
| `src/components/gantt.js`                 | Diagrama de Gantt adaptable y accesible                 |
| `src/modules/0X-*/`                       | Contenido modular de cada sección                        |
| `tests/estacionPeso.test.js`              | Pruebas de secuencia, divergencia OR, temporizadores y S6|
