// ===================================================================
// PLAYER CORNER
// The bottom-left corner: the villain's hooded portrait inside a ring
// that drains with HP, and the HP number on a shield beside it. Hits
// from the heroes shake the portrait, make the villain flinch and stack
// up above it; their marks land on the whole screen (see PovImpact),
// while gains and debuffs glow on the portrait (ImpactOverlay). The red
// eyes blink now and then.
// ===================================================================

import type { Combatant } from '../../../../shared/game/types';
import type { PlayerHitPop } from '../../../hooks/useHitPops';
import { VILLAIN_ANCHOR_ATTR } from '../../../hooks/useCardDrag';
import { HitStack } from './HitNumbers';
import { HexAura } from './HexAura';
import { ImpactOverlay } from './ImpactOverlay';

// --- COMPONENT ---
/** Renders the portrait and HP shield. */
export const PlayerCorner = ({
  player,
  hits,
}: {
  player: Combatant;
  hits: readonly PlayerHitPop[];
}) => {
  const degrees = Math.max(0, (player.hp / player.maxHp) * 360);
  // Keyed on the newest hit, so the portrait shakes once per hit.
  const latestHitId = hits.findLast((hit) => hit.kind === 'hit')?.id ?? -1;
  return (
    // The HP badge sits in the row (tucked over the ring's edge by a
    // negative margin), so whatever follows starts after the badge,
    // however many digits it shows.
    <div className="flex shrink-0 items-end">
      <div
        className="relative size-14 shrink-0"
        {...{ [VILLAIN_ANCHOR_ATTR]: true }}
        aria-label={`Your health ${player.hp} of ${player.maxHp}`}
      >
        <div
          key={latestHitId}
          className={`size-full rounded-full p-[3px] shadow-lg ${latestHitId >= 0 ? 'animate-shake' : ''}`}
          style={{
            background: `conic-gradient(var(--color-hp) ${degrees}deg, var(--color-surface-sunken) 0)`,
          }}
        >
          <svg
            viewBox="0 0 40 40"
            className={`size-full origin-bottom rounded-full bg-surface-raised ${latestHitId >= 0 ? 'animate-flinch' : ''}`}
            aria-hidden="true"
          >
            <path
              d="M6 40c1-11 7-16 14-16s13 5 14 16z"
              className="fill-card-curse"
            />
            <path
              d="M11 20c0-9 4-15 9-15s9 6 9 15l-3 5H14z"
              className="fill-surface-sunken"
            />
            {/* EYES: blink now and then (see villain-blink) */}
            <g className="origin-center animate-villain-blink [transform-box:fill-box]">
              <circle cx="17" cy="18" r="1.4" className="fill-hp" />
              <circle cx="23" cy="18" r="1.4" className="fill-hp" />
            </g>
          </svg>
        </div>
        {/* THE HEX SIGIL TURNS OVER YOU WHILE YOU ARE HEXED */}
        <HexAura hex={player.statuses.hex} />
        {/* HIT MARKS, ARROWS AND GLOWS OVER THE PORTRAIT */}
        <ImpactOverlay pops={hits.filter((hit) => hit.kind !== 'hit')} />
        {/* GAINS PILE UP AT THE PORTRAIT'S TOP RIGHT, EACH FLOATING OFF
            LEFT, UP OR RIGHT AT RANDOM (hits pop on the screen, see
            PovImpact) */}
        <div className="pointer-events-none absolute bottom-[70%] left-[85%] z-40">
          <HitStack
            hits={hits.filter((hit) => hit.kind !== 'hit')}
            align="start"
            isDrifting
          />
        </div>
      </div>
      <span className="relative -mb-1 -ml-5 flex h-7 min-w-8 items-center justify-center px-1.5 bg-surface-raised pb-1 font-display text-sm font-black text-ink ring-1 ring-accent/70 [clip-path:polygon(0_0,100%_0,100%_60%,50%_100%,0_60%)]">
        <span className="num-center">{player.hp}</span>
      </span>
    </div>
  );
};
