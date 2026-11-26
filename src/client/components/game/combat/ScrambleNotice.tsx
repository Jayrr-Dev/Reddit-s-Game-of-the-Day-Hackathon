// ===================================================================
// SCRAMBLE NOTICE
// When Scramble auto-plays one of your cards at the start of your turn
// (scrambledPlay in the combat state), a scribble and "Scrambled!"
// flash over the field first, naming the card, so the missing card
// never looks like a bug. Keyed by turn, so it plays once per turn.
// ===================================================================

import { getCard } from '../../../../shared/game/cards';
import type { CombatState } from '../../../../shared/game/types';
import { ScrambleScribble } from './ScrambleScribble';

// --- COMPONENT ---
/** Renders the notice for this turn's scrambled play, or nothing. */
export const ScrambleNotice = ({ combat }: { combat: CombatState }) => {
  const play = combat.scrambledPlay;
  if (!play || play.turn !== combat.turn) return null;
  return (
    <div key={play.turn} className="scramble-notice pointer-events-none absolute inset-x-0 top-[30%] z-30 grid justify-items-center gap-1" role="status">
      <div className="relative h-16 w-64">
        <ScrambleScribble className="left-1/2 top-0 w-full" />
      </div>
      <p className="font-display text-lg font-black uppercase tracking-wider text-hex">Scrambled!</p>
      <p className="text-sm text-ink">{getCard(play.cardId).name} played itself</p>
    </div>
  );
};
