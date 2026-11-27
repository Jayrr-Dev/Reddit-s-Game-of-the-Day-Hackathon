import { useState } from 'react';
import type { CardId } from '../../../shared/game/cards';
import { createCombatant } from '../../../shared/game/combatant';
import { Glyph } from '../ui/Glyph';
import { IconButton } from '../ui/IconButton';
import { MenuBackButton } from '../ui/MenuBackButton';
import { PileDialog } from './combat/PileDialog';

const PREVIEW = createCombatant(66, 66);

/** Keep draft navigation outside the card list so it never takes a pick's space. */
export function EndlessDraftTools({ cards, level, busy, onExit, onProfile }: {
  cards: readonly CardId[]; level: number; busy: boolean; onExit: () => void; onProfile: () => void;
}) {
  const [deckOpen, setDeckOpen] = useState(false);
  return <>
    <div className="endless-draft-chrome absolute z-10 pointer-events-none">
      <MenuBackButton className="pointer-events-auto" label="Back to Endless menu" disabled={busy} onClick={onExit} />
      <nav className="absolute right-3 top-3 flex items-center gap-1.5" aria-label="Draft controls">
        <IconButton icon="cards" className="draft-tool disabled:opacity-45" label="View drafted deck" aria-haspopup="dialog"
          disabled={!cards.length || busy} onClick={() => setDeckOpen(true)} />
        <button type="button" className="draft-tool draft-profile" title="Profile" aria-label={'Profile, Level ' + level}
          disabled={busy} onClick={onProfile}><Glyph name="breastplate" className="size-4" /> Lv {level}</button>
      </nav>
    </div>
    {deckOpen && <PileDialog pile="deck" titleOverride="Drafted deck" cards={cards} attacker={PREVIEW}
      killsThisTurn={0} usesSpent={{}} onClose={() => setDeckOpen(false)} />}
  </>;
}
