// ===================================================================
// ANGEL ARCHER FIGURE
// The Angel Host body (shared with the Angel Mage) holding a gold
// longbow out to the right with a nocked arrow of light.
// ===================================================================

import type { HeroMood } from '../../../content/heroLooks';
import { AngelHostBody } from './AngelMageFigure';

// --- COLOURS (THE ANGEL HOST PALETTE) ---
const GOLD = '#d1aa51';
const MAUVE = '#b1a0b6';
const PLUM = '#473751';
const HOLY_LIGHT = '#fff6d6';

// --- COMPONENT ---
/** The hooded angel drawing a gold bow, a quiver of light arrows at its hip. */
export const WingedArcher = ({ mood }: { mood: HeroMood }) => (
  <>
    {/* Quiver at the left hip, three arrows of light standing out of it. */}
    <polygon points="17,58 23,56 27,74 21,76" fill={PLUM} />
    <path d="M19 57 17 49 M21 56 21 47 M23 56 25 48" stroke={HOLY_LIGHT} strokeWidth=".9" strokeLinecap="round" />
    <AngelHostBody mood={mood} />
    {/* Bow arm reaching out to the grip. */}
    <polygon points="54,49 60,48 70,50 70,54 61,55 57,60" fill={MAUVE} />
    {/* The longbow, its string and the nocked arrow. */}
    <path d="M70 26 Q84 52 70 78" fill="none" stroke={GOLD} strokeWidth="2.2" strokeLinecap="round" />
    <path d="M70 26 L60 52 L70 78" fill="none" stroke={HOLY_LIGHT} strokeWidth=".6" />
    <path d="M60 52 H82" stroke={HOLY_LIGHT} strokeWidth="1" />
    <polygon points="82,50 86,52 82,54" fill={HOLY_LIGHT} />
  </>
);
