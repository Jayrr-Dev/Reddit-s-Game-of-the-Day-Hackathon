import { useId, useRef, type ReactNode } from 'react';
import { IconButton } from '../../ui/IconButton';
import { Button } from '../../ui/Button';
import { MODAL_DIALOG_CLASSES } from '../../ui/ConfirmDialog';

export function SettingsDialog({ children, className = '' }: { children: ReactNode; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return <>
    <IconButton
      icon="cog"
      label="Settings"
      aria-haspopup="dialog"
      className={className}
      onClick={() => dialog.current?.showModal()}
    />
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className={MODAL_DIALOG_CLASSES}
      onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}
    >
      <div className="grid gap-3 p-4">
        <h2 id={titleId} className="font-display text-lg font-black uppercase tracking-wider text-accent">Settings</h2>
        <div className="grid gap-2">{children}</div>
        <Button variant="menu" onClick={() => dialog.current?.close()}>Done</Button>
      </div>
    </dialog>
  </>;
}
