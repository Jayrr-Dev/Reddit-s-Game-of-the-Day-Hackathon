import { useId, type CSSProperties } from 'react';
import art from '../../../assets/heroes/gluttony.webp';
import { BODY_HEIGHT, BODY_WIDTH } from '../../../lib/heroFigure';
import type { HeroSize } from '../../../../shared/game/types';
import type { HeroAction } from '../../../content/heroLooks';
import { ProgressiveSvgImage } from '../../ui/ProgressiveImage';
import './gluttony-rig.css';

const WIDTH = 960;
const HEIGHT = 640;
const INSET = 9;
const CORE = 'M443 268 477 261 519 268 549 293 569 322 577 365 555 402 517 436 476 444 433 436 396 410 369 378 361 345 374 312 404 286Z';
const EYE = 'M458 289 486 287 514 304 530 328 529 361 512 383 486 398 453 395 424 372 414 347 423 322 441 299Z';

// Each cut follows a gap between two curls and overlaps beneath the central
// socket. Pivots stay under the socket so the tentacles never pull off it.
const TENTACLES = [
  ['crown', 'M477 348 396 291 335 246 303 107 294 0H634L632 168 595 211 555 246 524 280Z', 452, 294, 3.8, 5.3, .4],
  ['upper-right', 'M486 349 515 278 549 240 596 203 626 155 630 0H960V222L724 214 661 244 615 284 556 327Z', 522, 301, -4, 4.6, 1.3],
  ['right', 'M483 345 536 319 612 279 661 235 720 209 960 211V454L731 446 687 430 619 412 538 396Z', 544, 351, 4.8, 5.8, 2.1],
  ['lower-right', 'M482 363 541 384 628 403 703 427 960 442V640H664L622 494 534 464 500 421Z', 517, 399, -3.5, 4.8, .8],
  ['bottom-right', 'M476 373 512 407 549 452 631 480 674 640H462L450 477 449 424Z', 491, 411, 5.3, 4.3, 2.7],
  ['bottom-left', 'M472 371 461 422 469 478 478 640H263L295 476 325 411 389 377Z', 443, 411, -4.9, 5.6, 1.9],
  ['left', 'M470 352 403 393 335 422 310 486 281 640H0V322L188 318 272 328 402 337Z', 417, 363, 4.3, 4.9, 3.1],
  ['upper-left', 'M470 345 398 350 270 340 186 332H0V0H310L319 108 347 240 403 284Z', 418, 328, -4.5, 5.1, .1],
] as const;

export const GluttonyRigFigure = ({ size, action }: { size: HeroSize; action?: HeroAction | null }) => {
  const id = useId();
  const pose = !action ? 'idle' : action.isSignature ? (action.isCharging ? 'charge' : 'devour')
    : action.style === 'melee' ? 'lash' : action.style;
  return (
    <svg x={0} y={INSET / 2} width={BODY_WIDTH[size]} height={BODY_HEIGHT - INSET}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMax meet" overflow="visible"
      className="gluttony-rig" data-gluttony-pose={pose}>
      <defs>
        <ProgressiveSvgImage id={id + '-art'} href={art} width={WIDTH} height={HEIGHT} />
        {TENTACLES.map(([name, d]) => (
          <clipPath key={name} id={id + '-' + name}><path d={d} /></clipPath>
        ))}
        <clipPath id={id + '-core'}><path d={CORE} /></clipPath>
        <clipPath id={id + '-socket'}><path d={EYE} /></clipPath>
        <clipPath id={id + '-blink'}><rect className="gluttony-blink" x="405" y="277" width="134" height="128" /></clipPath>
      </defs>
      <use className="gluttony-still" href={`#${id}-art`} />
      <g className="gluttony-motion">
        {TENTACLES.map(([name, , x, y, swing, period, phase], index) => (
          <g key={name} data-gluttony-tentacle={name}
            style={{
              transformOrigin: `${x}px ${y}px`,
              '--gl-idle': `${swing}deg`,
              '--gl-sweep': `${index % 2 === 0 ? swing * 2.25 : swing * 1.6}deg`,
              '--gl-period': `${period}s`,
              '--gl-phase': `-${phase}s`,
              '--gl-response': `${(index % 4) * 28}ms`,
            } as CSSProperties}>
            <use href={`#${id}-art`} clipPath={`url(#${id}-${name})`} />
          </g>
        ))}
        <use href={`#${id}-art`} clipPath={`url(#${id}-core)`} />
        <g clipPath={`url(#${id}-socket)`}>
          <path d={EYE} fill="#42151c" />
          <path d="M414 349 447 333 477 342 505 335 535 346 505 371 479 380 448 370Z" fill="#291017" />
          <path d="M419 349 451 346 474 352 504 346 529 347" fill="none" stroke="#a34026" strokeWidth="5" />
          <use href={`#${id}-art`} clipPath={`url(#${id}-blink)`} />
        </g>
      </g>
    </svg>
  );
};
