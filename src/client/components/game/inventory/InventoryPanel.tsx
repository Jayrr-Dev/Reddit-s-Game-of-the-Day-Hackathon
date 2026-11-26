// ===================================================================
// INVENTORY PANEL
// An arrangeable RPG bag: a 4 x 4 backpack, a belt strip with a trash
// slot, and ring and amulet slots that only take matching jewelry.
// Tap a stack to select it, then tap where it should go (or drag it
// with a mouse). The details of the selected stack show alongside.
// ===================================================================
import { useState, type ReactNode } from 'react';
import { RING_SLOT_COUNT, ringSlotUnlocked } from '../../../../shared/game/character';
import { stackKey, type InventoryOwner, type InventorySlot } from '../../../../shared/game/inventory';
import type { BagArea } from '../../../../shared/game/bagLayout';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { Glyph } from '../../ui/Glyph';
import { JewelryIcon } from '../jewelry';
import { SlotShell, TrashSlot } from './BagSlots';
import { slotLook } from './slotLooks';
import { useBagActions, type BagHandlers, type EquipTarget } from './useBagActions';
import './inventory.css';

// --- TYPES ---
type Actions = ReturnType<typeof useBagActions>;
type PanelProps = BagHandlers & { owner: InventoryOwner };

// --- BAG AREA ---
/** One grid of bag cells (the backpack or the belt). */
const BagGrid = ({ area, actions, className, children }: {
  area: BagArea;
  actions: Actions;
  className: string;
  children?: ReactNode;
}) => (
  <div className={className}>
    {actions.bag[area].map((key, index) => {
      const stack = actions.stackOf(key);
      const cell = { kind: 'cell', cell: { area, index } } as const;
      return (
        <SlotShell
          key={index}
          stackKey={key}
          stack={stack}
          label={stack ? `${stack.name}, ${stack.quantity}` : `Empty ${area} slot ${index + 1}`}
          isSelected={!!key && key === (actions.selected && stackKey(actions.selected))}
          onTap={() => actions.tap(cell, key)}
          onDropKey={(dragged) => { const moving = actions.stackOf(dragged); if (moving) actions.drop(moving, cell); }}
        />
      );
    })}
    {children}
  </div>
);

// --- EQUIPMENT ---
/** The amulet and ring slots, each taking only its own kind of jewelry. */
const EquipColumn = ({ owner, actions }: { owner: InventoryOwner; actions: Actions }) => {
  const { rings, amulet } = owner.character.equipment;
  const targets: Array<EquipTarget & { id: string | null }> = [
    { slot: 'amulet', id: amulet },
    ...Array.from({ length: RING_SLOT_COUNT }, (_, ringIndex) => ({ slot: 'ring' as const, ringIndex, id: rings[ringIndex] ?? null })),
  ];
  return (
    <div className="inv-equip" aria-label="Equipment slots">
      {targets.map(({ id, ...target }) => {
        const key = id && `jewelry:${id}`;
        const stack = actions.stackOf(key);
        const isLocked = target.ringIndex !== undefined && target.ringIndex > 0 && !ringSlotUnlocked(owner.character, target.ringIndex);
        const name = target.slot === 'amulet' ? 'Amulet slot' : `Ring slot ${(target.ringIndex ?? 0) + 1}`;
        const drop = { kind: 'equip', target } as const;
        return (
          <SlotShell
            key={name}
            className={isLocked ? 'inv-locked' : ''}
            stackKey={key}
            stack={stack}
            label={`${name}, ${stack ? stack.name : isLocked ? 'locked' : 'empty'}`}
            isSelected={!!key && key === (actions.selected && stackKey(actions.selected))}
            placeholder={isLocked ? <Glyph name="padlock" className="inv-glyph" /> : <JewelryIcon slot={target.slot} />}
            onTap={() => actions.tap(drop, key)}
            onDropKey={(dragged) => { const moving = actions.stackOf(dragged); if (moving) actions.drop(moving, drop); }}
          />
        );
      })}
    </div>
  );
};

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
            <div className="inv-detail-body" inert={stack.kind === 'card'}>{look.details}</div>
          </>
        ) : (
          <p className="inv-subtitle">Tap an item, then tap where it goes. Drop it on a ring or amulet slot to wear it, or on the trash to destroy it.</p>
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
  return (
    <div className="inv-panel">
      <section className="cs-paper inv-bag" aria-label="Backpack">
        <h3>Backpack <span className="cs-inventory-count">{used}/{actions.bag.backpack.length}</span></h3>
        <div className="cs-compartment inv-layout">
          <BagGrid area="backpack" actions={actions} className="inv-backpack" />
          <EquipColumn owner={owner} actions={actions} />
          <BagGrid area="belt" actions={actions} className="inv-belt">
            <TrashSlot
              onTap={() => actions.tap({ kind: 'trash' }, null)}
              onDropKey={(dragged) => { const moving = actions.stackOf(dragged); if (moving) actions.drop(moving, { kind: 'trash' }); }}
            />
          </BagGrid>
          <div className="inv-actions">
            <button type="button" onClick={actions.sort}>Sort backpack</button>
            <button type="button" onClick={actions.clear}>Clear</button>
          </div>
        </div>
      </section>
      <InventoryDetails stack={actions.selected} notice={actions.notice} />
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
