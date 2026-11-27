// --- ILLUSION TRAINING JEWELRY ---
import type { CharacterState, EquipmentSlot } from './character.ts';

type TrainingItem = { id: string; name: string; slot: EquipmentSlot; flavor: string };
export const TRAINING_JEWELRY: readonly TrainingItem[] = [
  { id: 'cinder-band', name: 'Cinder Band', slot: 'ring', flavor: 'Found in the ruined city. The copper survived, but the name inside was worn away.' },
  { id: 'tideglass-ring', name: 'Tideglass Ring', slot: 'ring', flavor: 'A bubble hangs motionless in its sea-glass setting.' },
  { id: 'rook-signet', name: 'Rook Signet', slot: 'ring', flavor: 'Its square face leaves a tower in sealing wax.' },
  { id: 'briar-knot', name: 'Briar Knot', slot: 'ring', flavor: 'The silversmith folded each thorn back against the band.' },
  { id: 'quarry-ring', name: 'Quarry Ring', slot: 'ring', flavor: 'A mason cut this band from a single piece of slate.' },
  { id: 'moonstone-loop', name: 'Moonstone Loop', slot: 'ring', flavor: 'The pale stone has a narrow blue seam.' },
  { id: 'bellfounder-band', name: "Bellfounder’s Band", slot: 'ring', flavor: "Cast from the west bell. The founder swore it cracked on the Seer's last word." },
  { id: 'ashwood-ring', name: 'Ashwood Ring', slot: 'ring', flavor: 'Seven growth rings cross the polished wood.' },
  { id: 'gatewarden-seal', name: 'Gatewarden’s Seal', slot: 'ring', flavor: "No lock in the king's keep takes the key engraved inside." },
  { id: 'gilt-serpent', name: 'Gilt Serpent', slot: 'ring', flavor: 'Two ruby chips mark the eyes of a coiled snake.' },
  { id: 'ferryman-token', name: 'Ferryman’s Token', slot: 'amulet', flavor: 'A river toll coin on a tarred cord. The ferryman says he has taken it from the same man more than once.' },
  { id: 'vesper-locket', name: 'Vesper Locket', slot: 'amulet', flavor: 'Inside the clasp is a pressed violet.' },
  { id: 'compass-pendant', name: 'Broken Compass', slot: 'amulet', flavor: 'The needle still points toward the western mines.' },
  { id: 'opal-tear', name: 'Opal Tear', slot: 'amulet', flavor: 'A copper wire holds the cracked stone together.' },
  { id: 'ivory-key', name: 'Ivory Key', slot: 'amulet', flavor: 'No lock in the castle fits its three teeth.' },
  { id: 'last-lantern', name: 'Last Lantern', slot: 'amulet', flavor: 'A grain of amber sits behind four tiny panes.' },
];

/** Add missing replicas to both fresh and previously saved training inventories. */
export function stockTrainingInventory(character: CharacterState) {
  const owned = new Set(character.inventory.map(item => item.id));
  const missing = TRAINING_JEWELRY.filter(item => !owned.has(item.id));
  return [...character.inventory, ...missing.map(({ id, name, slot }) => ({ id, name, slot }))];
}
