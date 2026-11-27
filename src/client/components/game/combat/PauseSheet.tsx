import type { ReactNode } from 'react';
import { Button } from '../../ui/Button';
import './pauseSheet.css';

type PauseProps = {
  where: string;
  score: number;
  scoreUnit: string;
  actions?: ReactNode;
  settings: ReactNode;
  onClose: () => void;
};

/** Keep run actions together and the settings gear in its own corner. */
export function PauseSheet({ where, score, scoreUnit, actions, settings, onClose }: PauseProps) {
  return <section role="dialog" aria-label="Paused" className="run-menu-panel pause-sheet absolute inset-0 z-40">
    <div className="pause-sheet-body">
      <header className="grid gap-1 text-center">
        <h2 className="font-display text-xl font-black uppercase tracking-widest text-accent">Paused</h2>
        <p className="text-sm text-ink">{where}</p>
        <p className="font-display text-2xl font-black text-accent">{score} {scoreUnit}</p>
      </header>
      <div className="pause-sheet-actions">
        {actions}
        <Button variant="menu" onClick={onClose}>Back</Button>
      </div>
    </div>
    <footer className="pause-sheet-settings">{settings}</footer>
  </section>;
}
