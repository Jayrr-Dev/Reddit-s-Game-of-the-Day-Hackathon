// ===================================================================
// INVENTORY PANEL
// The RPG bag on the character sheet: one slot grid per inventory
// section, quantity badges, and details for the tapped slot.
// ===================================================================
import { useId, useState } from 'react';
import {
  inventoryOf,
  itemCount,
  type InventoryOwner,
  type InventorySection,
  type InventorySlot,
} from '../../../../shared/game/inventory';
import { slotLook } from './slotLooks';
import './inventory.css';

// --- HELPERS ---
/** A slot's key is unique across sections, since a card and an item may share an id. */
const slotKey = (slot: InventorySlot) => `${slot.kind}:${slot.id}`;

/** Finds the slot to show first: the first filled slot of any section. */
const firstSlot = (sections: readonly InventorySection[]) =>
  sections.flatMap((section) => section.slots)[0];

// --- SLOT ---
/** One bag slot: the item's picture with a quantity badge, tapped to inspect. */
const InventorySlotButton = ({ slot, isSelected, detailId, onSelect }: {
  slot: InventorySlot;
  isSelected: boolean;
  detailId: string;
  onSelect: () => void;
}) => {
  const isEquipped = slot.kind === 'jewelry' && slot.equipped;
  return (
    <div className="inv-cell" data-kind={slot.kind}>
      {/* The picture sits under the button so card faces (themselves buttons) never nest inside it. */}
      <div className="inv-art" inert aria-hidden="true">{slotLook(slot).icon}</div>
      <button
        type="button"
        className="inv-slot"
        aria-pressed={isSelected}
        aria-controls={detailId}
        aria-label={`${slot.name}, ${slot.quantity}${isEquipped ? ', equipped' : ''}`}
        onClick={onSelect}
      >
        {slot.quantity > 1 && <b className="inv-qty">x{slot.quantity}</b>}
        {isEquipped && <b className="inv-worn" title="Equipped">E</b>}
      </button>
    </div>
  );
};

// --- SECTION ---
/** One labelled bag: filled slots first, then empty slots to complete the grid. */
const InventoryGrid = ({ section, selectedKey, detailId, onSelect }: {
  section: InventorySection;
  selectedKey: string | undefined;
  detailId: string;
  onSelect: (slot: InventorySlot) => void;
}) => (
  <section className="cs-paper inv-bag" aria-label={section.label}>
    <h3>
      {section.label} <span className="cs-inventory-count">{itemCount(section.slots)}</span>
    </h3>
    <div className="cs-compartment inv-grid">
      {section.slots.map((slot) => (
        <InventorySlotButton
          key={slotKey(slot)}
          slot={slot}
          isSelected={slotKey(slot) === selectedKey}
          detailId={detailId}
          onSelect={() => onSelect(slot)}
        />
      ))}
      {Array.from({ length: section.emptySlots }, (_, index) => (
        <div key={index} className="inv-cell inv-empty" aria-hidden="true" />
      ))}
    </div>
  </section>
);

// --- DETAILS ---
/** Name, kind and full description of the tapped slot. */
const InventoryDetails = ({ slot, detailId }: { slot: InventorySlot | undefined; detailId: string }) => {
  if (!slot) return <section id={detailId} className="cs-paper inv-details"><p className="cs-bag-empty">Your bag is empty.</p></section>;
  const look = slotLook(slot);
  return (
    <section id={detailId} className="cs-paper inv-details" aria-label="Item details" aria-live="polite">
      <h3>{slot.name}</h3>
      <div className="cs-compartment">
        <p className="inv-subtitle">{look.subtitle}</p>
        <div className="inv-detail-body" inert={slot.kind === 'card'}>{look.details}</div>
      </div>
    </section>
  );
};

// --- PANEL ---
/** Shows everything the player owns, read from their saved profile. */
export const InventoryPanel = ({ owner }: { owner: InventoryOwner }) => {
  const detailId = useId();
  const sections = inventoryOf(owner);
  const [selectedKey, setSelectedKey] = useState<string | undefined>();
  const slots = sections.flatMap((section) => section.slots);
  const selected = slots.find((slot) => slotKey(slot) === selectedKey) ?? firstSlot(sections);
  /** Selects a slot and brings its details into view (they sit below the bags on phones). */
  const select = (slot: InventorySlot) => {
    setSelectedKey(slotKey(slot));
    requestAnimationFrame(() => document.getElementById(detailId)?.scrollIntoView({ block: 'nearest' }));
  };
  return (
    <div className="inv-panel">
      <div className="inv-bags">
        {sections.map((section) => (
          <InventoryGrid
            key={section.id}
            section={section}
            selectedKey={selected && slotKey(selected)}
            detailId={detailId}
            onSelect={select}
          />
        ))}
      </div>
      <InventoryDetails slot={selected} detailId={detailId} />
    </div>
  );
};
