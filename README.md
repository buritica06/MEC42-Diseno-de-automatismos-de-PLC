# MEC42 — Diseño de automatismos de PLC

Plataformas web interactivas de los laboratorios de la asignatura **MEC42 — Diseño de automatismos de PLC**, de la **Institución Universitaria de Barranquilla (IUB)**.

- **Docente:** Ing. Ricardo D. Buriticá R.
- **Programa:** Ingeniería Mecatrónica · Facultad de Ingeniería

## Laboratorios

| Laboratorio | Contenido | Sitio publicado | Código |
| --- | --- | --- | --- |
| **7 — Célula de Mecanizado** | Gemelo digital 3D, diagrama de fases, teoría, actividades y rúbrica | [Abrir](https://buritica06.github.io/MEC42-Diseno-de-automatismos-de-PLC/) | [`web_lab7_celula_mecanizado/`](web_lab7_celula_mecanizado/) |
| **8 — Alimentos Del Valle** | Simulación 3D de la estación de dosificación y corte antigoteo | [Abrir](https://buritica06.github.io/MEC42-Diseno-de-automatismos-de-PLC/lab8/) | [`web_lab8_alimentos_del_valle/`](web_lab8_alimentos_del_valle/) |

## Estructura

```
.
├── .github/workflows/deploy.yml     # Prueba, compila y publica todos los sitios
├── web_lab7_celula_mecanizado/      # Se publica en la raíz del sitio
└── web_lab8_alimentos_del_valle/    # Se publica en /lab8/
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

Cada `push` a `main` ejecuta las pruebas de los dos laboratorios, los compila y publica ambos en GitHub Pages con [`deploy.yml`](.github/workflows/deploy.yml).

Si el paso «Publicar» falla con un error 500 o 502 de GitHub, usa **Re-run failed jobs** en la ejecución.
