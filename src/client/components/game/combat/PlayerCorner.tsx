// ===================================================================
// PLAYER CORNER
// The bottom-left corner: the villain's hooded portrait inside a ring
// that drains with HP, with a skull warning before a lethal turn. Hits
// from the heroes shake the portrait, make the villain flinch and stack
// up above it; their marks land on the whole screen (see PovImpact),
// while gains and debuffs glow on the portrait (ImpactOverlay). The red
// eyes blink now and then.
// ===================================================================

import { useContext } from 'react';
import { PlayerName } from '../../../lib/playerName';
import type { Combatant } from '../../../../shared/game/types';
import type { PlayerHitPop } from '../../../hooks/useHitPops';
import { VILLAIN_ANCHOR_ATTR } from '../../../hooks/useCardDrag';
import { HitStack } from './HitNumbers';
import { HexAura } from './HexAura';
import { ScrambleScribble } from './ScrambleScribble';
import { ImpactOverlay } from './ImpactOverlay';
import { Glyph } from '../../ui/Glyph';

// --- COMPONENT ---
/** Renders the portrait and its lethal-turn warning. */
export const PlayerCorner = ({
  player,
  level,
  lethal,
  hits,
  onOpenCharacter,
  onTargetSelf,
  selfTargetLocked,
}: {
  player: Combatant;
  level: number;
  lethal: boolean;
  hits: readonly PlayerHitPop[];
  onOpenCharacter: () => void;
  onTargetSelf?: (() => void) | undefined;
  selfTargetLocked?: boolean;
}) => {
  const username = useContext(PlayerName);
  const degrees = Math.max(0, (player.hp / player.maxHp) * 360);
  const low = player.hp <= player.maxHp / 4;
  const warning = lethal ? 'Ending the turn now is lethal' : low ? 'Low health' : '';
  // Keyed on the newest hit, so the portrait shakes once per hit.
  const latestHitId = hits.findLast((hit) => hit.kind === 'hit')?.id ?? -1;
  return (
    <div className="relative shrink-0">
      <div
        className="relative size-14 shrink-0"
        {...{ [VILLAIN_ANCHOR_ATTR]: true }}
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
        {username && <span className="player-reddit-name" title={username}>u/{username}</span>}
        <span className="portrait-level">Lv {level}</span>
        {/* THE HEX SIGIL TURNS OVER YOU WHILE YOU ARE HEXED */}
        <HexAura hex={player.statuses.hex} />
        {player.statuses.scramble > 0 && <ScrambleScribble className="left-1/2 -top-[10%] w-[90%]" />}
        {/* HIT MARKS, ARROWS AND GLOWS OVER THE PORTRAIT */}
        <ImpactOverlay pops={hits.filter((hit) => hit.kind !== 'hit')} />
        <button
          type="button"
          className={`absolute inset-0 rounded-full ${onTargetSelf ? 'cursor-crosshair ring-2 ring-accent' : ''} ${selfTargetLocked ? 'shadow-[0_0_18px_var(--color-accent)]' : ''}`}
          onClick={onTargetSelf ?? onOpenCharacter}
          data-self-target={onTargetSelf ? (selfTargetLocked ? 'locked' : 'available') : undefined}
          title={onTargetSelf ? 'Play card on yourself' : 'Character sheet'}
          aria-label={onTargetSelf ? 'Play card on yourself' : `Open character sheet, health ${player.hp} of ${player.maxHp}, level ${level}${warning ? ', ' + warning : ''}`}
        />
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
      {lethal && <span className="player-lethal-badge pointer-events-none absolute -bottom-1 -right-2" aria-hidden="true">
        <Glyph name="skull" className="size-4" />
      </span>}
    </div>
  );
};
