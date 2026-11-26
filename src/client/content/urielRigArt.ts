// ===================================================================
// URIEL RIG ART
// The flat-colour facets of Archangel Uriel's rig that are drawn as
// vectors (arms, pauldrons, sword, hand), traced from the approved
// demo in tools/uriel. Each list paints back to front. The painted
// layers (wings, armour, shield) are the uriel-*.webp images.
// ===================================================================

// --- TYPES ---
/** One flat-colour polygon: [fill, path]. */
export type UrielFacet = readonly [fill: string, d: string];

// --- FRAMING ---
/** The art's own size; every painted layer and coordinate uses it. */
export const URIEL_ART = { width: 1050, height: 525 } as const;
/** The window onto the art that fills her figure cell: room above and beside for the sword's full arc. */
export const URIEL_VIEW = { x: -37, y: -187, width: 1124, height: 730 } as const;

// --- ARMS ---
/** Upper-arm plates; both arms reuse them (the shield arm mirrored). */
export const ARM_UPPER_FACETS: readonly UrielFacet[] = [
  ['#50202a', 'M555 151 580 150 590 163 597 177 590 194 578 198 566 183 555 168Z'],
  ['#701d27', 'M556 154 572 156 584 169 589 186 578 195 569 178Z'],
  ['#8e1e2f', 'M570 160 584 160 592 173 588 185 578 188 575 176Z'],
  ['#b47249', 'M570 157 583 159 587 165 587 171 578 171Z'],
  ['#983b34', 'M578 171 587 169 592 176 589 181 580 178Z'],
];

/** Forearm plates and vambrace. */
export const ARM_FORE_FACETS: readonly UrielFacet[] = [
  ['#64232c', 'M580 188 594 173 608 182 619 203 625 223 630 230 617 233 607 217 600 203 591 199 580 198Z'],
  ['#b77b40', 'M577 191 585 187 593 172 602 179 607 193 600 197 583 198Z'],
  ['#f0ad59', 'M588 185 593 171 599 179 596 192 591 195 585 190Z'],
  ['#df9b45', 'M600 180 607 182 612 191 619 207 623 215 615 218 607 207 601 198 598 193Z'],
  ['#f1ae57', 'M602 182 607 183 613 193 619 205 611 201 606 193Z'],
  ['#d78e47', 'M601 197 610 202 621 211 623 215 615 218 606 208Z'],
  ['#8c2630', 'M610 214 615 218 622 214 628 225 619 230 614 224Z'],
  ['#a4473d', 'M618 219 624 219 627 224 622 226 618 225Z'],
];

/** Shoulder plate, drawn around its own pivot. */
export const PAULDRON_FACETS: readonly UrielFacet[] = [
  ['#663522', 'M-9 -13 8 -11 24 -4 39 12 37 22 18 22 4 18 -3 6Z'],
  ['#aa6b35', 'M-9 -13 8 -11 24 -4 37 11 22 13 8 8 -3 6Z'],
  ['#f2c681', 'M-9 -13 8 -11 10 -4 3 -1 -4 0Z M12 -8 24 -4 37 11 25 11 17 4Z'],
  ['#d99a50', 'M-3 6 8 8 22 13 37 11 37 17 20 17 7 13Z'],
  ['#fbd08a', 'M4 14 20 18 38 16 37 22 18 22 8 19Z'],
];

// --- SWORD ---
/** The grip, drawn around the wrist with the blade pointing along +x. */
export const GRIP_FACET: UrielFacet = ['#793f2c', 'M-13 -3 16 -4 19 3 -12 5Z'];

/** Blade and crossguard. */
export const BLADE_FACETS: readonly UrielFacet[] = [
  ['#8d5536', 'M13 -6 20 -10 26 -7 29 -4 196 0 30 9 20 10 13 5Z'],
  ['#f3cb92', 'M26 -5 196 0 29 7 24 1Z'],
  ['#fff0c6', 'M27 -3 196 0 30 3Z'],
  ['#d8984f', 'M13 -17 20 -26 23 -16 25 -10 25 10 19 20 13 22 16 8 15 -8Z'],
  ['#f2be68', 'M13 -17 21 -24 20 -8 17 8 13 22 14 9Z'],
  ['#7d3e35', 'M15 -4 22 -5 24 2 19 7 15 3Z'],
];

/** The sword hand, in art space; the rig moves it to the wrist. */
export const HAND_FACETS: readonly UrielFacet[] = [
  ['#6a2d24', 'M601 222 608 223 614 229 615 235 621 238 619 244 608 241 601 234Z'],
  ['#c57c4b', 'M601 224 608 224 611 231 608 238 603 236Z'],
  ['#a26255', 'M614 230 620 225 627 223 635 230 641 240 641 247 635 243 630 242 628 250 624 253 620 251 617 246 612 245 611 240 618 241Z'],
  ['#fac194', 'M617 230 624 226 628 224 634 230 637 235 635 240 631 239 629 246 625 250 622 248 622 242 617 240Z'],
  ['#f8c69e', 'M622 230 628 227 632 232 630 239 627 247 624 249 623 244 624 239Z'],
  ['#cd7d54', 'M613 240 619 241 624 248 623 252 619 249 615 245Z'],
  ['#e2a480', 'M634 232 638 237 640 241 637 242 632 239 633 236Z'],
];
