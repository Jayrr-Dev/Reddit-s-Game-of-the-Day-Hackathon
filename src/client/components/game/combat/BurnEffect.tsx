import type { CSSProperties } from 'react';
import './burn-effect.css';

const EMBERS = [[9,-13],[18,8],[31,-12],[42,16],[57,-23],[67,14],[80,-11],[92,16]] as const;

/** One heat and flame pulse, keyed by the damage tick that triggered it. */
export function BurnEffect({ screen = false }: { screen?: boolean }) {
  return (
    <div aria-hidden="true" className="burn-effect" data-burn-surface={screen ? 'screen' : 'body'}>
      <span className="burn-heat" />
      <span className="burn-bed">
        <span className="burn-sheet burn-sheet-left" />
        <span className="burn-sheet burn-sheet-middle" />
        <span className="burn-sheet burn-sheet-right" />
        {EMBERS.map(([left, drift], index) => (
          <i key={left} className="burn-ember" style={{
            left: left + '%', '--burn-drift': drift + 'px', animationDelay: index * 35 + 'ms',
          } as CSSProperties} />
        ))}
      </span>
    </div>
  );
}
