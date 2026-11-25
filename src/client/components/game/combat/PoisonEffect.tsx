import type { CSSProperties } from 'react';
import './poison-effect.css';

const DROPLETS = [
  [9, 7, -23], [22, 13, 13], [30, 6, -7], [39, 10, 20], [51, 7, -18],
  [61, 13, 9], [72, 6, -9], [81, 10, 23], [91, 6, -13],
] as const;

export function PoisonEffect({ screen = false }: { screen?: boolean }) {
  return (
    <div className="poison-effect" data-poison-surface={screen ? 'screen' : 'body'} aria-hidden="true">
      <span className="poison-vignette" />
      <span className="poison-fumes">
        <span /><span /><span />
      </span>
      {DROPLETS.map(([x, size, drift], index) => (
        <i key={x} className="poison-drop" style={{
          left: x + '%', '--drop-size': size + 'px', '--poison-drift': drift + 'px',
          animationDelay: index * 34 + 'ms',
        } as CSSProperties} />
      ))}
    </div>
  );
}
