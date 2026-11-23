// ===================================================================
// BACKDROP
// The far parallax layers behind the heroes: sky, a distant keep, hills
// and the houses of the region. Each layer sets its own --depth, so the
// stage's camera moves far layers less than near ones. One hue per
// region tints the whole scene (see content/visuals.ts).
// ===================================================================

import { depthStyle } from '../../../lib/cssVars';

// --- TYPES ---
export type BackdropProps = { hue: number };

// --- COMPONENT ---
/** Draws the scene; it ignores taps so heroes stay easy to hit. */
export const Backdrop = ({ hue }: BackdropProps) => {
  const tone = (light: number, sat = 35) => `hsl(${hue} ${sat}% ${light}%)`;
  const layerClass =
    'parallax-layer pointer-events-none absolute -inset-x-8 inset-y-0';
  return (
    <>
      {/* SKY */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(${tone(24, 40)}, ${tone(14, 35)} 55%, ${tone(8, 30)})`,
        }}
      />
      {/* DISTANT KEEP (DEPTH 0.1) */}
      <svg
        className={layerClass}
        style={depthStyle(0.1)}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <path d="M40 46V32h3v-3l3 3h3v-8l3-3 3 3v8h5v14z" fill={tone(17, 30)} />
      </svg>
      {/* HILLS (DEPTH 0.25) */}
      <svg
        className={layerClass}
        style={depthStyle(0.25)}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <path d="M0 52q18-14 34-4t32-2 34 4v50H0z" fill={tone(14, 30)} />
      </svg>
      {/* HOUSES (DEPTH 0.45) */}
      <svg
        className={layerClass}
        style={depthStyle(0.45)}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <path
          d="M2 58V40l8-9 8 9v18zM82 58V38l8-9 9 9v20zM22 58V46l6-6 6 6v12zM66 58V46l6-6 6 6v12z"
          fill={tone(11, 30)}
        />
        <path
          d="M8 45h3v4H8zM89 44h3v4h-3z"
          fill="hsl(350 90% 55%)"
          opacity="0.8"
        />
        <path d="M0 58h100v42H0z" fill={tone(9, 35)} />
      </svg>
    </>
  );
};

/** Dark spikes at the screen edges, nearest of all (depth 1.5). */
export const Foreground = ({ hue }: BackdropProps) => (
  <svg
    className="parallax-layer pointer-events-none absolute -inset-x-8 inset-y-0 z-20"
    style={depthStyle(1.5)}
    viewBox="0 0 100 100"
    preserveAspectRatio="none"
  >
    <path
      d="M0 100V62l4-2 3 40zM100 100V58l-5 3-2 39z"
      fill={`hsl(${hue} 30% 4%)`}
    />
  </svg>
);
