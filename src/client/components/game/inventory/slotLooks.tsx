// ===================================================================
// INVENTORY SLOT LOOKS
// How each kind of inventory slot draws its icon and its details.
// Items from the shared item list draw themselves from their entry;
// only a brand-new slot kind needs a new case here.
// ===================================================================
import type { ReactNode } from 'react';
import type { InventorySlot } from '../../../../shared/game/inventory';
import { Glyph } from '../../ui/Glyph';
import { ItemEffect, JewelryIcon } from '../jewelry';
import { itemBonusSummary, itemFlavor } from '../jewelryCopy';

// --- TYPES ---
export type SlotLook = {
  /** Small picture inside the bag slot. */
  icon: ReactNode;
  /** One line under the name in the details panel. */
  subtitle: string;
  /** The full details shown when the slot is tapped. */
  details: ReactNode;
};

// --- LOOKUP ---
/** Builds the look for one slot; the switch keeps every slot kind covered. */
export const slotLook = (slot: InventorySlot): SlotLook => {
  switch (slot.kind) {
    case 'item':
      return {
        icon: (slot.id === 'metatrons-apple' || slot.id === 'realm-apple')
          ? <svg className="inv-glyph" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 13c-8-6-16 0-15 9 1 9 6 15 11 15 2 0 3-1 4-1s3 1 5 1c5 0 10-7 10-15 0-9-7-14-15-9Z" fill={slot.id === 'realm-apple' ? '#a4825a' : '#ca6363'}/><path d="M20 13Q18 5 24 3" fill="none" stroke="#977250" strokeWidth="2"/><path d="M21 10Q23 3 31 5Q29 12 21 10Z" fill="#9ca968"/><path d="M9 22q0-6 5-6" stroke="#f8bd9b" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
          : <Glyph name={slot.icon} className="inv-glyph" />,
        subtitle: `Consumable · ${slot.quantity} owned`,
        details: <p className="cs-item-lore">{slot.description}</p>,
      };
    case 'jewelry':
      return {
        icon: <JewelryIcon slot={slot.slot} />,
        subtitle: `${slot.slot === 'ring' ? 'Ring' : 'Amulet'} · ${itemBonusSummary(slot.id)}`,
        details: (
          <>
            <p className="cs-item-lore">{itemFlavor[slot.id]}</p>
            <ItemEffect id={slot.id} />
          </>
        ),
      };
  }
};
