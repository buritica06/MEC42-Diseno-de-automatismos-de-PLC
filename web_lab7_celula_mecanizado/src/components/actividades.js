/**
 * Motor de actividades con corrección inmediata. Se usa desde cualquier capítulo:
 *
 *   createChapter({ html, setup: montarActividades(ACTIVIDADES) })
 *
 * Campos comunes: id ('ej-N', único y estable: se guarda en el progreso), nivel,
 * titulo, enunciado (HTML + KaTeX), pista y solucion (opcionales).
 *
 * Tipos:
 *   numerica  respuestas: [{ etiqueta, valor, tol? }]   admite expresiones ("3*0.6^3")
 *   opcion    opciones: [html], correcta: índice o [índices]   (varios índices → casillas)
 *   texto     etiqueta, aceptadas: ['...']              ignora mayúsculas y tildes
 *   abierta   respuestaModelo: html                     autoevaluación con la respuesta modelo
 */
import { escapeHtml } from './card.js';
import { numeroCorrecto, textoCorrecto, opcionesCorrectas } from './corregir.js';
import { icon } from '../ui/icons.js';
import { pulse } from '../ui/motion.js';

function campos(a) {
  const fila = (i, etiqueta, inputmode) => `<div class="answer-row">
      <label for="${a.id}-r${i}">${escapeHtml(etiqueta)}</label>
      <input id="${a.id}-r${i}" name="r${i}" type="text" inputmode="${inputmode}" autocomplete="off" spellcheck="false"
        maxlength="80" aria-describedby="${a.id}-f${i}" />
      <span class="feedback" id="${a.id}-f${i}" aria-live="polite"></span>
    </div>`;
  const comprobar = '<button class="btn btn--primary btn--small" type="submit">Comprobar</button>';

  switch (a.tipo) {
    case 'numerica':
      return `${a.respuestas.map((r, i) => fila(i, r.etiqueta, 'decimal')).join('')}
        <div class="exercise__actions">${comprobar}</div>`;
    case 'texto':
      return `${fila(0, a.etiqueta, 'text')}<div class="exercise__actions">${comprobar}</div>`;
    case 'opcion': {
      const multiple = Array.isArray(a.correcta);
      return `<fieldset class="choice-list" aria-describedby="${a.id}-f0">
          <legend>${multiple ? 'Marca todas las correctas' : 'Elige una opción'}</legend>
          ${a.opciones
            .map(
              (o, i) => `<label class="choice">
                <input type="${multiple ? 'checkbox' : 'radio'}" name="opcion" value="${i}" />
                <span>${o}</span>
              </label>`
            )
            .join('')}
        </fieldset>
        <span class="feedback" id="${a.id}-f0" aria-live="polite"></span>
        <div class="exercise__actions">${comprobar}</div>`;
    }
    case 'abierta':
      return `<label class="open-answer" for="${a.id}-r0">Tu respuesta (no se guarda ni se envía)</label>
        <textarea class="open-answer__field" id="${a.id}-r0" rows="4"></textarea>
        <div class="exercise__actions">
          <button class="btn btn--primary btn--small" type="submit">Comparar con la respuesta modelo</button>
        </div>
        <div class="open-answer__model" data-modelo hidden>
          <div class="callout callout--ex" role="note"><span class="callout__title">Respuesta modelo</span>${a.respuestaModelo}</div>
          <button class="btn btn--small" type="button" data-autoevaluar>Mi respuesta cubre lo esencial</button>
        </div>`;
    default:
      throw new Error(`Tipo de actividad desconocido: ${a.tipo}`);
  }
}

function tarjeta(a, n, resuelta) {
  return `<section class="exercise reveal" data-ex="${a.id}" aria-labelledby="${a.id}-t">
    <div class="exercise__head">
      <h3 id="${a.id}-t">${n}. ${escapeHtml(a.titulo)}</h3>
      <span class="badge ${resuelta ? 'badge--done' : ''}" data-badge>${resuelta ? `${icon('check')} Resuelto` : escapeHtml(a.nivel)}</span>
    </div>
    ${a.enunciado}
    <form class="exercise__answers" novalidate>${campos(a)}</form>
    ${a.pista ? `<details class="disclosure"><summary>Pista</summary><div>${a.pista}</div></details>` : ''}
    ${a.solucion ? `<details class="disclosure"><summary>Solución</summary><div>${a.solucion}</div></details>` : ''}
  </section>`;
}

function avisar(el, ok, texto) {
  el.className = `feedback ${ok ? 'feedback--ok' : 'feedback--bad'}`;
  el.textContent = texto;
}

async function corregirNumerica(a, form) {
  // math.js se descarga solo cuando el estudiante comprueba su primera respuesta numérica.
  const { evaluateSafe } = await import('../math/evaluator.js');
  let todas = true;
  for (const [i, r] of a.respuestas.entries()) {
    const input = form.querySelector(`[name="r${i}"]`);
    const fb = form.querySelector(`#${a.id}-f${i}`);
    const raw = input.value.trim().replace(',', '.');
    let ok = false;
    if (!raw) avisar(fb, false, 'Escribe una respuesta.');
    else {
      try {
        const v = await evaluateSafe(raw, {}, { timeoutMs: 50 });
        ok = numeroCorrecto(v, r.valor, r.tol);
        avisar(
          fb,
          ok,
          ok ? `✓ Correcto (${v.toPrecision(5)})` : `✗ Obtuviste ${v.toPrecision(5)}; revisa el procedimiento.`
        );
      } catch (err) {
        avisar(fb, false, `No se pudo interpretar: ${err.message}`);
      }
    }
    input.setAttribute('aria-invalid', String(!ok));
    todas &&= ok;
  }
  return todas;
}

function corregirTexto(a, form) {
  const input = form.querySelector('[name="r0"]');
  const fb = form.querySelector(`#${a.id}-f0`);
  const ok = input.value.trim() !== '' && textoCorrecto(input.value, a.aceptadas);
  input.setAttribute('aria-invalid', String(!ok));
  avisar(fb, ok, ok ? '✓ Correcto' : input.value.trim() ? '✗ No coincide; revisa la pista.' : 'Escribe una respuesta.');
  return ok;
}

function corregirOpcion(a, form) {
  const fb = form.querySelector(`#${a.id}-f0`);
  const marcadas = [...form.querySelectorAll('[name="opcion"]:checked')].map((el) => Number(el.value));
  const ok = opcionesCorrectas(marcadas, a.correcta);
  avisar(fb, ok, ok ? '✓ Correcto' : marcadas.length ? '✗ Todavía no; inténtalo de nuevo.' : 'Marca una opción.');
  return ok;
}

/** Devuelve la función setup() para createChapter. */
export function montarActividades(actividades) {
  return function setup(root, ctx) {
    const list = document.createElement('div');
    list.innerHTML = actividades.map((a, i) => tarjeta(a, i + 1, ctx.progress.isExerciseSolved(a.id))).join('');
    root.appendChild(list);
    ctx.renderMathIn(list);

    const marcarResuelta = (box, a) => {
      ctx.progress.markExercise(a.id);
      const badge = box.querySelector('[data-badge]');
      badge.className = 'badge badge--done';
      badge.innerHTML = `${icon('check')} Resuelto`;
      pulse(badge);
    };
    const actividadDe = (el) => {
      const box = el.closest('[data-ex]');
      return { box, a: actividades.find((x) => x.id === box.dataset.ex) };
    };

    const onSubmit = async (e) => {
      const form = e.target.closest('form');
      if (!form) return;
      e.preventDefault();
      const { box, a } = actividadDe(form);
      if (a.tipo === 'abierta') {
        form.querySelector('[data-modelo]').hidden = false;
        return;
      }
      const corregir = { numerica: corregirNumerica, texto: corregirTexto, opcion: corregirOpcion }[a.tipo];
      if (await corregir(a, form)) marcarResuelta(box, a);
    };
    const onClick = (e) => {
      const boton = e.target.closest('[data-autoevaluar]');
      if (!boton) return;
      const { box, a } = actividadDe(boton);
      marcarResuelta(box, a);
      boton.disabled = true;
    };
    root.addEventListener('submit', onSubmit);
    root.addEventListener('click', onClick);
    ctx.track(() => {
      root.removeEventListener('submit', onSubmit);
      root.removeEventListener('click', onClick);
    });
  };
}
