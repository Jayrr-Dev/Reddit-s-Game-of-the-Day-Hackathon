import { useId, useRef, type ReactNode } from 'react';
import { IconButton } from '../../ui/IconButton';
import { Button } from '../../ui/Button';

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
      className="fixed inset-0 m-auto max-h-[calc(100%-1.5rem)] w-[min(22rem,calc(100%-1.5rem))] overflow-y-auto overscroll-contain rounded-xl border border-accent/40 bg-surface p-0 text-ink shadow-lg backdrop:bg-black/65"
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
