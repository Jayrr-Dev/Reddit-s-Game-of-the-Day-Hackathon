// --- DECK BUILDER DRAG AND DROP ---
// The Create deck screen's drag: the shared pointer drag (usePointerDrag)
// with the catalog and the deck as its two drop zones.
import { useCallback } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CardId } from '../../shared/game/cards';
import { usePointerDrag } from './usePointerDrag';

// --- TYPES ---
export type DeckZone = 'catalog' | 'deck';
export type DeckDrag = { id: CardId; from: DeckZone; x: number; y: number; over: DeckZone | null };
type DeckItem = { id: CardId; from: DeckZone };

// --- CONSTANTS ---
const ZONE_ATTRIBUTE = 'data-deck-zone';

/** Props that mark an element as a drop zone. */
export const deckZoneProps = (zone: DeckZone) => ({ [ZONE_ATTRIBUTE]: zone });

/** Narrows a zone attribute value to a deck zone. */
const asDeckZone = (zone: string | null): DeckZone | null =>
  zone === 'catalog' || zone === 'deck' ? zone : null;

/** Tracks one card drag and reports the zone it was dropped on. */
export const useDeckDrag = (
  onDrop: (id: CardId, from: DeckZone, to: DeckZone | null) => void
) => {
  const { drag, startPress: pressItem, consumeDrag } = usePointerDrag<DeckItem>(
    ZONE_ATTRIBUTE,
    (item, zone) => onDrop(item.id, item.from, asDeckZone(zone))
  );
  const startPress = useCallback(
    (id: CardId, from: DeckZone): ((event: ReactPointerEvent) => void) => pressItem({ id, from }),
    [pressItem]
  );
  const deckDrag: DeckDrag | null = drag && { ...drag.item, x: drag.x, y: drag.y, over: asDeckZone(drag.over) };
  return { drag: deckDrag, startPress, consumeDrag };
};
