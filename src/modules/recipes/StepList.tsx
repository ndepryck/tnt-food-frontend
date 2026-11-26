import { useLayoutEffect, useRef, useState } from "react";
import { IconButton } from "../../core/IconButton";
import type { RecipeStepResponse as Step } from "./api";

type Drag = { pointerId: number; step: Step; destination?: number };
type Point = { clientX: number; clientY: number };

function destination(list: HTMLOListElement | null, point: Point) {
  const row = document.elementFromPoint(point.clientX, point.clientY)?.closest("li");
  return row && row.parentElement === list ? row.value : undefined;
}

function scrollAtEdge(list: HTMLOListElement, { clientX: x, clientY: y }: Point, elapsed: number) {
  const rect = list.getBoundingClientRect();
  const height = window.innerHeight;
  if (x < rect.left || x > rect.right || y < 0 || y >= height || y < rect.top || y >= rect.bottom) return;
  const band = Math.min(80, height / 4);
  const depth = y < band ? y - band : Math.max(0, y - (height - band));
  // Keep the pointer inside the terminal row, not on its fractional-pixel
  // border where Chromium's elementFromPoint can hit the enclosing section.
  const speed = Math.round(depth / band * elapsed * 0.8);
  const remaining = speed > 0 ? rect.bottom - y : y - rect.top;
  const delta = Math.sign(speed) * Math.min(Math.abs(speed), Math.max(0, Math.floor(remaining - 4)));
  if (delta) window.scrollBy({ top: delta, behavior: "instant" });
}

export function StepList({ steps, blocked, edit, remove, move }: {
  steps: Step[]; blocked: boolean; edit: (step: Step) => void; remove: (step: Step) => void;
  move: (step: Step, position: number) => void;
}) {
  const list = useRef<HTMLOListElement>(null);
  const pointer = useRef<Point | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragging = drag !== null;
  useLayoutEffect(() => {
    if (!dragging) return;
    let frame: number;
    let previous = performance.now();
    const tick = (now: number) => {
      if (pointer.current && list.current) {
        scrollAtEdge(list.current, pointer.current, Math.min(32, now - previous));
        const position = destination(list.current, pointer.current);
        setDrag(active => active && active.destination !== position ? { ...active, destination: position } : active);
      }
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setDrag(null); };
    const cancel = () => setDrag(null);
    window.addEventListener("keydown", escape);
    window.addEventListener("blur", cancel);
    return () => {
      cancelAnimationFrame(frame);
      pointer.current = null;
      window.removeEventListener("keydown", escape);
      window.removeEventListener("blur", cancel);
    };
  }, [dragging]);

  // Pointer capture keeps delivering events to the handle even across rows.
  // Hit-test at release as well: an outside drop must never use an old target.
  return <ol ref={list} className="step-list">{steps.map(step => {
    const target = drag?.destination === step.position && drag.step.id !== step.id;
    const label = `Déplacer l’étape ${step.position}`;
    return <li key={step.id} value={step.position}
      data-drop={target ? (step.position < drag.step.position ? "before" : "after") : undefined}>
      <div className="step-instruction"><b aria-hidden="true">{step.position}.</b><span>{step.description}</span></div>
      <div className="recipe-actions">
        <button type="button" className="icon-btn step-handle" aria-label={label} disabled={blocked || steps.length < 2}
          onClick={e => { if (e.detail === 0) edit(step); }}
          onPointerDown={e => {
            if (blocked || drag || !e.isPrimary || e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag({ step, pointerId: e.pointerId, destination: step.position });
          }}
          onPointerMove={e => {
            if (drag?.pointerId !== e.pointerId) return;
            pointer.current = { clientX: e.clientX, clientY: e.clientY };
            setDrag({ ...drag, destination: destination(list.current, e) });
          }}
          onPointerUp={e => {
            if (drag?.pointerId !== e.pointerId) return;
            const position = destination(list.current, e);
            setDrag(null);
            if (!blocked && position !== undefined && position !== drag.step.position) move(drag.step, position);
          }}
          onPointerCancel={e => { if (drag?.pointerId === e.pointerId) setDrag(null); }}
          onLostPointerCapture={e => { if (drag?.pointerId === e.pointerId) setDrag(null); }}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            {[6, 12, 18].map(y => <g key={y}><circle cx="9" cy={y} r="1.8" /><circle cx="15" cy={y} r="1.8" /></g>)}
          </svg>
          <span className="tooltip" aria-hidden="true">{label}</span>
        </button>
        <IconButton icon="edit" label={`Modifier l’étape ${step.position}`} blocked={blocked || !!drag} onClick={() => edit(step)} />
        <IconButton icon="delete" label={`Supprimer l’étape ${step.position}`} blocked={blocked || !!drag} onClick={() => remove(step)} />
      </div>
    </li>;
  })}</ol>;
}
