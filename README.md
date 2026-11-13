# MEC42 — Diseño de automatismos de PLC

Plataformas web interactivas de los laboratorios de la asignatura **MEC42 — Diseño de automatismos de PLC**, de la **Institución Universitaria de Barranquilla (IUB)**.

- **Docente:** Ing. Ricardo D. Buriticá R.
- **Programa:** Ingeniería Mecatrónica · Facultad de Ingeniería

## Laboratorios

| Laboratorio | Contenido | Sitio publicado | Código |
| --- | --- | --- | --- |
| **7 — Célula de Mecanizado** | Gemelo digital 3D, diagrama de fases, teoría, actividades y rúbrica | [Abrir](https://buritica06.github.io/MEC42-Diseno-de-automatismos-de-PLC/) | [`web_lab7_celula_mecanizado/`](web_lab7_celula_mecanizado/) |
| **8 — Alimentos Del Valle** | Simulación 3D de la estación de dosificación y corte antigoteo | [Abrir](https://buritica06.github.io/MEC42-Diseno-de-automatismos-de-PLC/lab8/) | [`web_lab8_alimentos_del_valle/`](web_lab8_alimentos_del_valle/) |
| **Parcial II (Semana 10) — Estación de giro temporizado** | Simulación 3D de la mesa revólver (Figura 1), introducción y diagrama de fases | [Abrir](https://buritica06.github.io/MEC42-Diseno-de-automatismos-de-PLC/parcial10/) | [`web_parcial10_giro_temporizado/`](web_parcial10_giro_temporizado/) |
| **11 — Estampadora electrohidráulica** | Figura 1 en 3D (ciclo, emergencia y fallas), introducción, diagrama de fases VDI 3260 y Gantt | [Abrir](https://buritica06.github.io/MEC42-Diseno-de-automatismos-de-PLC/lab11/) | [`web_lab11_estampadora_electrohidraulica/`](web_lab11_estampadora_electrohidraulica/) |
| **Parcial Final (Semana 14) — Equipo de manipulación** | Figura 1 en 3D (ciclo doble, lote N, emergencia y reposición), introducción y diagrama de fases | [Abrir](https://buritica06.github.io/MEC42-Diseno-de-automatismos-de-PLC/parcial14/) | [`web_parcial14_equipo_manipulacion/`](web_parcial14_equipo_manipulacion/) |

## Estructura

```
.
├── .github/workflows/deploy.yml     # Prueba, compila y publica todos los sitios
├── web_lab7_celula_mecanizado/      # Se publica en la raíz del sitio
├── web_lab8_alimentos_del_valle/    # Se publica en /lab8/
├── web_parcial10_giro_temporizado/  # Se publica en /parcial10/
├── web_lab11_estampadora_electrohidraulica/  # Se publica en /lab11/
└── web_parcial14_equipo_manipulacion/  # Se publica en /parcial14/
```

Cada carpeta es un proyecto independiente, con sus propias dependencias.

## Trabajar en un laboratorio

Requiere Node.js 20.19 o superior. Desde la carpeta del laboratorio:

```bash
npm install
npm run dev
```

Cada carpeta tiene su propio README con más detalles.

## Publicación

Cada `push` a `main` ejecuta las pruebas de todos los sitios, los compila y los publica en GitHub Pages con [`deploy.yml`](.github/workflows/deploy.yml).

Si el paso «Publicar» falla con un error 500 o 502 de GitHub, usa **Re-run failed jobs** en la ejecución.
