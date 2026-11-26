import type { SkillPick } from '../../../shared/game/skills';
import { SKILL_ICONS } from '../../content/skillIcons';

// --- SIZING ---
// Callers draw the glyph in a 24-unit box; the artwork is 512 units wide.
const CALLER_BOX = 24;
const ART_BOX = 512;
// The art fills its box to the corners, so it is shrunk to sit inside the
// round node plate instead of poking through the rim.
const INSET = 0.8;
const SCALE = (CALLER_BOX * INSET) / ART_BOX;
const OFFSET = (CALLER_BOX * (1 - INSET)) / 2;

/** One skill's silhouette from the shared icon set, at node and popover sizes. */
export function SkillGlyph({ pick }: { pick: SkillPick }) {
  const icon = SKILL_ICONS[`${pick.branch}-${pick.tier}-${pick.slot}`];
  if (!icon) return null;
  return (
    <path
      className="cs-skill-glyph"
      transform={`translate(${OFFSET} ${OFFSET}) scale(${SCALE})`}
      d={icon.path}
      stroke="none"
      aria-hidden="true"
    />
  );
}
