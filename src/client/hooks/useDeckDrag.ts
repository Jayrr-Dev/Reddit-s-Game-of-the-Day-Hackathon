// --- DECK BUILDER DRAG AND DROP ---
// Pointer-event drag for the Create deck screen. HTML5 drag-and-drop
// never fires on touch screens, so this follows the pointer itself:
// a press only turns into a drag after it moves DRAG_START_PX, which
// keeps a plain tap free to act as the click/keyboard path.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CardId } from '../../shared/game/cards';

// --- TYPES ---
export type DeckZone = 'catalog' | 'deck';
export type DeckDrag = {
  id: CardId;
  from: DeckZone;
  x: number;
  y: number;
  over: DeckZone | null;
};
type Press = { id: CardId; from: DeckZone; x: number; y: number };

// --- CONSTANTS ---
const DRAG_START_PX = 6;
const ZONE_ATTRIBUTE = 'data-deck-zone';

/** Props that mark an element as a drop zone. */
export const deckZoneProps = (zone: DeckZone) => ({ [ZONE_ATTRIBUTE]: zone });

/** Finds the drop zone under a screen point, if any. */
const zoneAt = (x: number, y: number): DeckZone | null => {
  const zone = document
    .elementFromPoint(x, y)
    ?.closest(`[${ZONE_ATTRIBUTE}]`)
    ?.getAttribute(ZONE_ATTRIBUTE);
  return zone === 'catalog' || zone === 'deck' ? zone : null;
};

/** Tracks one card drag and reports the zone it was dropped on. */
export const useDeckDrag = (
  onDrop: (id: CardId, from: DeckZone, to: DeckZone | null) => void
) => {
  const [drag, setDrag] = useState<DeckDrag | null>(null);
  const press = useRef<Press | null>(null);
  const dragged = useRef(false);
  const dropRef = useRef(onDrop);
  // LATEST DROP HANDLER: the window listeners below are added once.
  useEffect(() => {
    dropRef.current = onDrop;
  }, [onDrop]);

  // POINTER DOWN: remember the press; the drag starts once it moves.
  const startPress = useCallback(
    (id: CardId, from: DeckZone) => (event: ReactPointerEvent) => {
      if (event.button !== 0) return;
      press.current = { id, from, x: event.clientX, y: event.clientY };
      dragged.current = false;
    },
    []
  );

  // WINDOW LISTENERS: follow the pointer, then drop or cancel.
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const start = press.current;
      if (!start) return;
      const distance = Math.hypot(
        event.clientX - start.x,
        event.clientY - start.y
      );
      if (!dragged.current && distance < DRAG_START_PX) return;
      dragged.current = true;
      const { clientX: x, clientY: y } = event;
      setDrag({ id: start.id, from: start.from, x, y, over: zoneAt(x, y) });
    };
    const end = (event: PointerEvent) => {
      const start = press.current;
      press.current = null;
      setDrag(null);
      if (start && dragged.current)
        dropRef.current(
          start.id,
          start.from,
          zoneAt(event.clientX, event.clientY)
        );
    };
    const cancel = () => {
      press.current = null;
      dragged.current = false;
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', cancel);
    };
  }, []);

  /** True once, right after a drag, so the release isn't also read as a tap. */
  const consumeDrag = useCallback(() => {
    const wasDrag = dragged.current;
    dragged.current = false;
    return wasDrag;
  }, []);

  return { drag, startPress, consumeDrag };
};
