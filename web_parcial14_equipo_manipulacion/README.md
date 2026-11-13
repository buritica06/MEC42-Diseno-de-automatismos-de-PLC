# Parcial Final — Equipo de manipulación de 4 ejes

Sitio interactivo del Examen Parcial Final (Semana 14) de **MEC42 — Diseño de automatismos de PLC** (IUB):
introducción, Figura 1 en 3D (Three.js) y diagrama de fases.

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

| Archivo                              | Contenido                                                          |
| ------------------------------------ | ------------------------------------------------------------------ |
| `src/content/capitulos.js`           | Capítulos y orden de navegación                                    |
| `src/viz/three/manipuladorLogica.js` | GRAFCET GP, GC y GS (programa SCL del parcial) y modelo de planta  |
| `src/viz/three/manipulador3D.js`     | Escena 3D, controles y lecturas                                    |
| `src/viz/three/geometria.js`         | Primitivas y fusión de geometrías por material                     |
| `src/components/diagramaFases.js`    | Diagrama espacio-fase en SVG (13 líneas, T1 y T2)                  |
| `src/modules/0X-*/`                  | Contenido de cada capítulo                                         |
| `tests/manipulador.test.js`          | Secuencia, lote N, parada a fin de ciclo, emergencia y vigilancia  |

La lógica avanza a 5 ms fijos como un PLC y reproduce el FC1/FB1 del documento: KS con rearme vigilado,
zona de aire A-B-C con desconexión retardada (Y8) y zona de D instantánea (Y9), reposición de D en GS 21–22,
contador CTU y filtro de 2 s sobre B_PIEZA. La arquitectura (router por hash, anfitrión de visualizaciones,
temas claro y oscuro) es la de la plantilla IUB usada en el Laboratorio 11.
