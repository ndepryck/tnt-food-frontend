import {
  type FormEvent,
  type ReactNode,
  type RefObject,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { dialogKeyboard } from "./dialogKeyboard";
import { HttpError } from "./http";
import { IconButton } from "./IconButton";

interface Props {
  title: string;
  submitLabel: string;
  failure: string;
  close: () => void;
  write: () => Promise<void>;
  fields?: (pending: boolean) => ReactNode;
  confirmation?: string;
  conflict?: string;
  feedbackKey?: string;
  fallback?: RefObject<HTMLElement | null>;
}

// Save and confirmation dialogs share locking, feedback, dismissal and focus.
export function WriteDialog({
  title,
  submitLabel,
  failure,
  close,
  write,
  fields,
  confirmation,
  conflict,
  feedbackKey,
  fallback,
}: Props) {
  const titleId = useId();
  const messageId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    target: string | undefined;
    message: string;
  } | null>(null);
  // A different write target invalidates old feedback, not the form or its focus.
  if (feedback && feedback.target !== feedbackKey) setFeedback(null);
  useLayoutEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const invoker = document.activeElement;
    node.showModal();
    (node.querySelector<HTMLElement>("[data-initial-focus]") ?? node).focus();
    return () => {
      node.close();
      if (invoker instanceof HTMLElement && invoker.isConnected)
        invoker.focus();
      else fallback?.current?.focus();
    };
  }, [fallback]);

  const cancel = () => {
    if (!lock.current) close();
  };
  const showError = (message: string) =>
    setFeedback({ target: feedbackKey, message });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = event.currentTarget;
    const blank = [
      ...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        "input[required], textarea[required]",
      ),
    ].find((field) => !field.value.trim());
    if (blank) {
      showError(
        `Veuillez renseigner le champ « ${blank.labels?.[0]?.firstChild?.textContent?.trim() ?? ""} ».`,
      );
      blank.focus();
      return;
    }
    if (!form.reportValidity()) return;
    lock.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      await write();
    } catch (cause) {
      showError(
        cause instanceof HttpError && cause.status === 409 && conflict
          ? conflict
          : cause instanceof HttpError && cause.status === 404
            ? "Cet élément n’existe plus."
            : cause instanceof HttpError && cause.status === 422
              ? "Les données sont invalides. Vérifiez les champs."
              : `${failure} Veuillez réessayer.`,
      );
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <dialog
      className="write-dialog"
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={confirmation ? messageId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
      onKeyDown={(event) => dialogKeyboard(event, cancel)}
    >
      <div className="dialog-top">
        <h2 id={titleId}>{title}</h2>
        <IconButton
          icon="close"
          label="Fermer"
          blocked={busy}
          onClick={cancel}
        />
      </div>
      <form noValidate onSubmit={submit}>
        {fields?.(busy)}
        {confirmation && <p id={messageId}>{confirmation}</p>}
        {feedback && <p role="alert">{feedback.message}</p>}
        {busy && <p role="status">Opération en cours…</p>}
        <div className="dialog-actions">
          <button
            type="button"
            className="outline"
            data-initial-focus={confirmation ? true : undefined}
            aria-disabled={busy}
            onClick={cancel}
          >
            Annuler
          </button>
          <button type="submit" aria-disabled={busy}>
            {submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
