// ===================================================================
// CONFIRM DIALOG (ATOM)
// A small modal that asks one yes/no question, built on ModalDialog.
// Escape and a backdrop tap both count as "no", so the player can never
// start something by accident.
// ===================================================================

import type { ReactNode } from 'react';
import { Button } from './Button';
import { ModalDialog } from './ModalDialog';

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
}: ConfirmDialogProps) => (
  <ModalDialog
    title={title}
    onDismiss={onCancel}
    actions={<>
      <Button variant="menu" onClick={onCancel}>{cancelLabel}</Button>
      <Button variant="menuPrimary" onClick={onConfirm} autoFocus>{confirmLabel}</Button>
    </>}
  >
    {children}
  </ModalDialog>
);
