# Examen Parcial II — Estación automática de giro temporizado (sitio interactivo)

Sitio web de **MEC42 — Diseño de automatismos de PLC** (IUB) que acompaña la guía del Examen Parcial II (Semana 10).
Se construyó con la plantilla transversal de la IUB usada en `web_lab8_alimentos_del_valle` (Vite + Three.js + GSAP + KaTeX + lil-gui) y conserva su arquitectura: router por hash, capítulos modulares, anfitrión de visualizaciones con carga diferida y tema claro/oscuro.

## Contenido

| Capítulo             | Contenido                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1. Introducción      | Contexto técnico breve, objetivo y subsistemas con su equivalencia en el banco de 4 cilindros                       |
| 2. Simulación 3D     | **Figura 1** animada: mesa revólver de 6 cunas, transportes 1 y 2, herramientas F–K, cintas, M_LUB, Y_BARRIDO y PLC |
| 3. Diagrama de fases | Diagrama espacio-fase interactivo (planta A–K / banco), reproducción del ciclo y tabla del GRAFCET GP               |

## Comandos

Requiere Node.js 20.19 o superior.

```bash
npm install
npm run dev
```

| Comando         | Qué hace                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `npm test`      | Pruebas de la lógica del automatismo (secuencia, tiempos, emergencia, reposición)              |
| `npm run lint`  | ESLint                                                                                         |
| `npm run build` | Sitio optimizado en `dist/` (rutas relativas: funciona en cualquier subcarpeta o GitHub Pages) |

## Arquitectura

| Archivo                              | Responsabilidad                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `src/content/secuencia.js`           | **Fuente única de datos**: carreras, temporizadores, etapas, fases y trazas del espacio-fase                  |
| `src/viz/three/giroLogica.js`        | Programa del S7-1200 sin Three.js: GP (M0–M9, 7w, 8w), GL/GM (M20–M23), GS (M30–M36), scan de 5 ms            |
| `src/viz/three/giroTemporizado3D.js` | Escena 3D: geometría fusionada por material, LED instanciados, interpolación entre scans, render bajo demanda |
| `src/diagrams/espacioFase.js`        | Diagrama SVG accesible y temático (tokens `--viz-*`)                                                          |
| `src/viz/host.js`                    | Carga diferida, panel de controles, lecturas y barra de fases sincronizada                                    |
| `tests/giro.test.js`                 | 12 pruebas de la secuencia y de los modos GEMMA                                                               |

### Decisiones de modelado

- La mesa tiene **seis cunas** (indexación de 60°): carga 210°, taladrado 270°, asiento 330°, desbarbado 30°, espera 90° y descarga 150°. Así la cuna que vacía el transporte 2 llega vacía a la posición de carga tras el giro.
- A/C, B/D, E y F…K comparten válvula (Y1, Y2, Y3, Y4), igual que en el banco de cuatro cilindros.
- El botón **MARCHA** del panel, tras energizar o tras una emergencia, ejecuta antes la reposición (REPOS) como lo haría el operario.
- Si una emergencia ocurre después del giro con las ventosas activas, la cuna de descarga ya trae otra pieza; la simulación lo señala como aviso y retira la pieza retenida (limitación útil para discutir junto con las preguntas de profundización).

## Rendimiento y accesibilidad

- Three.js, troika y lil-gui se cargan solo al acercarse la escena; los diagramas no dependen de WebGL.
- El bucle se detiene fuera de pantalla y sin movimiento; la calidad baja por escalones si el equipo no sostiene ~45 fps.
- Escena con teclado (Espacio, P, E, 0, flechas, + / −, R), diagramas navegables con Tab y flechas, `prefers-reduced-motion` respetado.
