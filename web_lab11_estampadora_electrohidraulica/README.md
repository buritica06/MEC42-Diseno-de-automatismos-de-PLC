# Laboratorio 11 — Estampadora electrohidráulica

Sitio interactivo del reto de la Semana 11 de **MEC42 — Diseño de automatismos de PLC** (IUB): introducción, Figura 1 en 3D (Three.js), diagrama de fases VDI 3260 y diagrama de Gantt.

## Comandos

Requiere Node.js 20.19 o superior. Desde esta carpeta:

```bash
npm install
npm run dev
```

| Comando         | Qué hace                    |
| --------------- | --------------------------- |
| `npm test`      | Pruebas de la lógica        |
| `npm run lint`  | ESLint                      |
| `npm run build` | Sitio optimizado en `dist/` |

## Archivos principales

| Archivo                              | Contenido                                            |
| ------------------------------------ | ---------------------------------------------------- |
| `src/content/capitulos.js`           | Capítulos y orden de navegación                      |
| `src/viz/three/estampadoraLogica.js` | GRAFCET GP y GS y modelo de la planta (sin Three.js) |
| `src/viz/three/estampadora3D.js`     | Escena 3D, controles y lecturas                      |
| `src/viz/three/geometria.js`         | Primitivas, fusión por material, manguera y texturas |
| `src/components/diagramaFases.js`    | Diagrama espacio-fase en SVG                         |
| `src/components/gantt.js`            | Diagrama de Gantt en HTML y CSS                      |
| `src/modules/0X-*/`                  | Contenido de cada capítulo                           |
| `tests/estampadora.test.js`          | Pruebas de la secuencia, las fallas y la emergencia  |

La arquitectura (router por hash, anfitrión de visualizaciones, temas claro y oscuro) es la de la plantilla transversal de la IUB usada en el Laboratorio 8.
