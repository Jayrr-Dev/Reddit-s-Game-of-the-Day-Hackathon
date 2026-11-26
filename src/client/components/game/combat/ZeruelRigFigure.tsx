import { useId, type CSSProperties } from 'react';
import type { HeroSize } from '../../../../shared/game/types';
import type { HeroAction } from '../../../content/heroLooks';
import { BODY_HEIGHT, BODY_WIDTH } from '../../../lib/heroFigure';
import classic from '../../../assets/heroes/archangel-zeruel.webp';
import armoredArt from '../../../assets/heroes/archangels/zeruel-armored.webp';
import { ProgressiveSvgImage } from '../../ui/ProgressiveImage';
import './zeruel-rig.css';

type Part = { role: 'wing' | 'halo' | 'arm' | 'ribbon'; cut: string; pivot: [number, number]; angle: number; phase: number };
const wing = (cut: string, pivot: [number, number], angle: number, phase: number): Part => ({ role: 'wing', cut, pivot, angle, phase });
const arm = (cut: string, pivot: [number, number], angle: number): Part => ({ role: 'arm', cut, pivot, angle, phase: 0 });
const halo = (cut: string, pivot: [number, number]): Part => ({ role: 'halo', cut, pivot, angle: 3, phase: 0 });
const ribbon = (cut: string, pivot: [number, number], angle: number, phase: number): Part => ({ role: 'ribbon', cut, pivot, angle, phase });

// Cuts are on a stable sketching canvas, not screen coordinates. At rest they
// reconstruct the approved WebP. Each hinge crosses a seam at a shoulder, hip,
// or feather root, leaving just a small lap beneath the adjacent layer.
const CLASSIC = {
  art: classic, x: 0, y: 20, w: 700, h: 742.53,
  parts: [
    wing('M0 20H198L213 110 236 173 259 203 286 228 308 245 294 259 268 265 251 252 217 227 173 204 0 222Z', [279, 245], -6.4, 0),
    wing('M495 20H700V230L550 210 509 209 472 232 454 256 414 236 434 201 460 169Z', [447, 230], 6.4, 0.07),
    wing('M0 258L133 285 170 303 201 328 219 355 236 366 240 379 211 400 158 423 0 459Z', [227, 367], -7.2, 0.19),
    wing('M700 257V452L574 421 512 395 464 382 460 369 477 342 504 306 548 291Z', [473, 369], 7.2, 0.24),
    wing('M0 499L108 470 161 432 207 412 218 420 212 445 207 468 196 466 189 489 201 514 214 522 247 510 247 522 221 549 219 591 208 644 222 676 169 725H0Z', [210, 432], -6, 0.42),
    wing('M700 720H502L474 701 443 678 449 645 438 612 430 573 406 538 404 515 425 520 448 515 462 491 453 464 446 454 439 433 453 409 497 426 547 454 617 481H700Z', [452, 431], 6, 0.49),
    halo('M234 186L241 160 276 134 339 103 401 79 443 82 446 97 438 120 400 150 349 161 313 178 275 185Z', [338, 135]),
    arm('M140 214L192 210 212 231 210 267 201 294 213 319 230 337 244 351 248 373 245 381 222 371 203 353 193 318 191 303 166 292 145 281 133 254Z', [233, 353], 8),
    arm('M474 242L489 214 529 212 551 230 551 259 538 278 514 295 499 299 485 335 465 365 447 380 435 379 431 367 438 346 461 325 477 287 471 269Z', [445, 354], -8),
    arm('M259 326L275 352 255 399 243 427 239 465 239 498 230 514 211 515 199 503 195 482 201 454 205 418 218 385 237 361Z', [247, 366], 3.2),
    arm('M398 326L422 339 441 366 449 400 454 434 451 456 458 491 452 510 437 518 426 515 415 508 410 488 414 463 408 435 404 408 388 372Z', [418, 369], -3.2),
  ],
};
const ARMORED = {
  art: armoredArt, x: 28, y: 20, w: 643.47, h: 760,
  parts: [
    wing('M25 20H188L218 83 254 105 287 136 305 175 309 213 313 263 322 292 305 301 281 286 264 254 249 232 213 201 178 184 134 151 86 108Z', [307, 284], -6.7, 0),
    wing('M511 20H671L620 104 563 155 531 178 494 200 466 229 446 261 410 299 394 307 384 290 398 251 403 212 400 171 430 129 485 85Z', [401, 287], 6.7, 0.06),
    wing('M18 245H196L247 259 260 275 285 305 299 324 289 330 273 320 252 306 231 295 215 292 192 300 183 314 184 331 219 348 245 364 241 379 224 388 190 395 158 415 135 465 113 515 71 565H20Z', [286, 327], -8.8, 0.23),
    wing('M678 247V561H628L590 503 565 462 545 411 521 389 477 382 447 369 473 354 501 337 515 320 515 307 498 297 479 291 455 300 436 305 414 320 409 324 399 318 423 298 444 279 491 251 547 242Z', [417, 326], 8.8, 0.27),
    wing('M4 790L69 716 146 646 181 564 212 509 236 477 255 443 278 426 282 452 261 485 254 521 256 548 268 574 255 604 217 655 191 703 165 747 154 790Z', [270, 446], -3.1, 0.42),
    wing('M700 790H553L537 750 518 717 482 671 450 629 423 591 440 566 440 534 422 503 408 473 404 435 420 433 442 467 469 514 508 562 537 617 584 681 630 742Z', [419, 446], 3.1, 0.46),
    ribbon('M322 653L350 660 385 662 407 675 421 697 420 727 410 755 393 781 313 790 322 753 345 727 354 716 340 711 313 706 292 695 279 678 269 658 274 643 295 645 306 652Z', [317, 661], 5, 0.58),
    arm('M184 306L198 297 225 304 252 323 276 330 286 342 295 348 296 367 282 388 271 391 261 374 250 357 231 350 209 337 189 323Z', [276, 349], 8.5),
    arm('M509 304L501 294 482 299 462 316 445 326 421 330 413 346 413 371 423 389 439 380 452 358 465 346 485 337 510 320Z', [430, 349], -8.5),
  ],
};

type Props = { size: HeroSize; action?: HeroAction | null | undefined; armored?: boolean };
const IDLE = 'idle';

/** Original Zeruel art rebuilt as individually pinned wings, arms, halo and flowing cloth. */
export const ZeruelRigFigure = ({ size, action, armored = false }: Props) => {
  const id = useId();
  const form = armored ? ARMORED : CLASSIC;
  const pose = !action ? IDLE : action.isSignature
    ? (action.isCharging === true ? 'charge' : action.isCharging === undefined ? 'showcase' : 'signature')
    : action.style;
  const width = armored ? Math.min(BODY_WIDTH[size], BODY_HEIGHT * 0.923) : BODY_WIDTH[size] * 0.68;
  const height = armored ? BODY_HEIGHT * 1.02 : BODY_HEIGHT * 1.15;
  const distinctColor = armored ? '#ffeea9' : '#dba2ff';
  const regionId = (i: number) => `${id}-region-${i}`;
  return (
    <svg x={(BODY_WIDTH[size] - width) / 2} y={BODY_HEIGHT - height} width={width} height={height}
      overflow="visible" viewBox="0 0 700 790" preserveAspectRatio="none" aria-hidden="true"
      data-zeruel-variant={armored ? 'armored' : 'classic'} data-zeruel-pose={pose}>
      <defs>
        <ProgressiveSvgImage id={`${id}-art`} href={form.art} x={form.x} y={form.y} width={form.w} height={form.h} />
        {form.parts.map((part, i) => (
          <clipPath key={i} id={regionId(i)} clipPathUnits="userSpaceOnUse"><path d={part.cut} /></clipPath>
        ))}
        <mask id={`${id}-body`} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x={0} y={0} width={700} height={790}>
          <rect width={700} height={790} fill="#fff" />
          {form.parts.map((part, i) => <path key={i} d={part.cut} fill="#000" stroke="#fff"
            strokeWidth={part.role === 'halo' ? 0 : part.role === 'wing' ? 4 : 3} />)}
        </mask>
      </defs>
      <g className="zeruel-back-rig">
        {form.parts.map((part, i) => part.role === 'wing' ? (
          <g key={i} data-zeruel-part={part.role} style={styleOf(part)}>
            <use href={`#${id}-art`} clipPath={`url(#${regionId(i)})`} />
          </g>
        ) : null)}
      </g>
      <g className="zeruel-core-rig">
        <use href={`#${id}-art`} mask={`url(#${id}-body)`} />
        {form.parts.map((part, i) => part.role !== 'wing' ? (
          <g key={i} data-zeruel-part={part.role} style={styleOf(part)}>
            <use href={`#${id}-art`} clipPath={`url(#${regionId(i)})`} />
            {part.role === 'halo' && <path className="zeruel-halo-shimmer" fill="none" stroke="#f4d8fe" strokeWidth={4}
              strokeLinecap="round" pathLength={254} d="M248 174 Q305 123 367 103 Q396 92 428 92" />}
          </g>
        ) : null)}
        {/* The armored halo's diffuse corona is baked into his head art.
            Leave it seamless rather than dragging a piece of its glow. */}
        {armored && <path className="zeruel-halo-shimmer" fill="none" stroke="#fff1b9" strokeWidth={2.5}
          strokeLinecap="round" pathLength={254} d="M314 223A35 10.5 0 1 0 384 223A35 10.5 0 1 0 314 223Z" />}
        {(pose === 'magic' || pose === 'signature' || pose === 'charge' || pose === 'showcase' || pose === 'support') && (
          <g className="zeruel-rite" color={distinctColor} key={pose}>
            {pose === 'support' ? (
              <path fill="none" stroke="currentColor" strokeWidth={3} strokeDasharray="56 13 5 12"
                d="M242 313Q349 211 460 312M222 359Q346 491 480 359" />
            ) : (
              <>
                <g className="zeruel-seal-left" transform={armored ? 'translate(220 307)' : 'translate(173 246)'}><Seal /></g>
                <g className="zeruel-seal-right" transform={armored ? 'translate(482 305)' : 'translate(516 248)'}><Seal /></g>
              </>
            )}
          </g>
        )}
      </g>
    </svg>
  );
};

const styleOf = ({ pivot, angle, phase }: Part): CSSProperties => ({
  transformBox: 'view-box',
  transformOrigin: `${pivot[0]}px ${pivot[1]}px`,
  '--zeruel-angle': `${angle}deg`,
  '--zeruel-phase': `${phase}s`,
} as CSSProperties);

const Seal = () => (
  <g fill="none" stroke="currentColor" strokeLinecap="round">
    <path d="M-34 0L0-34 34 0 0 34Z" strokeWidth={3} opacity={0.64} />
    <circle r="26" strokeWidth={2} strokeDasharray="30 6 9 6" />
    <path d="M0-19 4-4 19 0 4 4 0 19-4 4-19 0-4-4Z" fill="currentColor" strokeWidth={1} />
  </g>
);
