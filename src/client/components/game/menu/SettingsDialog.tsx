import { useId, useRef, type ReactNode } from 'react';
import { Glyph } from '../../ui/Glyph';
import { Button } from '../../ui/Button';
import { MODAL_DIALOG_CLASSES } from '../../ui/ConfirmDialog';

export function SettingsDialog({ children, className = '' }: { children: ReactNode; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return <>
    <button
      type="button"
      className={'grid size-10 place-items-center rounded-full border border-accent/35 bg-surface-sunken/85 text-accent hover:border-accent focus-visible:outline-2 focus-visible:outline-accent ' + className}
      aria-label="Settings"
      aria-haspopup="dialog"
      title="Settings"
      onClick={() => dialog.current?.showModal()}
    >
      <Glyph name="cog" className="size-5" />
    </button>
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
