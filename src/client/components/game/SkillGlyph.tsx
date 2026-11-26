import type { SkillPick } from '../../../shared/game/skills';

// Angular silhouettes and one ochre facet per mark, drawn on a 24-unit grid.
// The order matches the seven circles in each branch (entry, then left/right).
const glyphs = [
  // Movement
  ['M15 3l3 1 1 3-2 3-3-1-1-3zM13 9l4 2 3-1 1 2-5 2-2-2-2 4 4 1 1 5-3 1-1-4-4-1-4 4H2l5-6 3-5-3 1-2 3-2-1 3-5 5-2z', 'M2 6h8L3 8H1zM1 17h4l-4 2z'], // Endurance
  ['M2 6l7 2 1-4 4 3 3-4 1 6 4 1-3 4 2 4-5-1-3 5-3-5-6 2 3-6z', 'M7 11l6 1 4-5-1 6 3 1-5 1-2 4-1-4z'], // Impact
  ['M6 11l5 1 2 4 6 2 3 2v2H4l-1-3zM2 9l1-6 3 4 4 2-4 2z', 'M4 19l5-2 5 2 6 1H4zM4 5l9 3-5 1z'], // Light Feet
  ['M3 5l9-3 9 3v7l-3 6-6 4-6-4-3-6z', 'M12 5l6 2v5l-2 4-4 3zM7 8l2-1v7l-2-2z'], // Tank
  ['M3 15l10-10 7 1 1 3-3 3-8 1-4 6H3zM9 17l5-4 5 3 1 4h-4l-2-3-3 3H7z', 'M3 10l6-4-4 5-4 1zM16 3h7l-3 2z'], // Skirmisher
  ['M12 2l-5 9h4l-2 4 9-6h-5l3-7zM5 14l3 2-3 6H1zM15 15l5-3-3 8-5 3z', 'M19 3h4l-4 4h-2zM3 10h3l-4 3H0z'], // Battle Rush
  ['M18 8l-2-4 7 2-1 7-2-2a8 8 0 1 1-9-8l1 3a5 5 0 1 0 6 2zM13 8l3 2v3l-3 2-3-2v-3z', 'M5 12l2 1 1 4 4 2-5-1z'], // Dodge Roll
  // Melee
  ['M9 3l3-2 3 2v9l5-2v4l-6 2v6h-4v-6l-6-2v-4l5 2z', 'M12 3l2 2v6h-2zM5 12l5 2-5-1z'], // Armory
  ['M14 2l8 6-4 5-3-2-9 11-4-3 10-11-3-2z', 'M14 3l6 5-2 2-6-5zM6 16l2 1-3 4-2-2z'], // Heavy Hands
  ['M21 2l-1 8-9 8-2-1-4 5-3-3 5-4-1-2 8-9z', 'M19 4l-2 6-7 5-1-1z'], // Keen Edge
  ['M3 4l8-2-2 6 2 3-4 4 3 5-5-4-2-5zM13 2l8 2v7l-3 7-6 4-2-5 4-5-2-4z', 'M15 5l3 1v5l-2 5-3 2 3-6-2-4z'], // Guard Break
  ['M20 2l-3 9-9 6 3-6zM22 9l-3 9-8 4 3-6zM12 3L9 9l-7 6 2-7z', 'M14 9l6-6-3 6zM11 21l7-5-1 2z'], // Flesh Wound
  ['M2 17l3 2L21 2l-2 8-8 8-6 4zM2 14l3-6 8-5-5 8z', 'M7 18l12-13-3 6zM16 19l6-5-1 5-6 4z'], // Overwhelm
  ['M23 5l-4 6-9 4-2-2-5 4-2-3 6-3-1-2 10-5z', 'M11 10l10-4-3 4-7 3zM4 20l9-5-4 4z'], // Lunge
  // Magic and Range
  ['M4 12l8-2 6 6-6 6-6-1zM8 10L6 4l3-2 2 3-1 1 2 3zM12 9l3-7 3 1v3l-2 1-1 4zM16 12l5-7 2 2-1 3-3 3z', 'M6 13l5-1 4 4-5 4z'], // Quiver
  ['M9 15l3 3-4 5-3-3zM13 3l4 3 5-1-2 5 2 4-5-1-4 4-1-5-4-2 5-2z', 'M14 8l3-2 2 2-1 4-3 1-2-3z'], // Battlemage
  ['M2 11h4l2-4 4-2V2h2v3l4 2 2 4h3v2h-3l-2 4-4 2v3h-2v-3l-4-2-2-4H2zM9 9v6l4 2 4-2V9l-4-2z', 'M13 9l3 3-3 3-3-3z'], // Sniper
  ['M12 1l6 8-6 12L6 9zM3 8l2 4-2 4-2-4zM21 8l2 4-2 4-2-4z', 'M12 4l4 5-4 7z'], // Arcane Focus
  ['M18 3l4 4-1 6-4 6-6 3-5-1 2-3 6-1 4-4 1-6zM3 5l10 6-2 3-10-6z', 'M3 2l8 3 3 6-5-2zM20 8l1 3-2 3z'], // Steady Aim
  ['M5 3l6 2-4 6 3 3-1 5-4-4-2-6zM13 5l5-2 3 6-3 7-6 5 1-6-2-4z', 'M2 19l11-10-2-3 12-4-5 12-3-2-12 9z'], // Spellpierce
  ['M17 2l6 1-1 6-2-2-8 8-2-2 8-8zM8 2l6 1-1 6-2-2-8 8-2-2 8-8zM17 11l6 1-1 6-2-2-7 7-2-2 7-7z', 'M6 19l3-3 2 1-3 3z'], // Volley
  // Utility and Buffs
  ['M8 2h8v3l-2 1v3l7 6v4l-3 3H6l-3-3v-4l7-6V6L8 5z', 'M6 16l5-2 7 2v3H6zM9 3h6v1H9z'], // Apothecary
  ['M3 16l9-9 9 9-2 3-7-6-7 6zM3 9l9-8 9 8-2 3-7-6-7 6z', 'M8 20l4-4 4 4-4 3z'], // Empower
  ['M12 5l5-3 5 3v6l-10 11L2 11V5l5-3z', 'M10 7h4v3h3v4h-3v3h-4v-3H7v-4h3z'], // Mender
  ['M10 2h5v3l-1 1v5l4 8-2 3H8l-2-3 4-8V6L9 5zM20 2l3 3-3 3-3-3z', 'M12 11l3 7-1 2h-4l-1-2z'], // Potency
  ['M7 3h10l2 4-4 3 6 5v5l-3 2H6l-3-2v-5l6-5-4-3z', 'M7 12h10l-5 3zM9 17l3-2 3 2-3 3z'], // Deep Pockets
  ['M5 2h14v3h-2v3l-3 4 3 4v3h2v3H5v-3h2v-3l3-4-3-4V5H5z', 'M9 17l3-3 3 3v2H9zM9 7h6l-3 3z'], // Everlasting
  ['M3 6h8l-1 7-3 3v3h3v2H2v-2h3v-3l-3-3zM14 5h8l-1 8-4 3v3h3v2h-8v-2h3v-3l-3-3z', 'M4 10h5l-2 4-2-1zM14 9h6l-2 4-3 1zM13 1l2 2-2 3-2-3z'], // Overflow
  // Afflictions
  ['M2 4l5-1 5 2 5-2 5 1v15l-5-1-5 3-5-3-5 1z', 'M4 7l3-1 4 2v9l-4-2-3 1zM17 7l3 4-3 4-3-4z'], // Grimoire
  ['M12 1l5 6 5 2-3 5 1 5-6-1-2 5-3-5-5 1 1-5-3-5 5-2z', 'M12 6l3 5-3 7-3-7z'], // Malediction
  ['M11 2l5 7 2 5-2 4-5 2-5-2-2-4 2-5zM21 13l2 4-2 3-2-3zM3 18l2 3-2 2-2-2z', 'M8 11l3-5-1 7-3 2z'], // Virulence
  ['M2 4h5l-1 7 4 3H4l-2-4zM8 5h5l-2 8-3-3zM14 7h5l-3 4-3 1zM21 11v6h-3l-6 5H6v-5l5-1 4-5z', 'M5 6h2l-1 4H4zM11 18l7-5v2l-6 5H8z'], // Debilitate
  ['M12 2l9 3v7l-3 6-6 4-6-4-3-6V5z', 'M12 5l4 7-1 3-3 2-3-2-1-3zM5 7l2-1v6l2 5-3-4z'], // Tolerance
  ['M12 1l9 5v12l-9 5-9-5V6zM12 4L6 8v8l6 4 6-4V8zM14 6l2 2-5 4h5l1 4-3 2h-5l-2-3 1-5z', 'M11 13l-1 2 2 1 2-1-1-2z'], // Sixfold Curse
  ['M5 6l7 7 7-7 3 2v5L12 23 2 13V8zM12 1l4 5-4 4-4-4z', 'M6 11l6 6 6-6 1 2-7 7-7-7z'], // Relentless
] as const;

/** One silhouette and one accent, reused at node and popover sizes. */
export function SkillGlyph({ pick }: { pick: SkillPick }) {
  const index = pick.branch * 7 + (pick.tier ? pick.tier * 2 - 1 + pick.slot : 0);
  const glyph = glyphs[index];
  if (!glyph) return null;
  return (
    <g className="cs-skill-glyph" fillRule="evenodd" stroke="none" aria-hidden="true">
      <path className="cs-glyph-body" d={glyph[0]} />
      <path className="cs-glyph-facet" d={glyph[1]} />
    </g>
  );
}
