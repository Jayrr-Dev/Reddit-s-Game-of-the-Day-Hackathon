// --- ANGEL MAGE FIGURE ---
import type { HeroMood } from '../../../content/heroLooks';

const IVORY = '#eee2cd';
const GOLD = '#d1aa51';
const MAUVE = '#b1a0b6';
const PURPLE = '#79658c';
const PLUM = '#473751';
const INK = '#35283b';

/** A long feather wing folds down behind the hooded caster. */
const Wing = () => (
  <>
    <polygon points="45,45 32,28 33,13 27,3 16,9 9,24 3,48 2,76 11,68 17,60 16,68 26,55 26,62 38,47" fill={IVORY} />
    <polygon points="45,45 32,28 33,13 27,3 24,21 17,42 11,68 17,60 16,68 26,55 26,62 38,47" fill={MAUVE} />
    <polygon points="29,20 33,29 41,42 32,48 26,56 27,46 19,52 25,36" fill={PURPLE} />
  </>
);

/** The shoulder wings, white hood, staff and visible clock sigil from the reference. */
export const AngelMage = ({ mood }: { mood: HeroMood }) => (
  <>
    <Wing />
    <g transform="translate(85 0) scale(-1 1)"><Wing /></g>
    <polygon points="30,49 43,44 56,49 66,85 58,94 27,94 20,85" fill={IVORY} />
    <polygon points="43,44 56,49 66,85 58,94 43,94" fill={MAUVE} />
    <polygon points="32,55 43,53 53,57 49,77 43,88 33,72" fill={PLUM} />
    <path d="M33 54 32 64 43 88 50 75" fill="none" stroke={GOLD} strokeWidth="1.3" />
    <polygon points="32,70 38,67 44,71 44,79 34,80" fill={INK} />
    <polygon points="35,72 41,70 42,78 35,78" fill={GOLD} />
    <polygon points="35,92 43,92 48,94 43,99 36,97" fill={INK} />
    <polygon points="30,42 41,47 55,42 61,50 52,57 41,52 28,53 24,49" fill={IVORY} />
    <path d="M25 49 41 54 60 49" fill="none" stroke={GOLD} strokeWidth="1.4" />
    <polygon points="33,31 39,21 48,23 54,32 53,45 43,48 33,44" fill={IVORY} />
    <polygon points="36,33 41,29 47,30 50,36 48,43 41,45 36,40" fill="#c39977" />
    <polygon points="36,33 35,44 32,48 33,36 38,29 43,24 49,28 52,35 52,45 49,48 48,36 46,32 41,28" fill={GOLD} />
    <path d={mood === 'fierce' ? 'M37 35 41 37 M45 37 49 35' : 'M37 36h4m3 0h4'} fill="none" stroke={INK} strokeWidth="1.15" />
    <polygon points="28,50 32,56 25,72 20,71 20,66" fill={MAUVE} />
    <path d="M13 85 24 66 29 57" fill="none" stroke={GOLD} strokeWidth="2.2" />
    <ellipse cx="12" cy="85" rx="4" ry="2.5" fill="none" stroke={GOLD} strokeWidth="1.1" />
    <polygon points="54,49 60,49 61,59 66,55 69,57 63,66 58,66" fill={MAUVE} />
    <g className="angel-mage-sigil">
      <circle cx="68" cy="51" r="9" fill={PLUM} stroke={GOLD} strokeWidth="1.3" />
      <circle cx="68" cy="51" r="6.4" fill="none" stroke={IVORY} strokeWidth=".7" />
      <path d="M68 46v5l4 2m-4-10v1m0 14v1m-8-8h1m14 0h1" fill="none" stroke={GOLD} strokeWidth="1.15" strokeLinecap="round" />
    </g>
  </>
);
