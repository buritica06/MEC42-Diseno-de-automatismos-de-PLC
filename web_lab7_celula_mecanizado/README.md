# MEC42 — Célula de Mecanizado Electroneumática y Husillo Trifásico

Plataforma educativa web interactiva para la **Práctica de Laboratorio N.º 07** de la asignatura **MEC42 — Diseño de automatismos de PLC** de la **Institución Universitaria de Barranquilla (IUB)**.

* **Docente:** Ing. Ricardo D. Buriticá R.
* **Programa:** Ingeniería Mecatrónica · Facultad de Ingeniería
* **Secuencia de control:**
  $$\text{S1 (Marcha)} \longrightarrow A+ \longrightarrow A- \longrightarrow B- \longrightarrow A+ \longrightarrow B+ \longrightarrow \text{Motor Trifásico } M_1 \text{ (Giro Derecha CW)}$$

---

**Sitio publicado:** https://buritica06.github.io/MEC42-Diseno-de-automatismos-de-PLC/

---

## 🛠️ Características Principales

1. **Gemelo Digital 3D (Three.js):**
   * Modelado ortogonal de los actuadores industriales: **Cilindro A monoestable** con resorte helicoidal visible, **Cilindro B biestable** con mordaza de sujeción neumática y **Husillo rotativo trifásico $M_1$** (giro horario CW).
   * Monitoreo dinámico de sensores magnéticos Reed ($a_0, a_1, b_0, b_1$), electroválvulas ($Y_A, Y_{B+}, Y_{B-}$) y contactor $KM_1$.
   * Simulación interactiva de **corte súbito de 24 VDC** (demostración de seguridad intrínseca: $A$ retorna por resorte a $0\text{ mm}$ mientras $B$ biestable retiene la pieza en $50\text{ mm}$) y **disparo por sobrecarga térmica RT1** (contactos 95-96).

2. **Diagrama Espacio-Fase y Sincronismo Temporal (Plotly):**
   * Gráficas sincronizadas de carrera (mm) y señales de mando (%) conmutables entre índice de fase GRAFCET y tiempo real acumulado en segundos ($T_{\text{ciclo}}$).

3. **Marco Teórico y Normativa Industrial:**
   * Diagrama GRAFCET tecnológico bajo norma internacional **IEC 60848**.
   * Tabla de direccionamiento de entradas y salidas digitales para PLC **Siemens S7-1200** (TIA Portal).
   * Formulación booleana Set/Reset y prevención estricta del error de **doble bobina** en Ladder ($Y_A = M_1 + M_4 + M_5 + M_6$).
   * Protocolo de **Seguridad Eléctrica: Las 5 Reglas de Oro** (RETIE Res. 90708) y Rúbrica Oficial de Calificación (5.0 / 2.0 / 0.0).

4. **Laboratorio Virtual Autoevaluable:**
   * 8 actividades interactivas con validación inmediata, tolerancia analítica en cálculos y persistencia en `localStorage`.

---

## 🚀 Puesta en Marcha Local

Requiere **Node.js 20+**. Desde esta carpeta:

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npm run dev

# 3. Ejecutar pruebas unitarias
npm test

# 4. Compilar para producción
npm run build
```

El servidor local se iniciará típicamente en `http://localhost:5173/` o `http://localhost:4173/`.

---

## 🌐 Despliegue en GitHub Pages

El flujo [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml), en la raíz del repositorio, compila esta carpeta y la publica en la raíz del sitio en cada `push` a `main`.

---

## 📚 Bibliografía de Referencia (IEEE)

1. International Electrotechnical Commission, *IEC 60848:2013 — GRAFCET specification language for sequential function charts*, 3.ª ed. Ginebra, Suiza: IEC, 2013.
2. International Electrotechnical Commission, *IEC 61131-3:2013 — Programmable controllers — Part 3: Programming languages*, 3.ª ed. Ginebra, Suiza: IEC, 2013.
3. Ministerio de Minas y Energía de Colombia, *Reglamento Técnico de Instalaciones Eléctricas (RETIE) — Resolución 90708 de 2013, Art. 18: Reglas de oro de la seguridad eléctrica*. Bogotá: MinMinas, 2013.
4. R. Piedrafita Moreno, *Ingeniería de la automatización industrial*, 2.ª ed. Madrid: Ra-Ma Editorial, 2004.
5. Festo Didactic SE, *Electroneumática — Nivel Básico TP 201: Manual de estudio y ejercicios*. Denkendorf, Alemania: Festo Didactic, 2015.
