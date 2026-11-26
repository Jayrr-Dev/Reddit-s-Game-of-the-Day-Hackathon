// ===================================================================
// BAG SLOTS
// The tappable squares of the Inventory: bag cells, equipment slots and
// the trash. Each is a drop target for a mouse drag too.
// ===================================================================
import type { DragEvent, ReactNode } from 'react';
import type { InventorySlot } from '../../../../shared/game/inventory';
import { Glyph } from '../../ui/Glyph';
import { slotLook } from './slotLooks';

// --- DRAG HELPERS ---
const DRAG_TYPE = 'text/plain';
/** Props that make an element a drop target for a dragged stack key. */
const dropProps = (onDropKey: (key: string) => void) => ({
  onDragOver: (event: DragEvent) => event.preventDefault(),
  onDrop: (event: DragEvent) => {
    event.preventDefault();
    const key = event.dataTransfer.getData(DRAG_TYPE);
    if (key) onDropKey(key);
  },
});
/** Props that let a filled slot be dragged with a mouse. */
const dragProps = (key: string | null) =>
  key ? { draggable: true, onDragStart: (event: DragEvent) => event.dataTransfer.setData(DRAG_TYPE, key) } : {};

// --- SHARED SHELL ---
type SlotShellProps = {
  stackKey: string | null;
  stack: InventorySlot | undefined;
  label: string;
  isSelected: boolean;
  /** Drawn when the slot is empty (an outline for equipment slots). */
  placeholder?: ReactNode;
  className?: string;
  onTap: () => void;
  onDropKey: (key: string) => void;
};

/** One square: the stack's picture under a button, with its quantity badge. */
export const SlotShell = ({ stackKey, stack, label, isSelected, placeholder, className = '', onTap, onDropKey }: SlotShellProps) => (
  <div className={`inv-cell ${className}`} data-kind={stack?.kind} data-empty={!stack} {...dropProps(onDropKey)} {...dragProps(stackKey)}>
    {/* The picture sits under the button so card faces (themselves buttons) never nest inside it. */}
    <div className="inv-art" inert aria-hidden="true">{stack ? slotLook(stack).icon : placeholder}</div>
    <button type="button" className="inv-slot" aria-pressed={isSelected} aria-label={label} onClick={onTap}>
      {stack && stack.quantity > 1 && <b className="inv-qty">{stack.quantity}</b>}
    </button>
  </div>
);

// --- TRASH ---
/** The trash square at the end of the belt. */
export const TrashSlot = ({ onTap, onDropKey }: { onTap: () => void; onDropKey: (key: string) => void }) => (
  <div className="inv-cell inv-trash" {...dropProps(onDropKey)}>
    <div className="inv-art" aria-hidden="true"><Glyph name="trash" className="inv-glyph" /></div>
    <button type="button" className="inv-slot" aria-label="Trash the selected item" onClick={onTap} />
  </div>
);
