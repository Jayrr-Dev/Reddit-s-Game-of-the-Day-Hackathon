import type { CSSProperties } from 'react';
import './poison-effect.css';

// --- DROPLETS ---
/**
 * [left %, bottom %, size px, sideways drift px, rise px]. Each drop
 * starts at its own height and rises its own distance, so the cloud
 * spreads over the body instead of lining up in one row.
 */
const DROPLETS = [
  [8, 14, 7, -23, 44], [18, 46, 11, 15, 30], [27, 24, 6, -9, 52], [35, 62, 9, 21, 26],
  [44, 9, 12, -17, 48], [52, 38, 7, 11, 40], [60, 70, 8, -12, 22], [67, 20, 13, 19, 50],
  [75, 52, 6, -21, 34], [83, 31, 10, 13, 46], [91, 58, 7, -15, 28], [14, 78, 6, 9, 20],
  [56, 4, 9, -6, 56], [88, 10, 8, 24, 42],
] as const;

export function PoisonEffect({ screen = false }: { screen?: boolean }) {
  return (
    <div className="poison-effect" data-poison-surface={screen ? 'screen' : 'body'} aria-hidden="true">
      <span className="poison-vignette" />
      <span className="poison-fumes">
        <span /><span /><span />
      </span>
      {DROPLETS.map(([x, y, size, drift, rise], index) => (
        <i key={x + '-' + y} className="poison-drop" style={{
          left: x + '%', '--drop-y': String(y), '--drop-size': size + 'px',
          '--poison-drift': drift + 'px', '--poison-rise': -rise + 'px',
          animationDelay: index * 34 + 'ms',
        } as CSSProperties} />
      ))}
    </div>
  );
}
