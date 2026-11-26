// ===================================================================
// ASSET CATALOG
// What the admin-only Assets tab shows: every combat effect (built from
// the same pops ImpactOverlay draws in a fight, so the preview is the
// real effect) and the effect / icon image files. Character and unit
// sprites (heroes, npcs, boss bodies) and map backdrops are left out on
// purpose: the Units and Map tabs already show those.
// ===================================================================

import { STATUS_FX, type FxKind } from './statusFx';
import { keyLabel } from '../lib/keyLabel';
import { IMAGE_PLACEHOLDERS } from '../lib/imagePlaceholders.generated';
import type { PlayerHitPop } from '../hooks/useHitPops';
import { SKILL_ICONS } from './skillIcons';
import { SKILL_EFFECTS } from '../../shared/game/skills';

// --- TYPES ---
/** One effect: its name and the pop that makes ImpactOverlay draw it. */
export type EffectAsset = { name: string; pop: PlayerHitPop };

/** One image file: a readable name, its folder and its built URL. */
export type ImageAsset = {
  name: string;
  group: string;
  url: string;
  /** Set for a sprite strip: its frame count and one frame's width / height. */
  strip?: { frames: number; frameAspect: number } | undefined;
};

// --- EFFECTS ---
/** A pop of the given shape; amount equals typical, so it draws at normal size. */
const pop = (hit: Partial<PlayerHitPop> & Pick<PlayerHitPop, 'kind'>): PlayerHitPop => ({
  amount: 10,
  blocked: 0,
  typical: 10,
  id: 1,
  ...hit,
});

/** The hit marks, one per attack look (ImpactOverlay's HitMark branches). */
const HIT_EFFECTS: readonly EffectAsset[] = [
  { name: 'Melee slash', pop: pop({ kind: 'hit', source: 'melee', edge: 'sharp' }) },
  { name: 'Blunt thud', pop: pop({ kind: 'hit', source: 'melee', edge: 'blunt' }) },
  { name: 'Arrow hole', pop: pop({ kind: 'hit', source: 'range' }) },
  { name: 'Magic burst (arcane)', pop: pop({ kind: 'hit', source: 'magic' }) },
  { name: 'Magic burst (fire)', pop: pop({ kind: 'hit', source: 'magic', element: 'fire' }) },
  { name: 'Magic burst (ice)', pop: pop({ kind: 'hit', source: 'magic', element: 'ice' }) },
  { name: 'Magic burst (lightning)', pop: pop({ kind: 'hit', source: 'magic', element: 'lightning' }) },
  { name: 'Curse glow', pop: pop({ kind: 'hit', source: 'curse' }) },
  { name: 'Hex tick (sigil)', pop: pop({ kind: 'hit', tick: 'hex' }) },
  { name: 'Burn', pop: pop({ kind: 'hit', tick: 'burn' }) },
  { name: 'Poison', pop: pop({ kind: 'poison' }) },
  { name: 'Bleed bite', pop: pop({ kind: 'bleedBite' }) },
];

/** Kinds that draw nothing, or are already listed above with a better name. */
const SKIPPED_STATUS_KINDS: ReadonlySet<FxKind> = new Set(['miss', 'dodge', 'burn', 'poison', 'bleedBite']);

/** Every status effect in STATUS_FX, so a new status shows up on its own. */
const STATUS_EFFECTS: readonly EffectAsset[] = Object.keys(STATUS_FX)
  .filter((kind): kind is FxKind => kind in STATUS_FX)
  .filter((kind) => !SKIPPED_STATUS_KINDS.has(kind))
  .map((kind) => ({ name: keyLabel(kind), pop: pop({ kind }) }));

export const EFFECT_ASSETS: readonly EffectAsset[] = [...HIT_EFFECTS, ...STATUS_EFFECTS];

// --- IMAGES ---
/** Effect and icon image files (no sprites, no map backdrops). */
const IMAGE_URLS = import.meta.glob<string>(
  [
    '../assets/*.{webp,png,svg}',
    '../assets/table/*.{webp,png,svg}',
    '../assets/cerviel/phase-two-seal.webp',
  ],
  { eager: true, query: '?url', import: 'default' },
);

/** Sprite strips (frames side by side), so the viewer plays them instead of showing the sheet. */
const SPRITE_STRIP_FRAMES: Readonly<Record<string, number>> = { 'burn-fire-strip': 16 };

/** A strip's frame count and frame shape, from its stem and the placeholder sizes. */
const stripOf = (stem: string): ImageAsset['strip'] => {
  const frames = SPRITE_STRIP_FRAMES[stem];
  const size = IMAGE_PLACEHOLDERS[stem];
  return frames && size ? { frames, frameAspect: size.width / frames / size.height } : undefined;
};

/** "../assets/table/back-step.webp" becomes { group: "Table", name: "Back step" }. */
const toImageAsset = ([path, url]: [string, string]): ImageAsset => {
  const parts = path.replace('../assets/', '').split('/');
  const stem = (parts.pop() ?? path).replace(/\.\w+$/, '');
  return {
    name: keyLabel(stem),
    group: keyLabel(parts[0] ?? 'effects'),
    url,
    strip: stripOf(stem),
  };
};

// --- SKILL ICONS ---
// The skill icons are inline paths, not files, so each one is wrapped in a
// small SVG data URL to sit in the same list. A data URL cannot read the
// theme tokens, so the tint is fixed here to the amber of the dark UI.
const SKILL_ICON_TINT = '#e8bb66';

/** One skill's silhouette as a stand-alone image, named after its skill. */
const toSkillAsset = ([key, icon]: [string, { path: string }]): ImageAsset => ({
  name: SKILL_EFFECTS[key]?.name ?? key,
  group: 'Skills',
  url:
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="${SKILL_ICON_TINT}" d="${icon.path}"/></svg>`
    ),
});

export const IMAGE_ASSETS: readonly ImageAsset[] = [
  ...Object.entries(IMAGE_URLS).map(toImageAsset),
  ...Object.entries(SKILL_ICONS).map(toSkillAsset),
]
  .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
