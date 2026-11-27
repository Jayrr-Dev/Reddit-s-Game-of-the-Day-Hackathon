import { useState } from 'react';
import type { CardId } from '../../../shared/game/cards';
import { createCombatant } from '../../../shared/game/combatant';
import { Glyph } from '../ui/Glyph';
import { IconButton } from '../ui/IconButton';
import { PileDialog } from './combat/PileDialog';

const PREVIEW = createCombatant(66, 66);

/** Keep draft navigation outside the card list so it never takes a pick's space. */
export function EndlessDraftTools({ cards, level, busy, onExit, onProfile }: {
  cards: readonly CardId[]; level: number; busy: boolean; onExit: () => void; onProfile: () => void;
}) {
  const [deckOpen, setDeckOpen] = useState(false);
  return <>
    <nav className="endless-draft-tools" aria-label="Draft controls">
      <button type="button" disabled={busy} className="draft-tool" title="Exit to Endless menu" aria-label="Exit to Endless menu" onClick={onExit}>
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 21h7V3h-9v5m0 8v5m4-9H3m0 0 3-3m-3 3 3 3" />
        </svg>
      </button>
      <div className="flex items-center gap-1.5">
        <IconButton icon="cards" className="draft-tool disabled:opacity-45" label="View drafted deck" aria-haspopup="dialog"
          disabled={!cards.length || busy} onClick={() => setDeckOpen(true)} />
        <button type="button" className="draft-tool draft-profile" title="Profile" aria-label={'Profile, Level ' + level}
          disabled={busy} onClick={onProfile}><Glyph name="breastplate" className="size-4" /> Lv {level}</button>
      </div>
    </nav>
    {deckOpen && <PileDialog pile="deck" titleOverride="Drafted deck" cards={cards} attacker={PREVIEW}
      killsThisTurn={0} usesSpent={{}} onClose={() => setDeckOpen(false)} />}
  </>;
}
