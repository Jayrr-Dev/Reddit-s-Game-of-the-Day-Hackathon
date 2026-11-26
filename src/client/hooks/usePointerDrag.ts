// --- POINTER DRAG AND DROP ---
// Pointer-event drag shared by the deck builder and the Inventory.
// HTML5 drag-and-drop never fires on touch screens, so this follows the
// pointer itself: a press only turns into a drag after it moves
// DRAG_START_PX, which keeps a plain tap free to act as the click path.
// Drop zones are marked with a data attribute whose value names them.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

// --- TYPES ---
export type PointerDrag<T> = { item: T; x: number; y: number; over: string | null };
type Press<T> = { item: T; x: number; y: number };

// --- CONSTANTS ---
const DRAG_START_PX = 6;

/** Finds the drop zone (the attribute's value) under a screen point, if any. */
const zoneAt = (attribute: string, x: number, y: number): string | null =>
  document.elementFromPoint(x, y)?.closest(`[${attribute}]`)?.getAttribute(attribute) ?? null;

/** Tracks one drag and reports the zone it was dropped on. */
export const usePointerDrag = <T>(
  zoneAttribute: string,
  onDrop: (item: T, zone: string | null) => void
) => {
  const [drag, setDrag] = useState<PointerDrag<T> | null>(null);
  const press = useRef<Press<T> | null>(null);
  const dragged = useRef(false);
  const dropRef = useRef(onDrop);
  // LATEST DROP HANDLER: the window listeners below are added once.
  useEffect(() => {
    dropRef.current = onDrop;
  }, [onDrop]);

  // POINTER DOWN: remember the press; the drag starts once it moves.
  const startPress = useCallback(
    (item: T) => (event: ReactPointerEvent) => {
      if (event.button !== 0) return;
      press.current = { item, x: event.clientX, y: event.clientY };
      dragged.current = false;
    },
    []
  );

  // WINDOW LISTENERS: follow the pointer, then drop or cancel.
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const start = press.current;
      if (!start) return;
      const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (!dragged.current && distance < DRAG_START_PX) return;
      dragged.current = true;
      const { clientX: x, clientY: y } = event;
      setDrag({ item: start.item, x, y, over: zoneAt(zoneAttribute, x, y) });
    };
    const end = (event: PointerEvent) => {
      const start = press.current;
      press.current = null;
      setDrag(null);
      if (start && dragged.current)
        dropRef.current(start.item, zoneAt(zoneAttribute, event.clientX, event.clientY));
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
  }, [zoneAttribute]);

  /** True once, right after a drag, so the release isn't also read as a tap. */
  const consumeDrag = useCallback(() => {
    const wasDrag = dragged.current;
    dragged.current = false;
    return wasDrag;
  }, []);

  return { drag, startPress, consumeDrag };
};
