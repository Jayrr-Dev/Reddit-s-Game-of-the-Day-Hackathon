import skyEye from '../../../assets/terrain/boss/mikhael-citadel-storm-eye.webp';
import { useProgressiveImage } from '../../../hooks/useProgressiveImage';
import './mikhaelArenaMotion.css';

// --- ROTATING BACKGROUND ---
/** Paints only clouds so the original terrain can be composed separately. */
export function MikhaelStormSky() {
  const eye = useProgressiveImage(skyEye);
  return <div className="taxiarch-vortex-window" data-taxiarch-layer="storm-background" aria-hidden="true">
    <div className="taxiarch-vortex-perspective">
      <div className="taxiarch-vortex-disc" style={{ backgroundImage: 'url("' + eye.src + '")' }} />
    </div>
  </div>;
}

// --- DEPTH MARKERS ---
const WATCHERS = [[14, 16, .53], [23, 24, .37], [32, 15, .41], [68, 19, .39], [78, 23, .43], [88, 15, .52]] as const;

/** The Host hovers on either side. Only the Taxiarch's arena owns this layer. */
export function MikhaelArenaMotion() {
  return <div className="taxiarch-skies" aria-hidden="true">
    <div className="taxiarch-sky-rays" />
    <svg className="taxiarch-watch" viewBox="0 0 100 100" preserveAspectRatio="none">
      {WATCHERS.map(([x, y, scale], i) => <g key={x} transform={'translate(' + x + ' ' + y + ') scale(' + scale + ')'}>
        <g className="taxiarch-watch-float" style={{ animationDelay: -i * .73 + 's' }}>
          <path d="M0-2C-3-6-6-6-8-8c1.4 5.9 4.6 8.4 7.7 7l-.9 2 .9 3h.6l.9-3-.9-2C3.4.4 6.6-2.1 8-8 6-6 3-6 0-2Z" fill="currentColor" />
          <ellipse cy="-4" rx="1.4" ry=".65" fill="none" stroke="currentColor" strokeWidth=".28" />
        </g>
      </g>)}
    </svg>
    <div className="taxiarch-clouds" />
  </div>;
}
