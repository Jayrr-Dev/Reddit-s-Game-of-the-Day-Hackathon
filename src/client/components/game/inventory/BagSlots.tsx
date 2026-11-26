// ===================================================================
// BAG SLOTS
// The tappable squares of the Inventory: bag cells, equipment slots and
// the trash. Each is a drop zone for a dragged stack (pointer drag, so
// it works on touch too), and a tap target as the fallback.
// ===================================================================
import type { PointerEvent, ReactNode } from 'react';
import type { InventorySlot } from '../../../../shared/game/inventory';
import { Glyph } from '../../ui/Glyph';
import { slotLook } from './slotLooks';
import { BAG_ZONE_ATTRIBUTE } from './useBagActions';

// --- SHARED SHELL ---
type SlotShellProps = {
  stack: InventorySlot | undefined;
  label: string;
  isSelected: boolean;
  /** Drawn when the slot is empty (an outline for equipment slots). */
  placeholder?: ReactNode;
  className?: string;
  /** This square's drop-zone name. */
  zone: string;
  /** True while a dragged stack hovers here. */
  isOver: boolean;
  onTap: () => void;
  /** Starts a drag from this square (only filled squares pass one). */
  onPress?: ((event: PointerEvent) => void) | undefined;
};

/** One square: the stack's picture under a button, with its quantity badge. */
export const SlotShell = ({ stack, label, isSelected, placeholder, className = '', zone, isOver, onTap, onPress }: SlotShellProps) => (
  <div className={`inv-cell ${className}`} data-kind={stack?.kind} data-empty={!stack} data-over={isOver}
    data-draggable={!!onPress} {...{ [BAG_ZONE_ATTRIBUTE]: zone }} onPointerDown={onPress}>
    <div className="inv-art" inert aria-hidden="true">{stack ? slotLook(stack).icon : placeholder}</div>
    <button type="button" className="inv-slot" aria-pressed={isSelected} aria-label={label} onClick={onTap}>
      {stack && stack.quantity > 1 && <b className="inv-qty">{stack.quantity}</b>}
    </button>
  </div>
);

// --- TRASH ---
/** The trash square at the end of the belt. */
export const TrashSlot = ({ isOver, onTap }: { isOver: boolean; onTap: () => void }) => (
  <div className="inv-cell inv-trash" data-over={isOver} {...{ [BAG_ZONE_ATTRIBUTE]: 'trash' }}>
    <div className="inv-art" aria-hidden="true"><Glyph name="trash" className="inv-glyph" /></div>
    <button type="button" className="inv-slot" aria-label="Trash the selected item" onClick={onTap} />
  </div>
);
