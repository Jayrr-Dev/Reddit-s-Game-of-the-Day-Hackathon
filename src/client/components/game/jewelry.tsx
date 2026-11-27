// ===================================================================
// JEWELRY PRESENTATION
// Icons, flavor and effect copy for rings and amulets, shared by the
// Equipment and Inventory tabs of the character sheet.
// ===================================================================
import { shopAmuletBonus, shopAmuletSummary } from '../../../shared/game/amuletBonuses';
import { IRON_RING_RESERVE, TRAVELERS_AMULET_DRAW, type EquipmentSlot } from '../../../shared/game/character';
import { TRAINING_JEWELRY } from '../../../shared/game/trainingJewelry';
import { Glyph } from '../ui/Glyph';

// --- ICON ---
/** Ink silhouettes distinguish a band and a pendant at slot size. */
export const JewelryIcon = ({ slot }: { slot: EquipmentSlot }) => (
  <svg
    className="cs-jewelry"
    viewBox="0 0 40 40"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {slot === 'ring' ? (
      <>
        <path d="M13.4 13.6C7 17.2 5.2 25.3 9.2 31.1c4 6 12.8 6.2 18.3 1.3 5.9-5.2 6-13.5-.1-18.1" />
        <path d="M15.2 16.3c-5 3.4-5.8 9-3 13 3.1 4.6 9.2 4.5 13.3.9 4.3-3.7 4.2-9.7.3-13.4" />
        <path d="m12.2 10.2 3.6-4.4h8.4l3.6 4.4-7.8 8.4zM12.2 10.2h15.6m-7.8 8.4-3.4-8.4L20 5.8l3.4 4.4z" />
      </>
    ) : (
      <>
        <path d="M4.8 4.2c2.8 7.9 6.9 12.4 14.1 15.2m16.3-15.2c-2.9 8-7.1 12.5-14.1 15.2M6.6 4.4c3.1 6.6 6.9 10.8 12.5 13.3m14.3-13.3c-3.1 6.6-6.9 10.8-12.5 13.3" />
        <circle cx="20" cy="18.8" r="2" />
        <path d="m20 20.9 6.3 6.5-6.3 8.9-6.3-8.9zM20 23.6l3.5 4-3.5 5.2-3.5-5.2z" />
      </>
    )}
  </svg>
);

// --- EFFECT ---
/** Displays the same quantities applied by the combat engine. */
export const ItemEffect = ({ id }: { id: string }) => {
  if (id === 'iron-ring') return (
    <p className="cs-real-effect stat-ink" data-stat="energy"><Glyph name="bolt" /><strong>+{IRON_RING_RESERVE} Reserve Energy capacity.</strong></p>
  );
  if (id === 'travelers-amulet') return (
    <p className="cs-real-effect stat-ink" data-stat="draw"><Glyph name="cards" /><strong>Draw {TRAVELERS_AMULET_DRAW} extra {TRAVELERS_AMULET_DRAW === 1 ? 'card' : 'cards'} at the start of your turn.</strong></p>
  );
  const amulet = shopAmuletBonus(id);
  if (amulet) return <p className="cs-real-effect stat-ink" data-stat={amulet.draw ? 'draw' : 'energy'}><Glyph name={amulet.draw ? 'cards' : 'bolt'} /><strong>{shopAmuletSummary(id)}</strong></p>;
  if (TRAINING_JEWELRY.some(item => item.id === id)) return <p className="cs-real-effect"><strong>Training replica. Cosmetic only.</strong></p>;
  return null;
};
