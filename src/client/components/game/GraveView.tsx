// ===================================================================
// GRAVE VIEW
// Her grave: mourn to heal now, or swear vengeance for more max HP.
// ===================================================================

import {
  GRAVE_HEAL_FRACTION,
  GRAVE_VOW_MAX_HP,
  PLAYER_HP_CAP,
} from '../../../shared/game/rules';
import { healingAmount, type CharacterState } from '../../../shared/game/character';
import type { RunAction } from '../../../shared/game/run';
import { Glyph } from '../ui/Glyph';

export type GraveViewProps = {
  character: CharacterState;
  maxHp: number;
  onAction: (action: RunAction) => void;
};

/** Two choices, each described with its real numbers. */
export const GraveView = ({ maxHp, character, onAction }: GraveViewProps) => {
  const healAmount = healingAmount(Math.round(maxHp * GRAVE_HEAL_FRACTION), character);
  const vowGain = Math.min(GRAVE_VOW_MAX_HP, PLAYER_HP_CAP - maxHp);
  const choiceClass =
    'run-choice flex w-full flex-col items-start rounded-xl bg-surface-raised p-4 text-left ring-1 ring-edge hover:ring-accent';
  return (
    <div className="run-panel flex w-full max-w-sm flex-col items-center gap-3 animate-rise">
      <Glyph name="grave" className="size-12 text-guard" />
      <h2 className="font-display text-xl font-bold">Her Grave</h2>
      <p className="text-center text-sm italic text-ink-muted">
        The flowers you left are still here. So is the anger.
      </p>
      <button
        type="button"
        className={choiceClass}
        onClick={() => onAction({ type: 'graveChoice', choice: 'mourn' })}
      >
        <span className="font-display font-bold">Mourn</span>
        <span className="text-xs text-heal">Heal {healAmount} HP.</span>
      </button>
      <button
        type="button"
        className={choiceClass}
        disabled={vowGain === 0}
          onClick={() => onAction({ type: 'graveChoice', choice: 'vow' })}
      >
        <span className="font-display font-bold">Swear vengeance</span>
        <span className="text-xs text-wrath">{vowGain ? `+${vowGain} max HP.` : "Max HP reached."}</span>
      </button>
    </div>
  );
};
