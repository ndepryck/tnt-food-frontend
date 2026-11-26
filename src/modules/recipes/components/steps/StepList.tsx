import {
  Component,
  type ReactNode,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { IconButton } from "../../../../core/IconButton";
import type { RecipeStepResponse as Step } from "../../api/recipeSteps";

type Gesture = {
  pointerId: number;
  handle: HTMLButtonElement;
  step: Step;
  snapshot: Step[];
};
type Drag = { gesture: Gesture; destination?: number };
type Point = { clientX: number; clientY: number };

function destination(list: HTMLOListElement | null, point: Point) {
  const row = document
    .elementFromPoint(point.clientX, point.clientY)
    ?.closest("li");
  return row && row.parentElement === list ? row.value : undefined;
}

function scrollAtEdge(
  list: HTMLOListElement,
  { clientX: x, clientY: y }: Point,
  elapsed: number,
) {
  const rect = list.getBoundingClientRect();
  const height = window.innerHeight;
  if (
    x < rect.left ||
    x > rect.right ||
    y < 0 ||
    y >= height ||
    y < rect.top ||
    y >= rect.bottom
  )
    return;
  const band = Math.min(80, height / 4);
  const depth = y < band ? y - band : Math.max(0, y - (height - band));
  // Keep the pointer inside the terminal row, not on its fractional-pixel
  // border where Chromium's elementFromPoint can hit the enclosing section.
  const speed = Math.round((depth / band) * elapsed * 0.8);
  const remaining = speed > 0 ? rect.bottom - y : y - rect.top;
  const delta =
    Math.sign(speed) *
    Math.min(Math.abs(speed), Math.max(0, Math.floor(remaining - 4)));
  if (delta) window.scrollBy({ top: delta, behavior: "instant" });
}

type RowsProps = {
  list: RefObject<HTMLOListElement | null>;
  steps: Step[];
  children: ReactNode;
};

class StepRows extends Component<RowsProps> {
  // Moving a focused row via DOM insertion can blur it. Capture only the
  // focus actually inside the list just before the canonical order commits.
  getSnapshotBeforeUpdate(previous: RowsProps) {
    if (previous.steps === this.props.steps) return null;
    const focused = document.activeElement;
    return focused instanceof HTMLElement &&
      this.props.list.current?.contains(focused)
      ? focused
      : null;
  }

  componentDidUpdate(
    _previous: RowsProps,
    _state: unknown,
    focused: HTMLElement | null,
  ) {
    if (focused?.isConnected && document.activeElement === document.body)
      focused.focus({ preventScroll: true });
  }

  render() {
    return (
      <ol ref={this.props.list} className="step-list">
        {this.props.children}
      </ol>
    );
  }
}

export function StepList({
  steps,
  blocked,
  fallback,
  edit,
  remove,
  move,
}: {
  steps: Step[];
  blocked: boolean;
  fallback: RefObject<HTMLHeadingElement | null>;
  edit: (step: Step) => void;
  remove: (step: Step) => void;
  move: (step: Step, position: number) => void;
}) {
  const list = useRef<HTMLOListElement>(null);
  const pointer = useRef<Point | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // A retained control keeps focus during the read; only an evicted row
  // needs a fallback, and only when the user is still focused inside it.
  const focusOnRemoval = useCallback(
    (row: HTMLLIElement | null) => {
      if (!row) return;
      return () => {
        if (row.contains(document.activeElement))
          fallback.current?.focus({ preventScroll: true });
      };
    },
    [fallback],
  );
  const gesture = drag?.gesture;
  const active = !blocked && gesture?.snapshot === steps ? gesture : null;
  useLayoutEffect(() => {
    if (!active) {
      // A gesture never resumes after a dialog, a lock, or a new snapshot.
      if (gesture) setDrag(null);
      return;
    }
    let frame: number;
    let previous = performance.now();
    const tick = (now: number) => {
      if (pointer.current && list.current) {
        scrollAtEdge(
          list.current,
          pointer.current,
          Math.min(32, now - previous),
        );
        const position = destination(list.current, pointer.current);
        setDrag((current) =>
          current?.gesture === active && current.destination !== position
            ? { ...current, destination: position }
            : current,
        );
      }
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const cancelOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrag(null);
    };
    const cancel = () => setDrag(null);
    window.addEventListener("keydown", cancelOnEscape);
    window.addEventListener("blur", cancel);
    return () => {
      cancelAnimationFrame(frame);
      pointer.current = null;
      window.removeEventListener("keydown", cancelOnEscape);
      window.removeEventListener("blur", cancel);
      if (active.handle.hasPointerCapture(active.pointerId))
        active.handle.releasePointerCapture(active.pointerId);
    };
  }, [active, gesture]);

  // Pointer capture keeps delivering events to the handle even across rows.
  // Hit-test at release as well: an outside drop must never use an old target.
  return (
    <StepRows list={list} steps={steps}>
      {steps.map((step) => {
        const target =
          active &&
          drag?.destination === step.position &&
          active.step.id !== step.id;
        const label = `Déplacer l’étape ${step.position}`;
        return (
          <li
            key={step.id}
            ref={focusOnRemoval}
            value={step.position}
            data-drop={
              target
                ? step.position < active.step.position
                  ? "before"
                  : "after"
                : undefined
            }
          >
            <div className="step-instruction">
              <b aria-hidden="true">{step.position}.</b>
              <span>{step.description}</span>
            </div>
            <div className="recipe-actions">
              <button
                type="button"
                className="icon-btn step-handle"
                aria-label={label}
                aria-disabled={blocked || steps.length < 2}
                onClick={(e) => {
                  if (!blocked && steps.length > 1 && e.detail === 0)
                    edit(step);
                }}
                onPointerDown={(e) => {
                  if (
                    blocked ||
                    steps.length < 2 ||
                    active ||
                    !e.isPrimary ||
                    e.button !== 0
                  )
                    return;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setDrag({
                    gesture: {
                      step,
                      pointerId: e.pointerId,
                      handle: e.currentTarget,
                      snapshot: steps,
                    },
                    destination: step.position,
                  });
                }}
                onPointerMove={(e) => {
                  if (
                    active?.pointerId !== e.pointerId ||
                    active.handle !== e.currentTarget
                  )
                    return;
                  pointer.current = { clientX: e.clientX, clientY: e.clientY };
                  setDrag({
                    gesture: active,
                    destination: destination(list.current, e),
                  });
                }}
                onPointerUp={(e) => {
                  if (
                    active?.pointerId !== e.pointerId ||
                    active.handle !== e.currentTarget
                  )
                    return;
                  const position = destination(list.current, e);
                  setDrag(null);
                  if (
                    position !== undefined &&
                    position !== active.step.position
                  )
                    move(active.step, position);
                }}
                onPointerCancel={(e) => {
                  if (
                    active?.pointerId === e.pointerId &&
                    active.handle === e.currentTarget
                  )
                    setDrag(null);
                }}
                onLostPointerCapture={(e) => {
                  if (
                    active?.pointerId === e.pointerId &&
                    active.handle === e.currentTarget
                  )
                    setDrag(null);
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  fill="currentColor"
                >
                  {[6, 12, 18].map((y) => (
                    <g key={y}>
                      <circle cx="9" cy={y} r="1.8" />
                      <circle cx="15" cy={y} r="1.8" />
                    </g>
                  ))}
                </svg>
                <span className="tooltip" aria-hidden="true">
                  {label}
                </span>
              </button>
              <IconButton
                icon="edit"
                label={`Modifier l’étape ${step.position}`}
                blocked={blocked || !!active}
                onClick={() => edit(step)}
              />
              <IconButton
                icon="delete"
                label={`Supprimer l’étape ${step.position}`}
                blocked={blocked || !!active}
                onClick={() => remove(step)}
              />
            </div>
          </li>
        );
      })}
    </StepRows>
  );
}
