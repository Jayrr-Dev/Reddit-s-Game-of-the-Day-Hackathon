import { useId, useRef, type ReactNode } from 'react';
import { Glyph } from '../../ui/Glyph';
import { Button } from '../../ui/Button';

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
