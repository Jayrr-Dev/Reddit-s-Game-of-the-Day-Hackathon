// ===================================================================
// MODAL DIALOG (ATOM)
// The one shared modal shell. It opens as soon as it mounts (native
// <dialog> showModal, so focus and Escape come free) and the parent
// unmounts it to close. Escape and a backdrop tap both call onDismiss.
// The title (and any header) is pinned on top and the actions at the
// bottom; only the body between them scrolls when it runs long.
// ConfirmDialog and the tutorial guide are built on it.
// ===================================================================

import { useEffect, useId, useRef, type ReactNode } from 'react';

// --- STYLES ---
/** The shared look of every menu modal (Settings uses it too). */
export const MODAL_DIALOG_CLASSES =
  'fixed inset-0 m-auto max-h-[calc(100%-1.5rem)] w-[min(22rem,calc(100%-1.5rem))] overflow-y-auto overscroll-contain rounded-xl border border-accent/40 bg-surface p-0 text-ink shadow-lg backdrop:bg-black/65';

// --- TYPES ---
type ModalDialogProps = {
  title: string;
  /** Small text beside the title, such as "Step 1 of 4". */
  subtitle?: string | undefined;
  /** Pinned under the title, above the scrolling body (e.g. tabs). */
  header?: ReactNode;
  children?: ReactNode;
  /** The button row under the body. */
  actions: ReactNode;
  onDismiss: () => void;
  /** A wider sheet for reading lists (the Mechanics library). */
  isWide?: boolean;
};

// The standard and wide sheet widths (both keep a gutter on phones).
const WIDTH_CLASS = 'w-[min(22rem,calc(100%-1.5rem))]';
const WIDE_WIDTH_CLASS = 'w-[min(40rem,calc(100%-1.5rem))]';

// --- COMPONENT ---
/** Renders an open modal with a title, a body and a row of actions. */
export const ModalDialog = ({ title, subtitle, header, children, actions, onDismiss, isWide = false }: ModalDialogProps) => {
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
      className={(isWide ? MODAL_DIALOG_CLASSES.replace(WIDTH_CLASS, WIDE_WIDTH_CLASS) : MODAL_DIALOG_CLASSES) + ' open:flex open:flex-col'}
      onCancel={event => { event.preventDefault(); onDismiss(); }}
      onClick={event => { if (event.target === event.currentTarget) onDismiss(); }}
    >
      <header className="grid shrink-0 gap-3 px-4 pt-4 pb-3 text-center">
        <h2 id={titleId} className="font-display text-lg font-black uppercase tracking-wider text-accent">
          {title}
          {subtitle && <small className="ml-2 font-body text-xs font-normal normal-case tracking-normal text-ink-muted">{subtitle}</small>}
        </h2>
        {header && <div className="text-sm text-ink-muted">{header}</div>}
      </header>
      {children && (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 text-center text-sm text-ink-muted">
          {children}
        </div>
      )}
      <footer className="grid shrink-0 grid-cols-2 gap-2 px-4 pt-3 pb-4">{actions}</footer>
    </dialog>
  );
};
