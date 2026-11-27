// ===================================================================
// INVENTORY SLOT LOOKS
// How each kind of inventory slot draws its icon and its details.
// Items from the shared item list draw themselves from their entry;
// only a brand-new slot kind needs a new case here.
// ===================================================================
import type { ReactNode } from 'react';
import type { InventorySlot } from '../../../../shared/game/inventory';
import { isShopApple } from '../../../../shared/game/items';
import { ShopAppleIcon } from '../menu/ShopAppleIcon';
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
        icon: isShopApple(slot.id)
          ? <ShopAppleIcon item={slot.id} className="inv-glyph" />
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
