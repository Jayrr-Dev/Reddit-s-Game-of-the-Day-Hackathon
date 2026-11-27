// ===================================================================
// FIGURE BOUNDS
// Where each boss's visible drawing sits inside its figure viewBox
// (BODY_WIDTH[size] x BODY_HEIGHT units). Each box declares the exact
// size it was measured at. Sprites can have transparent padding or overflow, so
// the viewBox alone can't tell how big or where a boss looks. The
// practice menu uses these boxes to scale every boss to fill its arena
// card by the same margin, centred (see .training-portrait).
//
// MEASURED: each figure rendered at 10 px per unit with animations off,
// then the bounding box of its opaque pixels (alpha > 48) taken. Measure
// again when a boss's art or its placement in CreatureFigure changes.
// ===================================================================

import type { HeroId } from '../../shared/game/heroes';
import type { HeroSize } from '../../shared/game/types';

// --- TYPES ---
/** A box in viewBox units; x and y may be negative where art overflows. */
export type FigureBounds = {
  size: HeroSize;
  x: number;
  y: number;
  width: number;
  height: number;
};

// --- DATA ---
export const FIGURE_BOUNDS: Readonly<Partial<Record<HeroId, FigureBounds>>> = {
  angelArcher: { size: 1, x: -4.3, y: 20.6, width: 68.6, height: 60.9 },
  angelAssassin: { size: 3, x: 39.1, y: 4.9, width: 71.8, height: 91.8 },
  angelMage: { size: 1.5, x: 2.0, y: 3.0, width: 81.0, height: 96.0 },
  wingedArcher: { size: 1, x: -11.5, y: 2.2, width: 80.9, height: 95 },
  apollyonSeraph: { size: 3, x: 13.3, y: 11.7, width: 123.3, height: 87.0 },
  archangelUriel: { size: 3, x: 13.35, y: 28.60, width: 121.88, height: 67.08 },
  archangelZeruel: { size: 3, x: 24.5, y: -6.8, width: 100.9, height: 106.5 },
  ballista: { size: 1, x: -15.0, y: 26.3, width: 90.0, height: 73.7 },
  cervielBow: { size: 1, x: -11.1, y: 4.7, width: 70.6, height: 90.1 },
  cervielSword: { size: 3, x: 24, y: -19, width: 102, height: 120 },
  fulgurDragonknight: { size: 3, x: 3.2, y: 2.2, width: 143.4, height: 93.4 },
  grandGriffon: { size: 3, x: 37.6, y: 0.7, width: 81.2, height: 94.1 },
  grandangelCambiel: { size: 3, x: 27.9, y: -2.4, width: 94.0, height: 93.7 },
  grandangelCerviel: { size: 1, x: -8.3, y: -13.5, width: 77.4, height: 107.8 },
  grandangelCherubiel: { size: 3, x: 21.8, y: -22.1, width: 106.4, height: 115.4 },
  grandangelGeonosis: { size: 3, x: 25.8, y: -12.0, width: 98.4, height: 105.5 },
  sloth: { size: 3, x: 12.1, y: 9.8, width: 125.4, height: 83.8 },
  pride: { size: 3, x: 36.4, y: 6.4, width: 77.2, height: 87.7 },
  lust: { size: 3, x: 47.7, y: 2.4, width: 55.2, height: 96.1 },
  gluttony: { size: 3, x: 22.7, y: 8.5, width: 104.7, height: 79.3 },
  greed: { size: 3, x: 21.3, y: 1, width: 107.5, height: 98 },
  envy: { size: 3, x: 4.6, y: 5, width: 140.9, height: 90 },
  grandangelRaziel: { size: 3, x: 38.7, y: -18.5, width: 72.5, height: 114.2 },
  holyDragon: { size: 3, x: 14.4, y: 5.3, width: 121.2, height: 89.9 },
  holyKing: { size: 3, x: 31.5, y: -15.6, width: 87, height: 114 },
  ivoryWerewolf: { size: 1.5, x: 4, y: 24, width: 77, height: 76 },
  lightLordMori: { size: 3, x: 32.1, y: -9.3, width: 85.8, height: 105.3 },
  mageBorneAstra: { size: 3, x: 46.4, y: -14.6, width: 56.3, height: 116.4 },
  mageBorneAzula: { size: 3, x: 40.8, y: -11.4, width: 68.4, height: 112.7 },
  tempestWyrm: { size: 3, x: -21.4, y: -15.3, width: 190.1, height: 115.2 },
  twinAxeKnight: { size: 3, x: 24.7, y: 9.3, width: 100.7, height: 87.4 },
  wolfCentaur: { size: 1.5, x: 5.5, y: 7, width: 74, height: 93 },
  zadkielOfDominations: { size: 3, x: 2.0, y: -12.2, width: 146.0, height: 107.4 },
  zeruelArmored: { size: 3, x: 33.4, y: 1.1, width: 83.1, height: 96.7 },
  zeruelBlueSun: { size: 1, x: 5.6, y: 39.4, width: 47.9, height: 48.0 },
  zeruelRedSun: { size: 1, x: 3.6, y: 39.4, width: 50.8, height: 48.9 },
};
