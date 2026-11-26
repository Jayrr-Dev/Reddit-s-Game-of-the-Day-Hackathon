// --- BATTLEFIELD TERRAIN ---
import { memo } from 'react';
import { activeRows } from '../../../../shared/game/battlefield';
import type { HeroRow } from '../../../../shared/game/types';
import { depthStyle } from '../../../lib/cssVars';
import type { BossArena } from '../../../content/bossArenas';

import scene0 from '../../../assets/terrain/village.webp';
import scene1 from '../../../assets/terrain/kings-road.webp';
import scene2 from '../../../assets/terrain/monastery.webp';
import scene3 from '../../../assets/terrain/castle-gates.webp';
import scene4 from '../../../assets/terrain/royal-court.webp';
import scene5 from '../../../assets/terrain/throne-hall.webp';
import scene6 from '../../../assets/terrain/marsh.webp';
import scene7 from '../../../assets/terrain/forest.webp';
import scene8 from '../../../assets/terrain/mountain-pass.webp';
import aqueduct from '../../../assets/terrain/aqueduct.webp';
import birchGrove from '../../../assets/terrain/birch-grove.webp';
import volcanicPass from '../../../assets/terrain/volcanic-pass.webp';

import elvenForest from '../../../assets/terrain/elven-forest.webp';
import citySquare from '../../../assets/terrain/city-square.webp';
import fallenCity from '../../../assets/terrain/fallen-city.webp';
import ancientRuins from '../../../assets/terrain/ancient-ruins.webp';
import duneSea from '../../../assets/terrain/dune-sea.webp';
import waysideRoad from '../../../assets/terrain/wayside-road.webp';
import mines from '../../../assets/terrain/mines.webp';
import cave from '../../../assets/terrain/cave.webp';
import dungeon from '../../../assets/terrain/dungeon.webp';
import riverBridge from '../../../assets/terrain/river-bridge.webp';

// Each artwork's distant road, gate or clearing, in image percentages.
const scenes = [
  [scene0, 52, 32, "Village Green"], [scene1, 49, 31, "King’s Road"], [scene2, 53, 39, "Monastery"],
  [scene3, 53, 42, "Castle Gates"], [scene4, 52, 35, "Royal Court"], [scene5, 50, 30, "Throne Hall"],
  [scene6, 51, 33, "Marsh"], [scene7, 54, 34, "Deep Forest"], [scene8, 51, 39, "Mountain Pass"],
  [aqueduct, 53, 38, "Old Aqueduct"], [birchGrove, 55, 27, "Birch Grove"], [volcanicPass, 51, 34, "Volcanic Pass"],
  [elvenForest, 51, 37, "Elven Forest"], [citySquare, 50, 34, "City Square"], [fallenCity, 50, 37, "Fallen City"],
  [ancientRuins, 50, 28, "Ancient Ruins"], [duneSea, 52, 22, "Dune Sea"], [waysideRoad, 51, 20, "Wayside Road"],
  [riverBridge, 52, 26, "River Bridge"],
  [mines, 52, 32, "Mines"], [cave, 48, 40, "Cave"], [dungeon, 50, 39, "Dungeon"],
] as const;

export const MAP_IMAGES = scenes.map(([image]) => image);
export const MAP_NAMES = scenes.map(([, , , name]) => name);

/** Start practice in the elven forest so the new maps can be tested together. */
export const PRACTICE_TERRAIN_START = scenes.findIndex(([image]) => image === elvenForest);

// --- TERRAIN BLUR ---
// Depth-of-field: soften distant scenery a touch so units stand out, never the
// near ground. One table so the whole backdrop's softness is tuned in one place
// (lowered 2026-11-26 so the background reads clearer).
const TERRAIN_BLUR_PX = { sky: 0.6, horizon: 0.35, back: 0.15, front: 0 } as const satisfies Record<HeroRow | 'sky', number>;

/** CSS filter for one terrain layer; 0 px skips the filter entirely. */
const terrainBlur = (layer: keyof typeof TERRAIN_BLUR_PX): string =>
  TERRAIN_BLUR_PX[layer] > 0 ? `blur(${TERRAIN_BLUR_PX[layer]}px)` : 'none';

type BackdropProps = {
  terrainIndex: number;
  bossArena?: BossArena | undefined;
  depths: Record<HeroRow, number>;
  hasHorizon: boolean;
};

/** Feather each stretch of ground into the one behind it as the camera moves. */
export const Backdrop = memo(function Backdrop({ terrainIndex, bossArena, depths, hasHorizon }: BackdropProps) {
  const [scene, vanishingX, horizon] = bossArena
    ? [bossArena.image, bossArena.vanishingX, bossArena.horizon]
    : scenes[terrainIndex % scenes.length] ?? scenes[0];
  const rows = activeRows();
  const groundStarts: Record<HeroRow, number> = {
    horizon: 18,
    back: hasHorizon ? 37 : 23,
    front: hasHorizon ? 67 : 57,
  };
  const backgroundImage = `url("${scene}")`;
  // Bottom-align the image so its recorded horizon lands at 20% of the frame.
  const terrainStyle = { backgroundImage, backgroundPositionX: `${(1.2 * vanishingX - 50) / 0.2}%`, backgroundSize: `120% ${8000 / (100 - horizon)}%`, backgroundPositionY: 'bottom' };
  const layer = 'parallax-layer pointer-events-none absolute -inset-x-8 inset-y-0 ';
  return (
    <div aria-hidden="true" data-boss-arena={bossArena?.name} className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className={layer} style={{ ...depthStyle(0.12), ...terrainStyle, filter: terrainBlur('sky') }} />
      {[...rows].reverse().map((row) => (
        <div key={row} className={layer} style={{
          ...depthStyle(depths[row]),
          ...terrainStyle,
          filter: terrainBlur(row),
          maskImage: `linear-gradient(transparent ${groundStarts[row]}%, black ${groundStarts[row] + 9}%)`,
        }} />
      ))}
    </div>
  );
});
