// ===================================================================
// CONFIRM DIALOG (ATOM)
// A small modal that asks one yes/no question. It opens as soon as it
// mounts (native <dialog> showModal, so focus and Escape come free) and
// the parent unmounts it to close. Escape and a backdrop tap both count
// as "no", so the player can never start something by accident.
// ===================================================================

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';

// --- STYLES ---
/** The shared look of every menu modal (Settings uses it too). */
export const MODAL_DIALOG_CLASSES =
  'fixed inset-0 m-auto max-h-[calc(100%-1.5rem)] w-[min(22rem,calc(100%-1.5rem))] overflow-y-auto overscroll-contain rounded-xl border border-accent/40 bg-surface p-0 text-ink shadow-lg backdrop:bg-black/65';

// --- TYPES ---
type ConfirmDialogProps = {
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// --- COMPONENT ---
/** Renders an open modal with a question and a confirm / cancel pair. */
export const ConfirmDialog = ({
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Open on mount; close on unmount so the top layer never keeps a ghost.
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className={MODAL_DIALOG_CLASSES}
      onCancel={event => { event.preventDefault(); onCancel(); }}
      onClick={event => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <div className="grid gap-3 p-4 text-center">
        <h2 id={titleId} className="font-display text-lg font-black uppercase tracking-wider text-accent">
          {title}
        </h2>
        {children && <div className="text-sm text-ink-muted">{children}</div>}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="menu" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant="menuPrimary" onClick={onConfirm} autoFocus>{confirmLabel}</Button>
        </div>
      </div>
    </dialog>
  );
};
