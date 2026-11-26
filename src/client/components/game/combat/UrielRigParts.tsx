// ===================================================================
// URIEL RIG PARTS
// The static markup of Archangel Uriel's rig, back to front. Parts
// that move carry a `data-uriel-part` name; useUrielRig poses them, so
// nothing here holds a transform of its own unless it never changes.
// ===================================================================

import { useId } from 'react';
import armorArt from '../../../assets/heroes/archangels/uriel-armor.webp';
import shieldArt from '../../../assets/heroes/archangels/uriel-shield.webp';
import wingLeftArt from '../../../assets/heroes/archangels/uriel-wing-left.webp';
import wingRightArt from '../../../assets/heroes/archangels/uriel-wing-right.webp';
import {
  ARM_FORE_FACETS,
  ARM_UPPER_FACETS,
  BLADE_FACETS,
  GRIP_FACET,
  HAND_FACETS,
  PAULDRON_FACETS,
  URIEL_ART,
  type UrielFacet,
} from '../../../content/urielRigArt';
import { BLUR_GHOSTS, URIEL_RIBBONS } from '../../../lib/urielRig';
import { ProgressiveSvgImage } from '../../ui/ProgressiveImage';

// --- CONSTANTS ---
/** The torso layer minus both shoulders, which the moving pauldrons replace. */
const TORSO_WITHOUT_PAULDRONS =
  'M0 0H1050V525H0Z M546 111 563 112 585 122 597 142 596 151 575 156 556 145 550 133Z ' +
  'M504 111 487 112 465 122 453 142 454 151 475 156 494 145 500 133Z';
const ARM_CONNECTOR = { fill: 'none', stroke: '#523238', strokeWidth: 16, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
/** The trailing ghosts are darker, the ones nearest the blade lighter. */
const DARK_GHOSTS = 8;

// --- ATOMS ---
/** A painted layer at the art's full size. */
const Layer = ({ href }: { href: string }) => (
  <ProgressiveSvgImage href={href} width={URIEL_ART.width} height={URIEL_ART.height} />
);

/** A group of flat-colour facets; `part` lets the rig move it. */
const Facets = ({ facets, part }: { facets: readonly UrielFacet[]; part?: string }) => (
  <g data-uriel-part={part}>
    {facets.map(([fill, d]) => <path key={d} fill={fill} d={d} />)}
  </g>
);

// --- SECTIONS ---
/** Both wings, each flapping around its shoulder. */
const Wings = () => (
  <>
    <g data-uriel-part="wingLeft">
      <path fill="#63252e" d="M416 118 454 92 493 120 495 168 450 185 420 157Z" />
      <Layer href={wingLeftArt} />
    </g>
    <g data-uriel-part="wingRight">
      <path fill="#63252e" d="M634 118 596 92 557 120 555 168 600 185 630 157Z" />
      <Layer href={wingRightArt} />
    </g>
  </>
);

/** The halo; only its highlight arc turns. */
const Halo = () => (
  <g data-uriel-part="haloAnchor">
    <g transform="translate(525 56)" fill="none">
      <circle r="38" stroke="#a2612b" strokeWidth="8" />
      <circle r="38" stroke="#efb85c" strokeWidth="5" />
      <circle data-uriel-part="haloHighlight" r="38" stroke="#ffe6ad" strokeWidth="5"
        strokeLinecap="round" strokeDasharray="36 202.761" />
    </g>
  </g>
);

/** The cloth ribbons under the hips; the rig rewrites each outline. */
const Ribbons = () => (
  <>
    <path fill="#702837" d="M483 215 566 215 572 253 562 300 526 349 486 297 473 254Z" />
    <path fill="#9a3e37" d="M515 244 535 244 537 295 526 328 516 299Z" />
    {URIEL_RIBBONS.map(({ colors: [base, facet] }, index) => (
      <g key={index}>
        <path data-uriel-part={`ribbon-${index}-base`} fill={base} />
        <path data-uriel-part={`ribbon-${index}-facet`} fill={facet} />
      </g>
    ))}
  </>
);

/** The sword arm: connector, plates, then the grip with blade and hand. */
const SwordArm = () => (
  <g>
    <path data-uriel-part="armConnection" {...ARM_CONNECTOR} />
    <Facets part="swordUpper" facets={ARM_UPPER_FACETS} />
    <Facets part="swordFore" facets={ARM_FORE_FACETS} />
    <g data-uriel-part="grip">
      <path fill={GRIP_FACET[0]} d={GRIP_FACET[1]} />
      <Facets part="blade" facets={BLADE_FACETS} />
      <g transform="rotate(-46) translate(-628 -238)"><Facets facets={HAND_FACETS} /></g>
    </g>
  </g>
);

/** Torso, shield arm, shield, sword arm and both pauldrons; leans as one. */
const Body = () => {
  const torsoClip = useId();
  return (
    <g data-uriel-part="bodyLean">
      <clipPath id={torsoClip}><path clipRule="evenodd" d={TORSO_WITHOUT_PAULDRONS} /></clipPath>
      <path fill="#642935" d="M548 140 580 139 588 155 579 179 567 190 548 174Z" />
      <g clipPath={`url(#${torsoClip})`}><Layer href={armorArt} /></g>
      <path data-uriel-part="guardConnection" {...ARM_CONNECTOR} />
      <Facets part="shieldUpper" facets={ARM_UPPER_FACETS} />
      <Facets part="shieldFore" facets={ARM_FORE_FACETS} />
      <Layer href={shieldArt} />
      <SwordArm />
      <Facets part="shieldPauldron" facets={PAULDRON_FACETS} />
      <Facets part="swordPauldron" facets={PAULDRON_FACETS} />
    </g>
  );
};

/** Swing effects: the diagonal's blade blur and the overhead cut's trail. */
const SwingEffects = () => (
  <g pointerEvents="none">
    {Array.from({ length: BLUR_GHOSTS }, (_, ghost) => (
      <path key={ghost} data-uriel-part={`ghost-${ghost}`} fill={ghost < DARK_GHOSTS ? '#d18457' : '#ffe6bc'} opacity={0} />
    ))}
    <path data-uriel-part="slashTrail" fill="#f1b963" opacity={0} />
    <path data-uriel-part="slashEdge" fill="none" stroke="#fff0b4" strokeWidth="2" opacity={0} />
  </g>
);

// --- COMPONENT ---
/** The whole rig in art space; the caller frames it with a viewBox. */
export const UrielRigParts = () => (
  <g data-uriel-part="float">
    <Wings />
    <Halo />
    <Ribbons />
    <Body />
    <SwingEffects />
  </g>
);
