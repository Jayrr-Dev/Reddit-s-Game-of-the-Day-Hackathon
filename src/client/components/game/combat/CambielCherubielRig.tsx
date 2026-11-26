import { useId, type CSSProperties, type ReactNode } from 'react';
import cambielArt from '../../../assets/heroes/grandangel-cambiel.webp';
import cherubielArt from '../../../assets/heroes/grandangel-cherubiel.webp';
import type { HeroAction } from '../../../content/heroLooks';
import { ProgressiveSvgImage } from '../../ui/ProgressiveImage';
import './cambiel-cherubiel-rig.css';

type RigProps = { action?: HeroAction | null | undefined };
type SliceProps = {
  source: string;
  name: string;
  path: string;
  x: number;
  y: number;
  children?: ReactNode;
  omit?: string;
};

const Sliver = ({ source, name, path, x, y, children, omit }: SliceProps) => {
  const cut = useId();
  const mask = useId();
  return <>
    <defs><clipPath id={cut}><path d={path} fillRule="evenodd" clipRule="evenodd" /></clipPath>{omit && <mask id={mask} maskUnits="userSpaceOnUse" x={0} y={0} width={700} height={700}><rect width={700} height={700} fill="white" /><path d={omit} fill="black" /></mask>}</defs>
    <g className={`grandangel-rig-part gar-${name}`} style={{ '--gar-pivot': `${x}px ${y}px` } as CSSProperties}>
      <use href={`#${source}`} clipPath={`url(#${cut})`} mask={omit ? `url(#${mask})` : undefined} />
      {children}
    </g>
  </>;
};

const clipOf = (action?: HeroAction | null) =>
  !action ? 'idle' : action.isSignature ? (action.isCharging ? 'charge' : 'signature') : action.style === 'support' ? 'guard' : action.style === 'melee' ? 'melee' : 'cast';

const CAM_WING_L = 'M 0,0 H 325 V 180 L 306,193 288,218 274,248 265,268 211,275 159,358 168,546 H 0 Z';
const CAM_WING_R = 'M 700,0 H 376 V 178 L 395,193 408,222 429,251 439,269 488,274 519,356 516,560 H 700 Z';
const CAM_TAIL = 'M 326,384 L 370,389 381,447 403,479 429,518 448,549 435,578 419,585 411,550 389,538 397,577 386,617 351,668 305,686 320,646 351,611 362,572 361,545 343,511 324,472 Z';
const CAM_LEFT = 'M 282,244 L 315,252 321,283 305,321 267,360 249,406 246,451 268,474 307,487 324,509 324,533 306,509 282,492 239,479 217,456 215,430 230,389 231,357 249,319 231,320 203,338 182,367 187,385 201,401 174,391 165,372 169,344 190,317 232,287 251,272 Z';
const CAM_RIGHT = 'M 392,235 L 424,244 444,266 466,282 499,305 518,334 520,355 496,377 505,353 495,336 469,314 441,300 420,288 425,321 459,376 468,414 454,438 413,463 421,439 444,414 441,391 412,354 385,313 Z';
// The core overlays the feather and ribbon roots so they stay pinned in extreme poses.
const CAM_CORE = 'M 352,132 L 396,155 419,185 430,218 447,245 435,275 429,294 431,331 415,373 389,377 388,415 362,454 343,480 319,427 308,406 294,371 296,332 269,287 258,253 276,216 298,188 315,163 Z';

export function CambielRigFigure({ action }: RigProps) {
  const source = useId();
  const clip = clipOf(action);
  return <svg className="grandangel-part-rig cambiel-part-rig" data-grandangel-cambiel="" data-gar-clip={clip}
    x={24} y={-7} width={102} height={103} overflow="visible" viewBox="0 0 700 700">
    <defs><ProgressiveSvgImage id={source} href={cambielArt} x={0} y={0} width={700} height={700} /></defs>
    <g className="gar-ambient">
      <g className="gar-action" key={clip}>
        <Sliver source={source} name="left-wing" path={CAM_WING_L} omit={CAM_LEFT} x={300} y={197} />
        <Sliver source={source} name="right-wing" path={CAM_WING_R} omit={CAM_RIGHT} x={395} y={197} />
        <Sliver source={source} name="ribbon-left" path={CAM_LEFT} x={282} y={267} />
        <Sliver source={source} name="ribbon-right" path={CAM_RIGHT} x={423} y={268} />
        <Sliver source={source} name="tail" path={CAM_TAIL} x={349} y={405} />
        <Sliver source={source} name="core" path={CAM_CORE} x={351} y={226} />
        <path className="gar-sigil" d="m336 185 14 5 14-5-14 29z" fill="#fff3c1" />
        <g className="gar-eclipse" fill="none" stroke="#e6ba64">
          <circle cx="350" cy="203" r="116" strokeWidth="2.5" strokeDasharray="26 42 5 14" />
          <circle cx="350" cy="203" r="128" strokeWidth="5" strokeDasharray="106 74" />
        </g>
        <path className="gar-arc" d="M515 192c-74 164-208 235-357 249 135 31 278-56 357-249Z" fill="#eaca8c" />
      </g>
    </g>
  </svg>;
}

const CHERUB_LEFT = 'M 0 140 H 120 L 182 223 202 258 273 331 295 375 268 423 278 484 220 555 0 591 Z';
const CHERUB_RIGHT = 'M 700 140 H 602 L 548 199 515 254 494 292 428 331 410 375 435 422 415 489 500 600 H 700 Z';
const CHERUB_CROWN_L = 'M 210 0 H 341 L 342 281 282 326 226 282 207 237 233 202 210 162 Z';
const CHERUB_CROWN_R = 'M 356 0 H 513 L 484 155 465 195 483 267 419 330 360 288 Z';
const CHERUB_RIBBON_L = 'M 244 446 L 291 461 285 501 288 561 282 640 222 651 192 619 191 539 Z';
const CHERUB_RIBBON_R = 'M 410 435 L 436 466 447 524 501 533 505 625 433 638 412 611 405 552 386 537 Z';
const CHERUB_BODY = 'M350 243 386 270 439 305 473 351 539 352 553 397 483 411 519 424 613 415 609 492 515 501 475 468 443 436 421 451 418 536 391 572 381 636 366 700 322 700 304 613 306 562 277 549 267 486 218 457 202 429 222 401 158 385 151 348 229 349 266 313 301 287 320 256Z';

const CHERUB_ARM_L = 'M153 352 177 355 175 347 194 356 194 350 225 367 254 382 286 390 284 413 251 416 226 391 188 390 165 378Z';
const CHERUB_ARM_R = 'M405 394 437 386 475 371 495 354 511 349 507 357 526 350 519 359 540 354 546 374 515 391 477 394 450 420 421 416Z';
const CHERUB_SIDE_CURL = 'M428 405 469 405 504 422 532 454 566 457 581 445 560 444 556 455 537 444 537 434 572 413 606 432 613 461 588 486 531 481 493 467 468 434 431 425Z';
// Trace the existing gold arc separately from its overlapping feathers.
const CHERUB_LEFT_HALO = 'M194,219 191,219 186,228 176,256 177,261 188,285 190,285 193,262 201,241 201,235Z M238,169 234,169 214,188 198,209 197,213 204,229 207,229 223,204 242,185 242,181Z M329,129 314,132 315,148 337,144 337,141Z';
const CHERUB_RIGHT_HALO = 'M340,128 340,132 346,143 364,144 375,147 381,147 381,132 380,131 361,128Z M460,170 456,181 456,188 469,201 481,219 485,220 492,208 492,204 480,188 462,170Z M496,215 487,227 487,231 492,241 497,257 500,275 499,304 502,304 511,281 516,272 517,267 509,234 500,215Z';
export function CherubielRigFigure({ action }: RigProps) {
  const source = useId();
  const clip = clipOf(action);
  return <svg className="grandangel-part-rig cherubiel-part-rig" data-grandangel-cherubiel="" data-gar-clip={clip}
    x={15} y={-24} width={120} height={120} overflow="visible" viewBox="0 0 700 700">
    <defs><ProgressiveSvgImage id={source} href={cherubielArt} x={0} y={0} width={700} height={700} /></defs>
    <g className="gar-ambient">
      <g className="gar-cherub-halo" fill="none" stroke="#937d4e">
        <circle cx="349" cy="303" r="165" strokeWidth="13" strokeDasharray="89 12 134 12 86 12 169 12 176 12 136 12 137 38" />
      </g>
      <g className="gar-action" key={clip}>
        <Sliver source={source} name="left-wing" path={CHERUB_LEFT} omit={CHERUB_ARM_L + CHERUB_LEFT_HALO} x={277} y={374} />
        <Sliver source={source} name="right-wing" path={CHERUB_RIGHT} omit={CHERUB_ARM_R + CHERUB_SIDE_CURL + CHERUB_RIGHT_HALO} x={423} y={375} />
        <Sliver source={source} name="crown-left" path={CHERUB_CROWN_L} omit={CHERUB_LEFT_HALO} x={320} y={306} />
        <Sliver source={source} name="crown-right" path={CHERUB_CROWN_R} omit={CHERUB_RIGHT_HALO} x={379} y={306} />
        <Sliver source={source} name="ribbon-left" path={CHERUB_RIBBON_L} x={266} y={472} />
        <Sliver source={source} name="ribbon-right" path={CHERUB_RIBBON_R} x={420} y={485} />
        <Sliver source={source} name="core" path={CHERUB_BODY} x={350} y={370} />
        <g className="gar-cherub-light" fill="#fff4cf">
          <ellipse cx="350" cy="272" rx="11" ry="17" />
          <ellipse cx="319" cy="293" rx="8" ry="11" />
          <ellipse cx="380" cy="294" rx="8" ry="11" />
          <ellipse cx="304" cy="315" rx="6" ry="8" />
          <ellipse cx="395" cy="314" rx="6" ry="8" />
        </g>
        <g className="gar-eclipse" fill="none" stroke="#eee1b5">
          <circle cx="349" cy="303" r="193" strokeWidth="2" strokeDasharray="7 10" />
          <circle cx="349" cy="303" r="211" strokeWidth="5" strokeDasharray="65 112" />
        </g>
      </g>
    </g>
  </svg>;
}
