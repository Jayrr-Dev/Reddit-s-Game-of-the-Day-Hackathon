import type { HeroId } from '../../shared/game/heroes.ts';

/** Metatron's recollections, not lines spoken by the angels. */
export const METATRON_ANGEL_LORE = {
  angelArcher: "The Biblical Angels have eyes enough to see suffering. Some even stop to mend it.",
  wingedArcher: "Heaven's archers used to blunt their arrows when they wagered. I see no reason they would do thee the courtesy.",
  angelMage: "An angel mage once stole back an hour for me. Heaven called that theft as well.",
  grandangelCerviel: "Cerviel carried a staff when he came to settle quarrels. The clever ones made peace before he set it down.",
  cervielSword: "Cerviel could stand watch in three places. He still took the coldest post himself.",
  cervielBow: "Cerviel took his bow to the farthest tower. He liked to hear the arrow land before he spoke.",
  grandangelCambiel: "Cambiel wore half a treasury. Yet I saw him trade a golden clasp for a minute more at a dying soldier's bed.",
  archangelZeruel: "Two suns at Zeruel's command, and not an ounce of warmth in him.",
  zeruelRedSun: "When Alpha drew near, the wax ran off the seals. The scribes learnt to stop writing.",
  zeruelBlueSun: "Omega is the blue one. Looked cold enough from afar. I would not set my hand upon it.",
  grandangelRaziel: "Raziel knew which shelf I emptied. Not a word did he speak. I wonder at that still.",
  grandangelGeonosis: "Geonosis never raised his voice. When the snow came down, everyone heard him well enough.",
  zadkielOfDominations: "Zadkiel called every decree mercy. I waited an age to hear him tell the two apart.",
  grandangelCherubiel: "Cherubiel kept his broken halo. I suppose he never cared what Heaven called beautiful.",
  lightLordMori: "Mori knew every knight by name. I have met archangels who cannot say the same.",
  apollyonSeraph: "Apollyon's trumpet was meant to call the host to prayer. It sounded much the same when he called them to war.",
  angelAssassin: "Heaven swears it sends no assassins. A tidy oath, when the witness never sees one.",
  archangelUriel: "Uriel held the Crimson Gate open until the last pilgrim crossed. I remember things like that.",
  zeruelArmored: "Zeruel had his white armour polished before every judgment. He cared a great deal how mercy looked.",
} as const satisfies Partial<Record<HeroId, string>>;
