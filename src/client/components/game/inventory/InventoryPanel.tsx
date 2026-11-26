// ===================================================================
// INVENTORY PANEL
// An arrangeable RPG bag: a 4 x 4 backpack and a belt strip with a
// trash slot. Wearing jewelry stays on the Equipment tab.
// Drag a stack where it should go (mouse or finger), or tap it and
// then tap the destination. The details of the selected stack show alongside.
// ===================================================================
import { useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { stackKey, type InventoryOwner, type InventorySlot } from '../../../../shared/game/inventory';
import type { BagArea } from '../../../../shared/game/bagLayout';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { SlotShell, TrashSlot } from './BagSlots';
import { slotLook } from './slotLooks';
import { usePointerDrag } from '../../../hooks/usePointerDrag';
import { BAG_ZONE_ATTRIBUTE, targetOf, useBagActions, zoneOf, type BagHandlers, type BagTarget } from './useBagActions';
import { BACKPACK_COLUMNS } from '../../../../shared/constants/game';
import './inventory.css';

// --- TYPES ---
type Actions = ReturnType<typeof useBagActions>;
/** Drag state and helpers every square needs. */
type Dnd = {
  overZone: string | null;
  /** Starts a drag of one stack. */
  pressFor: (key: string) => (event: PointerEvent) => void;
  /** Wraps a tap so the release that ends a drag isn't also a tap. */
  onTap: (tap: () => void) => () => void;
};
type PanelProps = BagHandlers & { owner: InventoryOwner };

// --- BAG AREA ---
/** One grid of bag cells (the backpack or the belt). */
const BagGrid = ({ area, actions, dnd, className, children }: {
  area: BagArea;
  actions: Actions;
  dnd: Dnd;
  className: string;
  children?: ReactNode;
}) => (
  <div className={className}>
    {actions.bag[area].map((key, index) => {
      const stack = actions.stackOf(key);
      const cell: BagTarget = { kind: 'cell', cell: { area, index } };
      return (
        <SlotShell
          key={index}
          zone={zoneOf(cell)}
          isOver={dnd.overZone === zoneOf(cell)}
          onPress={key ? dnd.pressFor(key) : undefined}
          stack={stack}
          label={stack ? `${stack.name}, ${stack.quantity}${stack.kind === 'jewelry' && stack.equipped ? ', equipped' : ''}` : `Empty ${area} slot ${index + 1}`}
          isSelected={!!key && key === (actions.selected && stackKey(actions.selected))}
          onTap={dnd.onTap(() => actions.tap(cell, key))}
        />
      );
    })}
    {children}
  </div>
);

// --- DETAILS ---
/** Name, kind and full description of the selected stack. */
const InventoryDetails = ({ stack, notice }: { stack: InventorySlot | undefined; notice: string }) => {
  const look = stack && slotLook(stack);
  return (
    <section className="cs-paper inv-details" aria-label="Item details" aria-live="polite">
      <h3>{stack ? stack.name : 'Inventory'}</h3>
      <div className="cs-compartment">
        {notice && <p className="inv-notice" role="status">{notice}</p>}
        {look ? (
          <>
            <p className="inv-subtitle">{look.subtitle}</p>
            <div className="inv-detail-body">{look.details}</div>
          </>
        ) : (
          <p className="inv-subtitle">Drag an item where it goes, or tap it and then tap the spot. Drop it on the trash to destroy it. Wear jewelry from the Equipment tab.</p>
        )}
      </div>
    </section>
  );
};

// --- PANEL ---
/** The whole Inventory tab, read from and saved to the player's profile. */
export const InventoryPanel = ({ owner, ...handlers }: PanelProps) => {
  const [trashing, setTrashing] = useState<InventorySlot | undefined>();
  const actions = useBagActions(owner, { ...handlers, onTrash: setTrashing });
  const used = actions.bag.backpack.filter((key) => key !== null).length;
  const { drag, startPress, consumeDrag } = usePointerDrag<string>(BAG_ZONE_ATTRIBUTE, (key, zone) => {
    const stack = actions.stackOf(key);
    const target = targetOf(zone);
    if (stack && target) actions.drop(stack, target);
  });
  const dnd: Dnd = {
    overZone: drag?.over ?? null,
    pressFor: startPress,
    onTap: (tap) => () => { if (!consumeDrag()) tap(); },
  };
  const dragged = drag && actions.stackOf(drag.item);
  /** Backpack rows plus the belt row; the CSS sizes squares so they all fit. */
  const bagRows = Math.ceil(actions.bag.backpack.length / BACKPACK_COLUMNS) + 1;
  return (
    <div className="inv-panel" style={{ '--inv-rows': bagRows } as CSSProperties}>
      <section className="cs-paper inv-bag" aria-label="Backpack">
        <h3>Backpack <span className="cs-inventory-count">{used}/{actions.bag.backpack.length}</span></h3>
        <div className="cs-compartment inv-layout">
          <BagGrid area="backpack" actions={actions} dnd={dnd} className="inv-backpack" />
          <BagGrid area="belt" actions={actions} dnd={dnd} className="inv-belt">
            <TrashSlot isOver={dnd.overZone === 'trash'} onTap={dnd.onTap(() => actions.tap({ kind: 'trash' }, null))} />
          </BagGrid>
          <div className="inv-actions">
            <button type="button" onClick={actions.sort}>Sort backpack</button>
            <button type="button" onClick={actions.clear}>Clear</button>
          </div>
        </div>
      </section>
      <InventoryDetails stack={actions.selected} notice={actions.notice} />
      {/* DRAG GHOST: the dragged stack's picture follows the pointer. */}
      {drag && dragged && (
        <div className="inv-cell inv-ghost" data-kind={dragged.kind} aria-hidden="true" style={{ left: drag.x, top: drag.y }}>
          <div className="inv-art" inert>{slotLook(dragged).icon}</div>
        </div>
      )}
      {trashing && (
        <ConfirmDialog
          title={`Trash ${trashing.name}?`}
          confirmLabel="Trash"
          cancelLabel="Keep"
          onCancel={() => setTrashing(undefined)}
          onConfirm={() => { handlers.onTrash(trashing); setTrashing(undefined); }}
        >
          {trashing.quantity > 1 ? `All ${trashing.quantity} are destroyed.` : 'It is destroyed.'} This can’t be undone.
        </ConfirmDialog>
      )}
    </div>
  );
};
