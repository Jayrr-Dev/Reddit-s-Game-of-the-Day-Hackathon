// ===================================================================
// PLAYER CORNER
// The bottom-left corner: the villain's hooded portrait inside a ring
// that drains with HP, and the HP number on a shield beside it.
// ===================================================================

import type { Combatant } from '../../../../shared/game/types';

// --- COMPONENT ---
/** Renders the portrait and HP shield. */
export const PlayerCorner = ({ player }: { player: Combatant }) => {
  const degrees = Math.max(0, (player.hp / player.maxHp) * 360);
  return (
    <div
      className="relative size-14 shrink-0"
      aria-label={`Your health ${player.hp} of ${player.maxHp}`}
    >
      <div
        className="size-full rounded-full p-[3px] shadow-lg"
        style={{
          background: `conic-gradient(var(--color-hp) ${degrees}deg, var(--color-surface-sunken) 0)`,
        }}
      >
        <svg
          viewBox="0 0 40 40"
          className="size-full rounded-full bg-surface-raised"
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
          <circle cx="17" cy="18" r="1.4" className="fill-hp" />
          <circle cx="23" cy="18" r="1.4" className="fill-hp" />
        </svg>
      </div>
      <span className="absolute -bottom-1 -right-3 flex h-7 w-8 items-center justify-center bg-surface-raised pb-1 font-display text-sm font-black text-ink ring-1 ring-accent/70 [clip-path:polygon(0_0,100%_0,100%_60%,50%_100%,0_60%)]">
        {player.hp}
      </span>
    </div>
  );
};
