// ===================================================================
// FIGURE BOUNDS
// Where each boss's visible drawing sits inside its figure viewBox
// (BODY_WIDTH[size] x BODY_HEIGHT units, at getHero(id).size). The
// sprites carry transparent padding and many overflow the viewBox, so
// the viewBox alone can't tell how big or where a boss looks. The
// practice menu uses these boxes to scale every boss to fill its arena
// card by the same margin, centred (see .training-portrait).
//
// MEASURED: each figure rendered at 10 px per unit with animations off,
// then the bounding box of its opaque pixels (alpha > 48) taken. Measure
// again when a boss's art or its placement in CreatureFigure changes.
// ===================================================================

import type { HeroId } from '../../shared/game/heroes';

// --- TYPES ---
/** A box in viewBox units; x and y may be negative where art overflows. */
export type FigureBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// --- DATA ---
export const FIGURE_BOUNDS: Readonly<Partial<Record<HeroId, FigureBounds>>> = {
  angelArcher: { x: -4.3, y: 20.6, width: 68.6, height: 60.9 },
  angelAssassin: { x: 1.3, y: 24.1, width: 57.4, height: 73.3 },
  angelMage: { x: 2.0, y: 3.0, width: 81.0, height: 96.0 },
  wingedArcher: { x: 2.0, y: 3.0, width: 84.0, height: 96.0 },
  apollyonSeraph: { x: 13.3, y: 11.7, width: 123.3, height: 87.0 },
  archangelUriel: { x: 5.34, y: 71.44, width: 48.75, height: 26.83 },
  archangelZeruel: { x: 24.5, y: -6.8, width: 100.9, height: 106.5 },
  ballista: { x: -15.0, y: 26.3, width: 90.0, height: 73.7 },
  cervielBow: { x: -11.1, y: 4.7, width: 70.6, height: 90.1 },
  cervielSword: { x: -20.4, y: -14.8, width: 100.8, height: 109.1 },
  fulgurDragonknight: { x: 3.2, y: 2.2, width: 143.4, height: 93.4 },
  grandGriffon: { x: 37.6, y: 0.7, width: 81.2, height: 94.1 },
  grandangelCambiel: { x: 27.9, y: -2.4, width: 94.0, height: 93.7 },
  grandangelCerviel: { x: -8.3, y: -13.5, width: 77.4, height: 107.8 },
  grandangelCherubiel: { x: 21.8, y: -22.1, width: 106.4, height: 115.4 },
  grandangelGeonosis: { x: 25.8, y: -12.0, width: 98.4, height: 105.5 },
  sloth: { x: 2.06, y: 57.12, width: 55.75, height: 37.25 },
  pride: { x: 1.44, y: 30.46, width: 57.13, height: 64.91 },
  lust: { x: 5.16, y: 11.19, width: 50.16, height: 87.38 },
  gluttony: { x: 7.00, y: 57.25, width: 46.00, height: 34.88 },
  greed: { x: 0, y: 44.29, width: 60, height: 54.71 },
  envy: { x: 0, y: 56.67, width: 60, height: 38.33 },
  grandangelRaziel: { x: 38.7, y: -18.5, width: 72.5, height: 114.2 },
  holyDragon: { x: 14.4, y: 5.3, width: 121.2, height: 89.9 },
  holyKing: { x: 12.8, y: 23.8, width: 34.4, height: 45.5 },
  ivoryWerewolf: { x: 8.0, y: 10.0, width: 69.0, height: 87.0 },
  lightLordMori: { x: 32.1, y: -9.3, width: 85.8, height: 105.3 },
  mageBorneAstra: { x: 46.4, y: -14.6, width: 56.3, height: 116.4 },
  mageBorneAzula: { x: 40.8, y: -11.4, width: 68.4, height: 112.7 },
  tempestWyrm: { x: -21.4, y: -15.3, width: 190.1, height: 115.2 },
  twinAxeKnight: { x: 1.0, y: 60.2, width: 58.1, height: 39.5 },
  wolfCentaur: { x: 6.0, y: 7.9, width: 78.0, height: 90.1 },
  zadkielOfDominations: { x: 2.0, y: -12.2, width: 146.0, height: 107.4 },
  zeruelArmored: { x: 0.6, y: 29.5, width: 58.8, height: 69.8 },
  zeruelBlueSun: { x: 5.6, y: 39.4, width: 47.9, height: 48.0 },
  zeruelRedSun: { x: 3.6, y: 39.4, width: 50.8, height: 48.9 },
};
