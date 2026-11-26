// --- BATTLE CHARACTER SHEET ---
// The character sheet opened from the portrait mid-fight. It adds the
// same Profile and Inventory tabs the menu's Profile page has, so the
// sheet looks and works the same everywhere.
import { useContext, type ComponentProps } from 'react';
import type { CardId } from '../../../shared/game/cards';
import type { InventorySlot } from '../../../shared/game/inventory';
import { useSavedBag } from '../../hooks/useSavedBag';
import { PlayerName } from '../../lib/playerName';
import { InventoryPanel } from './inventory/InventoryPanel';
import { ProfileDeck, ProfileStrip } from './profileParts';
import { RunCharacterSheet } from './RunCharacterSheet';

type Props = Omit<ComponentProps<typeof RunCharacterSheet>, 'profile' | 'inventory'> & {
  /** The deck in this fight, listed on the Profile tab. */
  deck: readonly CardId[];
};

/** Run character sheet plus the Profile and Inventory tabs. */
export const BattleCharacterSheet = ({ deck, ...sheet }: Props) => {
  const username = useContext(PlayerName);
  const { items, discard, layout, setLayout, wins } = useSavedBag();
  const { character, onAction } = sheet;

  /** Jewelry is dropped from the character; consumables from the saved bag. */
  const trash = (stack: InventorySlot) => {
    if (stack.kind === 'jewelry') onAction({ type: 'discardItem', itemId: stack.id });
    else if (stack.kind === 'item') void discard(stack.id);
  };

  return (
    <RunCharacterSheet
      {...sheet}
      profile={
        <>
          <ProfileStrip username={username} wins={wins} />
          <ProfileDeck title="Deck in this fight" note="Every card you carry into this battle." cards={deck} />
        </>
      }
      inventory={
        <InventoryPanel
          owner={{ character, bag: items }}
          layout={layout}
          onLayout={setLayout}
          onTrash={trash}
        />
      }
    />
  );
};
