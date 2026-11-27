import { useId } from 'react';
import swordArt from '../../../assets/heroes/mikhael-taxiarch-sword.webp';
import spearArt from '../../../assets/heroes/mikhael-taxiarch-spear.webp';
import { BODY_HEIGHT, BODY_WIDTH } from '../../../lib/heroFigure';
import type { HeroAction } from '../../../content/heroLooks';
import type { HeroSize } from '../../../../shared/game/types';
import { ProgressiveSvgImage } from '../../ui/ProgressiveImage';
import './mikhaelRig.css';

// --- REGISTRATION ---
// Mask paths follow the faceted edges of each pose. The body and the weapon
// render in front, so the wing hinges remain covered while the fans rotate.
const WING_MASKS = [
  'M-5-65H318V273L320 307 301 331 281 353 256 377 221 391H-5Z',
  'M766-65H449V268L443 300 463 326 480 350 509 372 544 392H766Z',
  'M-5 384L150 369 218 377 272 408 296 428 283 466 238 503 199 579 161 706H-5Z',
  'M766 384L612 370 546 376 512 408 465 426 470 461 519 498 556 587 594 707H766Z',
] as const;
const WING_ANCHORS = [[310, 315], [460, 315], [272, 449], [497, 449]] as const;
const ARM = {
  sword: 'M276 356 316 371 319 397 298 417 284 459 277 497 282 522 275 557 256 568 221 659 126 802 134 760 170 650 204 569 194 549 206 526 230 519 235 483 244 456 247 418 256 386Z',
  spear: 'M67 432 109 377 280 272 302 245 334 225 625 75 649 75 640 96 341 254 338 278 316 291 308 320 327 337 350 341 369 372 340 398 300 384 268 354 258 325 275 292 192 347 116 410Z',
} as const;
const SPEAR_PIVOT = [343, 362] as const;
const SWORD_PIVOT = [299, 375] as const;

type Motion = 'idle' | 'ward' | 'quake' | 'double' | 'judgment' | 'rift' | 'bind' | 'gate' | 'last' | 'charge';
const ATTACK_MOTION: Readonly<Record<string, Motion>> = {
  "Marshal's Ward": 'ward',
  'Divide the Earth': 'quake',
  'Sword of the Host': 'double',
  "The Taxiarch's Sentence": 'judgment',
  'Light Through the Rift': 'rift',
  'Grasp of Heaven': 'bind',
  'The Gate Trembles': 'gate',
  'Spear of the Last Seal': 'last',
};

/** Match Training and the field to the same choreography. */
function motionOf(action: HeroAction | null | undefined, spear: boolean): Motion {
  // Sword action clips stay disabled until their motion is approved.
  if (!action || !spear) return 'idle';
  if (action.isCharging) return 'charge';
  const name = action.moveName?.replace(/^Phase 2\s*[^\w]+\s*/, '') ?? '';
  return ATTACK_MOTION[name] ?? (action.style === 'support' ? 'ward' : spear ? 'rift' : 'quake');
}

// --- FIGURE ---
/** Four independently hinged wings and a pinned weapon arm, on one alpha sprite. */
export function MikhaelFigure({ size, phase, action }: { size: HeroSize; phase?: 2 | undefined; action?: HeroAction | null }) {
  const id = useId();
  const spear = phase === 2;
  const motion = motionOf(action, spear);
  const armPath = ARM[spear ? 'spear' : 'sword'];
  const [armX, armY] = spear ? SPEAR_PIVOT : SWORD_PIVOT;
  const art = '#' + id + '-image';
  const poseY = spear ? 0 : 31;
  return <svg className="mikhael-rig" data-mikhael-motion={motion} data-mikhael-weapon={spear ? 'spear' : 'sword'}
    x={0} y={0} width={BODY_WIDTH[size]} height={BODY_HEIGHT} viewBox="-152 -75 1064 920"
    preserveAspectRatio="xMidYMax meet" overflow="visible">
    <defs>
      <g id={id + '-image'}><ProgressiveSvgImage href={spear ? spearArt : swordArt} x={0} y={0} width={760} height={940} /></g>
      <mask id={id + '-body'} maskUnits="userSpaceOnUse" x={0} y={0} width={760} height={940}>
        <rect width={760} height={940} fill="white" />
        {WING_MASKS.map((path, index) => <path key={index} d={path} fill="black" />)}
        <path d={armPath} fill="black" />
      </mask>
      <clipPath id={id + '-arm'}><path d={armPath} /></clipPath>
      {WING_MASKS.map((path, index) => <mask key={index} id={id + '-wing' + index} maskUnits="userSpaceOnUse" x={0} y={0} width={760} height={940}>
        <path d={path} fill="white" /><path d={armPath} fill="black" />
      </mask>)}
    </defs>
    <g transform={'translate(0 ' + poseY + ')'}>
      <g className="mikhael-rig-stance" style={{ transformOrigin: '380px 805px' }}>
        {WING_ANCHORS.map(([x, y], index) => <g key={index} className="mikhael-rig-wing"
          data-wing={index} style={{ transformOrigin: x + 'px ' + y + 'px' }}>
          <g transform={'translate(' + x + ' ' + y + ') scale(' + (index < 2 ? '1.30 1.04' : '1.21 1.05') + ') translate(' + -x + ' ' + -y + ')'}>
            <use href={art} mask={'url(#' + id + '-wing' + index + ')'} />
          </g>
        </g>)}
        <use href={art} mask={'url(#' + id + '-body)'} />
        <g className="mikhael-rig-arm" style={{ transformOrigin: armX + 'px ' + armY + 'px' }}>
          <use href={art} clipPath={'url(#' + id + '-arm)'} />
          {spear && <circle data-mikhael-spear-origin cx="318" cy="261" r="5" opacity="0" />}
        </g>
      </g>
      {motion !== 'idle' && <g className="mikhael-rig-effect" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {spear
          ? <path d="M310 252 Q403 283 632 351 M322 275L559 344 M332 238L500 266" stroke="var(--color-accent-hover)" strokeWidth="9" />
          : <path d="M115 711 Q247 520 612 511 M154 717 Q313 570 552 566" stroke="var(--color-accent-hover)" strokeWidth="10" />}
      </g>}
    </g>
  </svg>;
}
