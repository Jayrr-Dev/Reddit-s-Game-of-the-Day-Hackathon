// --- WOLF PACK FIGURES ---
// Uses the standard 85 x 100 wide-unit frame and bottom foot anchor.
import type { HeroMood } from '../../../content/heroLooks';

const FUR = '#e5dbc7';
const SHADE = '#b9adc2';
const VIOLET = '#786284';
const DARK = '#4a3854';
const INK = '#30243a';
const GOLD = '#d1a654';

type WolfHeadProps = { mood: HeroMood };

/** Faceted muzzle, separate ear planes, and a readable amber eye line. */
const WolfHead = ({ mood }: WolfHeadProps) => (
  <>
    <polygon points="28,27 25,10 37,18 47,17 60,10 58,28 60,37 53,45 32,45 24,36" fill={FUR} />
    <polygon points="27,13 35,20 29,25" fill={VIOLET} />
    <polygon points="58,13 51,20 56,25" fill={VIOLET} />
    <polygon points="42,19 48,22 58,28 60,37 53,45 42,46" fill={SHADE} />
    <polygon points="28,31 40,32 36,36 30,35" fill={INK} />
    <polygon points="45,32 56,30 55,35 49,37" fill={INK} />
    {mood !== 'wince' && <>
      <polygon points="30,32 37,33 35,35" fill={GOLD} />
      <polygon points="48,33 54,32 50,35" fill={GOLD} />
    </>}
    <polygon points="37,35 48,35 53,43 48,50 38,50 32,44" fill={VIOLET} />
    <polygon points="38,39 47,39 44,44 41,44" fill={INK} />
    <polygon points={mood === 'fierce' ? '35,44 50,44 49,53 39,53' : '35,44 50,44 47,49 39,49'} fill={INK} />
    <polygon points="36,44 41,46 40,49" fill={FUR} />
    <polygon points="48,44 46,49 44,46" fill={FUR} />
  </>
);

/** Broad upright wolf, with a pale jagged ruff and two planted paws. */
export const IvoryWerewolf = ({ mood }: WolfHeadProps) => (
  <>
    <polygon points="26,66 42,66 39,86 34,91 34,97 18,97 19,90 24,85" fill={SHADE} />
    <polygon points="43,66 59,67 64,86 67,92 66,97 50,97 51,90 47,85" fill={VIOLET} />
    <polygon points="31,37 18,42 10,57 8,73 14,77 20,70 24,55 34,53" fill={FUR} />
    <polygon points="54,37 69,42 75,56 77,74 70,78 65,70 61,57 53,54" fill={SHADE} />
    <polygon points="29,46 55,46 62,61 56,76 46,85 29,78 21,61" fill={VIOLET} />
    <polygon points="26,34 33,38 42,42 52,37 64,38 69,46 62,45 63,55 55,51 53,64 45,58 41,68 33,59 27,62 27,54 17,56 21,45 17,47" fill={FUR} />
    <polygon points="42,42 52,37 64,38 69,46 62,45 63,55 55,51 53,64 45,58 41,68" fill={SHADE} />
    <polygon points="8,73 20,70 18,80 15,76 14,82 12,79 9,81" fill={INK} />
    <polygon points="65,70 77,74 75,81 72,78 71,83 69,78 66,80" fill={INK} />
    <WolfHead mood={mood} />
  </>
);

/** Wolf-taur: four legs, a swept tail, and the wolf head on a rising torso. */
export const WolfCentaur = ({ mood }: WolfHeadProps) => (
  <>
    <polygon points="45,61 53,64 51,82 47,89 50,94 39,94 39,88 44,80" fill={DARK} />
    <polygon points="69,62 76,59 75,81 71,90 74,96 64,96 64,88 69,78" fill={DARK} />
    <polygon points="70,57 79,61 84,68 81,80 75,85 79,74 73,69 67,69" fill={VIOLET} />
    <polygon points="19,51 32,52 47,59 61,56 73,58 79,66 73,77 64,80 38,76 23,78 14,68" fill={SHADE} />
    <polygon points="33,60 46,64 60,60 73,59 79,66 73,77 64,80 43,76" fill={VIOLET} />
    <polygon points="15,66 26,66 29,76 25,87 26,97 14,97 15,91 18,86" fill={FUR} />
    <polygon points="61,70 71,66 74,77 69,86 70,98 57,98 59,92 63,85" fill={SHADE} />
    <polygon points="24,32 38,32 46,43 43,60 36,70 20,66 15,55 17,42" fill={FUR} />
    <polygon points="30,32 38,32 46,43 43,60 36,70 28,64 33,53" fill={SHADE} />
    <polygon points="17,39 12,42 6,59 8,68 13,66 15,56 22,46" fill={SHADE} />
    <polygon points="38,39 46,40 53,53 51,63 46,66 44,62 45,54 37,48" fill={VIOLET} />
    <polygon points="13,54 16,55 14,59 10,58" fill={GOLD} />
    <polygon points="45,53 52,52 52,56 45,58" fill={GOLD} />
    <g transform="translate(-1 1) scale(.69)"><WolfHead mood={mood} /></g>
  </>
);
