// ===================================================================
// USE EQUIP SOUNDS
// Plays the equip cue when a ring or amulet goes into a slot and the
// unequip cue when one comes out. Shared by the Equipment and Inventory
// tabs, so moves inside the backpack or belt stay silent.
// ===================================================================
import { useEffect, useRef } from 'react';
import type { Equipment } from '../../shared/game/character';
import { playSound } from '../lib/gameAudio';

/** Compares worn jewelry with the last render and plays the matching cue. */
export function useEquipSounds({ rings, amulet }: Equipment) {
  const previous = useRef({ rings, amulet });
  useEffect(() => {
    const before = previous.current;
    previous.current = { rings, amulet };
    if ((amulet && amulet !== before.amulet) || rings.some((id, i) => id && id !== before.rings[i])) {
      playSound('equip', 1, .84);
    } else if ((before.amulet && !amulet) || before.rings.some((id, i) => id && !rings[i])) {
      playSound('unequip', 1, .88);
    }
  }, [rings, amulet]);
}
