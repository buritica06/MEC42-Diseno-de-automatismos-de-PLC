# Laboratorio 8 — Alimentos Del Valle: simulación 3D

Capítulo 2 del laboratorio de la Semana 8 de **MEC42 — Diseño de automatismos de PLC** (IUB): simulación 3D de la estación de dosificación y corte antigoteo de arequipe, con Three.js y troika-three-text.

**Sitio publicado:** https://buritica06.github.io/MEC42-Diseno-de-automatismos-de-PLC/lab8/

## Comandos

Requiere Node.js 20.19 o superior. Desde esta carpeta:

`ash
npm install
npm run dev
`

| Comando         | Qué hace                     |
| --------------- | ---------------------------- |
| `npm test`      | Pruebas de la lógica         |
| `npm run lint`  | ESLint                       |
| `npm run build` | Sitio optimizado en `dist/` |

## Archivos principales

| Archivo                                | Contenido                                     |
| -------------------------------------- | --------------------------------------------- |
| `src/viz/three/alimentosLogica.js`     | Lógica del GRAFCET, sin dependencias de Three |
| `src/viz/three/alimentosDelValle3D.js` | Escena 3D y controles                         |
| `tests/alimentos.test.js`              | Pruebas de la secuencia                       |

El sitio se creó con la plantilla transversal de la IUB. Los módulos de otros capítulos que trae la plantilla no se usan ni entran en la compilación.
