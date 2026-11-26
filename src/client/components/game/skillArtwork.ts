// --- SKILL ARTWORK ---
import type { SkillPick } from '../../../shared/game/skills';
import art000 from '../../assets/skills-generated/0-0-0.webp';
import art010 from '../../assets/skills-generated/0-1-0.webp';
import art011 from '../../assets/skills-generated/0-1-1.webp';
import art020 from '../../assets/skills-generated/0-2-0.webp';
import art021 from '../../assets/skills-generated/0-2-1.webp';
import art030 from '../../assets/skills-generated/0-3-0.webp';
import art031 from '../../assets/skills-generated/0-3-1.webp';
import art100 from '../../assets/skills-generated/1-0-0.webp';
import art110 from '../../assets/skills-generated/1-1-0.webp';
import art111 from '../../assets/skills-generated/1-1-1.webp';
import art120 from '../../assets/skills-generated/1-2-0.webp';
import art121 from '../../assets/skills-generated/1-2-1.webp';
import art130 from '../../assets/skills-generated/1-3-0.webp';
import art131 from '../../assets/skills-generated/1-3-1.webp';
import art200 from '../../assets/skills-generated/2-0-0.webp';
import art210 from '../../assets/skills-generated/2-1-0.webp';
import art211 from '../../assets/skills-generated/2-1-1.webp';
import art220 from '../../assets/skills-generated/2-2-0.webp';
import art221 from '../../assets/skills-generated/2-2-1.webp';
import art230 from '../../assets/skills-generated/2-3-0.webp';
import art231 from '../../assets/skills-generated/2-3-1.webp';
import art300 from '../../assets/skills-generated/3-0-0.webp';
import art310 from '../../assets/skills-generated/3-1-0.webp';
import art311 from '../../assets/skills-generated/3-1-1.webp';
import art320 from '../../assets/skills-generated/3-2-0.webp';
import art321 from '../../assets/skills-generated/3-2-1.webp';
import art330 from '../../assets/skills-generated/3-3-0.webp';
import art331 from '../../assets/skills-generated/3-3-1.webp';
import art400 from '../../assets/skills-generated/4-0-0.webp';
import art410 from '../../assets/skills-generated/4-1-0.webp';
import art411 from '../../assets/skills-generated/4-1-1.webp';
import art420 from '../../assets/skills-generated/4-2-0.webp';
import art421 from '../../assets/skills-generated/4-2-1.webp';
import art430 from '../../assets/skills-generated/4-3-0.webp';
import art431 from '../../assets/skills-generated/4-3-1.webp';

const artwork: Readonly<Partial<Record<string, string>>> = {
  '0-0-0': art000,
  '0-1-0': art010,
  '0-1-1': art011,
  '0-2-0': art020,
  '0-2-1': art021,
  '0-3-0': art030,
  '0-3-1': art031,
  '1-0-0': art100,
  '1-1-0': art110,
  '1-1-1': art111,
  '1-2-0': art120,
  '1-2-1': art121,
  '1-3-0': art130,
  '1-3-1': art131,
  '2-0-0': art200,
  '2-1-0': art210,
  '2-1-1': art211,
  '2-2-0': art220,
  '2-2-1': art221,
  '2-3-0': art230,
  '2-3-1': art231,
  '3-0-0': art300,
  '3-1-0': art310,
  '3-1-1': art311,
  '3-2-0': art320,
  '3-2-1': art321,
  '3-3-0': art330,
  '3-3-1': art331,
  '4-0-0': art400,
  '4-1-0': art410,
  '4-1-1': art411,
  '4-2-0': art420,
  '4-2-1': art421,
  '4-3-0': art430,
  '4-3-1': art431,
};

/** Gets the original artwork shared by each skill circle and its details. */
export const skillArtworkFor = ({ branch, tier, slot }: SkillPick) =>
  artwork[`${branch}-${tier}-${slot}`];

