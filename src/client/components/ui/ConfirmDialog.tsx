// ===================================================================
// CONFIRM DIALOG (ATOM)
// A small modal that asks one yes/no question, built on ModalDialog.
// Escape and a backdrop tap both count as "no", so the player can never
// start something by accident. An optional header (e.g. tabs) stays
// pinned under the title while the content scrolls.
// ===================================================================

import type { ReactNode } from 'react';
import { Button } from './Button';
import { ModalDialog } from './ModalDialog';

// --- TYPES ---
type ConfirmDialogProps = {
  title: string;
  /** Pinned under the title, above the scrolling content (e.g. tabs). */
  header?: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** Greys out the confirm button (e.g. the player can't afford it). */
  isConfirmDisabled?: boolean;
  /** Widens to keep short content and both button labels on one line. */
  fitsContent?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// --- COMPONENT ---
/** Renders an open modal with a question and a confirm / cancel pair. */
export const ConfirmDialog = ({
  title,
  header,
  children,
  confirmLabel,
  cancelLabel,
  isConfirmDisabled = false,
  fitsContent = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => (
  <ModalDialog
    title={title}
    header={header}
    onDismiss={onCancel}
    fitsContent={fitsContent}
    actions={<>
      <Button variant="menu" className="whitespace-nowrap" onClick={onCancel}>{cancelLabel}</Button>
      <Button variant="menuPrimary" className="whitespace-nowrap" onClick={onConfirm} disabled={isConfirmDisabled} autoFocus>{confirmLabel}</Button>
    </>}
  >
    {children}
  </ModalDialog>
);
