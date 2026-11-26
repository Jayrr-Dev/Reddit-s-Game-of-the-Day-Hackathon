import { useId, type CSSProperties, type ReactNode } from 'react';
import type { HeroAction } from '../../../content/heroLooks';
import geonosisArt from '../../../assets/heroes/grandangel-geonosis.webp';
import zadkielArt from '../../../assets/heroes/zadkiel-of-dominations.webp';
import './grandangel-gz-rigs.css';

type RigProps = { action?: HeroAction | null | undefined };
type Part = { key: string; outline: string; pivot: [number, number]; holes?: readonly string[]; mirror?: boolean };
type Artwork = { href: string; height: number; x: number; y: number; width: number; screenHeight: number };

// Mask coordinates are traced against the shipped art, expressed at 750 px
// width. Everything samples the same original texture, so color/faceting
// remain unchanged rather than substituting a redraw.
const G_ART: Artwork = { href: geonosisArt, height: 750, x: 17, y: -19, width: 116, screenHeight: 116 };
const G_BODY = 'M375 207 409 259 422 290 448 301 505 311 509 363 468 394 432 399 460 478 470 750H277L285 564 319 423 319 396 282 393 241 362 250 307 324 296 344 260Z';
const G_ARM_L = 'M248 315 267 311 296 338 318 349 370 327 391 337 410 357 389 371 368 372 337 381 309 390 286 379 267 358Z';
const G_ARM_R = 'M501 313 481 313 455 340 437 349 389 337 368 339 337 350 333 369 364 380 393 372 413 384 440 391 462 375 483 350Z';
const G_TRAIL = 'M333 428 375 445 415 426 466 750H281Z';
const G_CORE_HOLES = [G_ARM_L, G_ARM_R, G_TRAIL] as const;
const G_WING_CUTS = [G_BODY, G_ARM_L, G_ARM_R, G_TRAIL] as const;
const G_PARTS: readonly Part[] = [
  { key: 'wing-l', outline: 'M0 0H375V750H0Z', holes: G_WING_CUTS, pivot: [283, 316] },
  { key: 'wing-r', outline: 'M375 0H750V750H375Z', holes: G_WING_CUTS, pivot: [467, 316] },
  { key: 'trail', outline: G_TRAIL, pivot: [375, 438] },
  { key: 'core', outline: G_BODY, holes: G_CORE_HOLES, pivot: [375, 317] },
  { key: 'arm-r', outline: G_ARM_R, holes: [G_ARM_L], pivot: [482, 328] },
  { key: 'arm-l', outline: G_ARM_L, pivot: [266, 329] },
];

const Z_ART: Artwork = { href: zadkielArt, height: 530.684, x: -4, y: -14, width: 158, screenHeight: 111 };
const Z_BODY = 'M359 70 391 70 403 100 393 127 408 135 427 142 421 171 410 190 414 219 421 254 419 320 412 378 404 426 411 483 384 489 375 472 366 489 339 483 346 426 338 378 332 320 329 254 336 219 340 190 329 171 323 142 342 135 357 127 347 101Z';
const Z_HALO = 'M315 29H435V144H400L389 126 403 99 390 74H360L347 99 361 126 350 144H315Z';
const Z_ARM_L = 'M329 146 347 153 344 173 335 194 322 211 282 235 268 249 250 249 239 241 245 232 265 226 286 208 313 181 319 157Z';
const Z_ARM_R = 'M421 146 403 153 406 173 415 194 428 211 468 235 482 249 500 249 511 241 505 232 485 226 464 208 437 181 431 157Z';
const Z_TRAIL_L = 'M330 233 344 239 330 321 328 359 295 388 284 418 291 452 249 502 244 479 263 445 257 415 258 391 271 373 302 359 303 327Z';
const Z_TRAIL_R = 'M420 233 406 239 420 321 422 359 455 388 466 418 459 452 501 502 506 479 487 445 493 415 492 391 479 373 448 359 447 327Z';
const Z_TRAIL_C = 'M363 218 394 221 393 272 386 328 376 371 351 421 329 457 344 475 346 489 318 530 315 505 321 484 295 455 303 423 333 379 352 327Z';
const Z_FRONT = [Z_BODY, Z_ARM_L, Z_ARM_R, Z_HALO, Z_TRAIL_L, Z_TRAIL_R, Z_TRAIL_C] as const;
const Z_WINGS = [
  { outline: 'M0 0H375V184L334 184 320 176 306 185 268 186 247 180 217 172 143 179 0 177Z', left: [330, 152], right: [420, 152] },
  { outline: 'M0 177 143 179 217 172 247 180 268 186 306 185 320 176 334 184 375 184V242L326 253 296 264 246 268 213 278 180 288 143 282 0 282Z', left: [333, 195], right: [417, 195] },
  { outline: 'M0 282 143 282 180 288 213 278 246 268 296 264 326 253 375 242V530.684H0Z', left: [339, 243], right: [411, 243] },
] as const;
const Z_PARTS: readonly Part[] = [
  ...Z_WINGS.flatMap(({ outline, left, right }, i): Part[] => [
    { key: `bank-${i}-l`, outline, holes: Z_FRONT, pivot: [...left] },
    { key: `bank-${i}-r`, outline, holes: Z_FRONT, pivot: [...right], mirror: true },
  ]),
  { key: 'halo', outline: Z_HALO, pivot: [375, 91] },
  { key: 'trail-l', outline: Z_TRAIL_L, holes: [Z_ARM_L, Z_ARM_R], pivot: [328, 252] },
  { key: 'trail-r', outline: Z_TRAIL_R, holes: [Z_ARM_L, Z_ARM_R], pivot: [422, 252] },
  { key: 'core', outline: Z_BODY, holes: [Z_TRAIL_C, Z_TRAIL_L, Z_TRAIL_R, Z_ARM_L, Z_ARM_R], pivot: [375, 160] },
  { key: 'trail-c', outline: Z_TRAIL_C, pivot: [376, 244] },
  { key: 'arm-l', outline: Z_ARM_L, pivot: [332, 158] },
  { key: 'arm-r', outline: Z_ARM_R, pivot: [418, 158] },
];

function ArticulatedAngel({ art, parts, variant, action, children, braces }: {
  art: Artwork;
  parts: readonly Part[];
  variant: 'geonosis' | 'zadkiel';
  action: HeroAction | null | undefined;
  children: ReactNode;
  braces: ReactNode;
}) {
  const id = useId();
  const charging = action?.isCharging;
  const clip = action?.isSignature
    ? charging === true ? 'charge' : charging === false ? 'release' : 'showcase'
    : action?.style ?? 'idle';
  return (
    <svg className="gz-rig" data-gz-angel={variant} data-gz-clip={clip}
      data-grandangel-geonosis={variant === 'geonosis' ? '' : undefined}
      data-zadkiel-of-dominations={variant === 'zadkiel' ? '' : undefined}
      x={art.x} y={art.y} width={art.width} height={art.screenHeight}
      viewBox={`0 0 750 ${art.height}`} overflow="visible">
      <defs>
        <image id={`${id}-painting`} href={art.href} x={0} y={0} width={750} height={art.height} />
        {parts.map((part) => (
          <mask key={part.key} id={`${id}-${part.key}`} x={0} y={0} width={750} height={art.height}
            maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <path d={part.outline} fill="white" transform={part.mirror ? 'translate(750 0) scale(-1 1)' : undefined} />
            {part.holes?.map((d) => <path key={d} d={d} fill="black" />)}
          </mask>
        ))}
      </defs>
      <use className="gz-still" href={`#${id}-painting`} />
      <g className="gz-layers">
        <g className="gz-braces">{braces}</g>
        {parts.map((part) => (
          <g key={part.key} data-gz-part={part.key} className="gz-pivot"
            style={{ '--gz-pivot': `${part.pivot[0]}px ${part.pivot[1]}px` } as CSSProperties}>
            <use href={`#${id}-painting`} mask={`url(#${id}-${part.key})`} />
          </g>
        ))}
        <g key={clip} className="gz-fx">{children}</g>
      </g>
    </svg>
  );
}

const iceShard = 'M0-19 7-4 4 12 0 20-5 7-7-4Z';

export const GeonosisRigFigure = ({ action }: RigProps) => (
  <ArticulatedAngel art={G_ART} parts={G_PARTS} variant="geonosis" action={action} braces={
    <>
      <path d="M252 323 269 310 307 316 375 332 443 316 481 310 498 323 477 359 441 375 414 392 375 402 336 392 309 375 273 359Z" fill="#354965" />
      <path d="M264 326 292 334 320 346 375 357 430 346 458 334 486 326 461 354 424 366 375 383 326 366 289 354Z" fill="#576d88" />
      <path d="M273 350 308 363 329 383 306 375 282 366Z M477 350 442 363 421 383 444 375 468 366Z" fill="#49617d" />
    </>
  }>
    <g className="gz-release" fill="#daf7ff">
      <path d="m375 286 15 33-15 36-15-36Z" fill="#f6feff" />
      <ellipse cx={375} cy={322} rx={119} ry={44} fill="none" stroke="#acf0ff" strokeWidth={4} strokeDasharray="28 9 5 7" />
      {[[269, 304, -42], [315, 274, -22], [435, 274, 22], [481, 304, 42]].map(([x, y, a]) => (
        <path key={x} d={iceShard} transform={`translate(${x} ${y}) rotate(${a})`} />
      ))}
    </g>
    <g className="gz-ward" fill="none" stroke="#c8efff" strokeWidth={4}>
      <path d="M375 273 466 310 466 367 432 408 375 444 318 408 284 367 284 310Z" />
      <path d="M375 287 451 319V360L423 396 375 428 327 396 299 360V319Z" strokeDasharray="11 10" />
    </g>
  </ArticulatedAngel>
);

export const ZadkielRigFigure = ({ action }: RigProps) => (
  <ArticulatedAngel art={Z_ART} parts={Z_PARTS} variant="zadkiel" action={action} braces={
    <>
      <path d="M309 142 352 145 375 159 398 145 441 142 426 175 425 195 414 223 375 258 336 223 325 195 324 175Z" fill="#72778c" />
      <path d="M310 149 333 151 331 172 316 170 304 179 307 163Z M440 149 417 151 419 172 434 170 446 179 443 163Z" fill="#c2b7a8" />
      <path d="M308 177 322 169 334 176 337 195 325 205 308 212 310 197 299 201Z M442 177 428 169 416 176 413 195 425 205 442 212 440 197 451 201Z" fill="#dbd0b6" />
      <path d="M328 159 343 160 340 184 330 194 321 188Z M422 159 407 160 410 184 420 194 429 188Z" fill="#8c90a3" />
    </>
  }>
    <g className="gz-release" fill="none" stroke="#ffde8a" strokeWidth={4}>
      <path d="M310 96Q375 43 440 96Q375 147 310 96Z" />
      <path d="M375 75 387 96 375 117 363 96Z" fill="#fff1bd" />
      <path d="M226 197H248M502 197H524M235 104H259M491 104H515M227 289H250M500 289H523" strokeLinecap="round" />
    </g>
    <g className="gz-ward" fill="none" stroke="#f6dc9e" strokeWidth={4}>
      <ellipse cx={375} cy={237} rx={111} ry={56} strokeDasharray="19 9 3 9" />
      <path d="m375 189 30 48-30 48-30-48Z" />
    </g>
  </ArticulatedAngel>
);
