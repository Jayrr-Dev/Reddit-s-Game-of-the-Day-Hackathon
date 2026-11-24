// --- MAGIC IMPACT ---
import { memo, useId } from 'react';
import type { MagicElement } from '../../../../shared/game/types';
import { ELEMENT_LOOK } from '../../../content/visuals';
import { seeded } from '../../../lib/seeded';

/** A contact flash opens into a broken wave and drifting fragments. */
export const MagicBurst = memo(function MagicBurst({
  id,
  element,
}: {
  id: number;
  element?: MagicElement | undefined;
}) {
  const halo = useId();
  const look = element ? ELEMENT_LOOK[element] : undefined;
  const energy = look?.energy ?? 'var(--color-magic)';
  const core = look?.core ?? '#effdff';
  const rotation = Math.round(seeded(id, 91) * 360);
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="magic-impact absolute inset-0 size-full overflow-visible"
    >
      <defs>
        <radialGradient id={halo}>
          <stop stopColor={core} />
          <stop offset=".28" stopColor={energy} stopOpacity=".85" />
          <stop offset="1" stopColor={energy} stopOpacity="0" />
        </radialGradient>
      </defs>
      <g transform={`rotate(${rotation} 50 50)`}>
        <g className="magic-contact">
          <circle cx="50" cy="50" r="30" fill={`url(#${halo})`} />
          <path
            fill={core}
            d="M49 26Q51 47 74 48Q55 51 52 69Q49 53 32 55Q47 51 49 26Z"
          />
        </g>
        <g className="magic-wave" fill={energy}>
          <path
            d={
              look?.burst === 'curls'
                ? 'M12 49Q14 17 46 13Q26 22 20 39Q28 35 34 37Q19 42 12 56ZM62 17Q94 25 88 59Q84 34 62 17ZM75 76Q52 99 24 78Q52 91 75 76Z'
                : 'M10 49A40 40 0 0 1 52 10Q23 16 10 49ZM65 14A40 40 0 0 1 88 62Q91 34 65 14ZM76 78A39 39 0 0 1 21 73Q48 93 76 78Z'
            }
          />
        </g>
        <g className="magic-fragments" fill={energy}>
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              transform={`rotate(${i * 72 + seeded(id, i) * 25} 50 50)`}
              d={i % 2 ? 'M49 18l2-7 1 5-2 4Z' : 'M47 21l3-13 2 7-3 8Z'}
            />
          ))}
        </g>
      </g>
    </svg>
  );
});
