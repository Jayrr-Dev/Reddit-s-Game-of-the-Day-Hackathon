import { useId } from 'react';
import fulgurArt from '../../../assets/heroes/fulgur-dragonknight-idle.webp';
import { ProgressiveSvgImage } from '../../ui/ProgressiveImage';

// --- ORIGINAL ART CUTS ---
// Coordinates are traced on the 1536 x 1024 source. The tips and membranes
// move as intact pieces; the shoulder ends overlap the body under its armor.
const LEFT_WING = 'M505 94L484 84 264 167 148 251 44 464 40 628 9 824 119 626 191 582 265 555 316 592 343 654 390 597 439 548 493 532 562 495 591 480 601 421 643 405 605 370 531 316 479 229 479 148Z';
const RIGHT_WING = 'M1110 154L1123 144 1372 269 1503 512 1475 486 1470 565 1534 859 1421 701 1371 641 1280 581 1207 554 1146 549 1110 574 1097 602 1062 573 1037 552 978 531 943 548 902 581 890 554 898 497 922 456 965 418 987 377 1033 354 1061 327 1101 268 1127 202Z';
const LEFT_ROOT = 'M595 387 666 391 652 440 592 457 578 430Z';
const RIGHT_ROOT = 'M927 424 1008 397 1003 455 952 509 912 542 900 509Z';
const SOURCE_TO_UNIT = 'translate(1 0.1666666667) scale(0.0963541667)';
const FRAME = { x: 1, y: 0, width: 148, height: 99 };

/** Articulated original raster art; the body, feet and casting hand are fixed. */
export const FulgurWingArt = () => {
  const id = useId();
  const body = `${id}-body`;
  const left = `${id}-left`;
  const right = `${id}-right`;
  return (
    <g data-fulgur-dragonknight="">
      <defs>
        <mask id={body} maskUnits="userSpaceOnUse" x={0} y={-4} width={150} height={108}>
          <rect x={0} y={-4} width={150} height={108} fill="white" />
          <path d={`${LEFT_WING} ${RIGHT_WING}`} transform={SOURCE_TO_UNIT} fill="black" />
        </mask>
        <clipPath id={left}>
          <path d={LEFT_WING} transform={SOURCE_TO_UNIT} />
          <path d={LEFT_ROOT} transform={SOURCE_TO_UNIT} />
        </clipPath>
        <clipPath id={right}>
          <path d={RIGHT_WING} transform={SOURCE_TO_UNIT} />
          <path d={RIGHT_ROOT} transform={SOURCE_TO_UNIT} />
        </clipPath>
      </defs>
      <g className="fulgur-wing wyvern-wing wyvern-wing-left" style={{ transformOrigin: '61px 39px' }}>
        <ProgressiveSvgImage href={fulgurArt} {...FRAME} clipPath={`url(#${left})`} />
      </g>
      <g className="fulgur-wing wyvern-wing wyvern-wing-right" style={{ transformOrigin: '95px 40px' }}>
        <ProgressiveSvgImage href={fulgurArt} {...FRAME} clipPath={`url(#${right})`} />
      </g>
      <ProgressiveSvgImage href={fulgurArt} {...FRAME} mask={`url(#${body})`} />
    </g>
  );
};