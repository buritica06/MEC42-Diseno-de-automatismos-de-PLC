/**
 * Fábrica de paneles lil-gui.
 *
 * Reglas (anti-superposición): el panel SIEMPRE vive en un contenedor propio
 * (<aside> del bloque de visualización), nunca flotando sobre el canvas.
 *
 * Esquema de controles (lo declara cada visualización):
 *   { key, label, min, max, step, unit?, folder?, lazy?, visibleIf?(params) }  → slider
 *   { key, label, type: 'boolean' }                                            → casilla
 *   { key, label, type: 'text', lazy: true }                                   → campo de texto
 *   { key, label, type: 'select', options: { 'Texto': valor } }                → lista
 *   { label, type: 'button', action(params) }                                   → botón
 * `lazy: true` usa onFinishChange (operaciones costosas: se recalcula al soltar).
 */
import GUI from 'lil-gui';

export function createGUI(container, params, onChange, schema, { title = 'Parámetros', ariaLabel } = {}) {
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', ariaLabel ?? title);

  const gui = new GUI({ container, autoPlace: false, title, width: undefined });
  const folders = new Map();
  const entries = [];

  const folderFor = (name) => {
    if (!name) return gui;
    if (!folders.has(name)) folders.set(name, gui.addFolder(name));
    return folders.get(name);
  };

  for (const item of schema) {
    const parent = folderFor(item.folder);
    let ctrl;
    const label = item.unit ? `${item.label} (${item.unit})` : item.label;
    if (item.type === 'button') {
      const holder = { [item.label]: () => item.action?.(params) };
      ctrl = parent.add(holder, item.label);
    } else if (item.type === 'boolean' || item.type === 'text') {
      ctrl = parent.add(params, item.key).name(label); // lil-gui elige el control según el tipo del valor
    } else if (item.type === 'select') {
      ctrl = parent.add(params, item.key, item.options).name(label);
    } else {
      ctrl = parent.add(params, item.key, item.min, item.max, item.step).name(label);
    }
    if (item.type !== 'button') {
      const handler = () => {
        refreshVisibility();
        onChange(item.key, params[item.key]);
      };
      if (item.lazy) ctrl.onFinishChange(handler);
      else ctrl.onChange(handler);
    }
    // Etiqueta accesible explícita en el input nativo que genera lil-gui.
    ctrl.domElement.querySelectorAll('input, select, button').forEach((el) => {
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', label);
    });
    entries.push({ item, ctrl });
  }

  function refreshVisibility() {
    for (const { item, ctrl } of entries) {
      if (item.visibleIf) ctrl.show(Boolean(item.visibleIf(params)));
    }
  }
  refreshVisibility();

  return {
    gui,
    /** Actualiza parámetros desde fuera (presets) sin disparar onChange. */
    set(values) {
      Object.assign(params, values);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
      refreshVisibility();
    },
    destroy() {
      gui.destroy();
    },
  };
}
