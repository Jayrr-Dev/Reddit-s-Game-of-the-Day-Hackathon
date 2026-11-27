import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { mikhaelCelAt, mikhaelSwordClip, MIKHAEL_SWORD_DURATION_MS, type MikhaelAttackClip } from '../../../content/mikhaelMotion';
import type { HeroAction } from '../../../content/heroLooks';
import type { HeroSize } from '../../../../shared/game/types';
import { BODY_WIDTH } from '../../../lib/heroFigure';
import { loadFullImage } from '../../../lib/imagePlaceholders';
import { useProgressiveImage } from '../../../hooks/useProgressiveImage';
import { ProgressiveSvgImage } from '../../ui/ProgressiveImage';
import down from '../../../assets/heroes/mikhael-rig-downward-slash.webp';
import up from '../../../assets/heroes/mikhael-rig-upward-slash.webp';
import backhand from '../../../assets/heroes/mikhael-rig-backhand-sweep.webp';
import thrust from '../../../assets/heroes/mikhael-rig-charge-thrust.webp';
import idle from '../../../assets/heroes/mikhael-rig-idle.webp';
import idleWind from '../../../assets/heroes/mikhael-rig-idle-wind.webp';
import rally from '../../../assets/heroes/mikhael-rig-rally.webp';

// --- ATLAS GEOMETRY ---
const FRAMES: Record<MikhaelAttackClip, string> = { downward: down, upward: up, backhand, thrust };
const RIG_IMAGES = [idle, idleWind, rally, ...Object.values(FRAMES)] as const;
const CELL_W = 704;
const CELL_H = 396;
const COLS = 4;
const ROWS = 3;
const RIG_WIDTH_SHARE = 1.74;
const GROUND = 98;
const FOOT_SHARE = 0.932;
// The source sword cels have a dark oval below the boots. Key it out
// only in the foot strip; the separate floor shadow stays put.
const FOOT_STRIP_Y = 332;

/** Advances a cached texture through its authored cels without redrawing the stage. */
function MikhaelAttackAtlas({ clip }: { clip: MikhaelAttackClip }) {
  const art = useProgressiveImage(FRAMES[clip]);
  const [cel, setCel] = useState(0);
  useEffect(() => {
    if (art.isPlaceholder || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let handle: number;
    const started = performance.now();
    const draw = (now: number) => {
      const elapsed = now - started;
      setCel(mikhaelCelAt(elapsed));
      if (elapsed < MIKHAEL_SWORD_DURATION_MS) handle = requestAnimationFrame(draw);
    };
    handle = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(handle);
  }, [art.isPlaceholder, clip]);
  if (art.isPlaceholder) return <ProgressiveSvgImage href={idle} width={CELL_W} height={CELL_H} />;
  return <g data-mikhael-cel={cel}>
    <image href={art.src} width={CELL_W * COLS} height={CELL_H * ROWS}
      x={-(cel % COLS) * CELL_W} y={-Math.floor(cel / COLS) * CELL_H} preserveAspectRatio="none" />
  </g>;
}

// --- IDLE WIND ---
const IDLE_COLUMNS = 5;
const IDLE_ROWS = 5;
const IDLE_CELS = 24;
const IDLE_BEAT_MS = 3200 / IDLE_CELS;
// The wind atlas is pre-baked so it can play as a single moving image:
// - the sword and greaves are pasted from the still idle pose into every cel,
//   so only cloth, hair and wings sway (sword outline in 704x396 cel space:
//   M298 250 306 233 321 233 322 262 320 272 310 275 278 358 268 358 293 274
//   289 268 288 257Z, greaves: M331 283 352 283 354 330 366 333 368 372 330 372Z);
// - the dark oval under the boots is already keyed out, like KeyedPose does live.
// Doing that live each frame (two <use> copies, a clip and a filter) made it lag.
// The cels are only 7.5 per second, which read as choppy. Like Uriel's rig,
// the loop runs on requestAnimationFrame and writes attributes directly (no
// React render per frame), cross-fading each cel into the next so the sway
// moves at the display's frame rate. The second cel is added with
// plus-lighter inside an isolated group: (1 - t)·A + t·B in premultiplied
// alpha, so the opaque body never turns see-through mid-fade.

/** Moves an atlas image to show one cel. */
const showCel = (image: SVGImageElement, cel: number): void => {
  image.setAttribute('x', String(-(cel % IDLE_COLUMNS) * CELL_W));
  image.setAttribute('y', String(-Math.floor(cel / IDLE_COLUMNS) * CELL_H));
};

/** Plays the wing, cloth and hair cels, with the sword and boots held still. */
function MikhaelIdleWind() {
  const art = useProgressiveImage(idleWind);
  const fromCel = useRef<SVGImageElement>(null);
  const toCel = useRef<SVGImageElement>(null);
  useEffect(() => {
    const from = fromCel.current;
    const to = toCel.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (art.isPlaceholder || !from || !to || reduced.matches) return;
    const started = performance.now();
    let handle = 0;
    const draw = (now: number) => {
      const beat = ((now - started) / IDLE_BEAT_MS) % IDLE_CELS;
      const cel = Math.floor(beat);
      const blend = beat - cel;
      showCel(from, cel);
      showCel(to, (cel + 1) % IDLE_CELS);
      from.setAttribute('opacity', String(1 - blend));
      to.setAttribute('opacity', String(blend));
      handle = requestAnimationFrame(draw);
    };
    handle = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(handle);
  }, [art.isPlaceholder]);
  if (art.isPlaceholder) return <KeyedPose><ProgressiveSvgImage href={idle} width={CELL_W} height={CELL_H} /></KeyedPose>;
  return <g data-mikhael-idle-wind style={{ isolation: 'isolate' }}>
    <image ref={fromCel} href={art.src} width={CELL_W * IDLE_COLUMNS} height={CELL_H * IDLE_ROWS} preserveAspectRatio="none" />
    <image ref={toCel} href={art.src} width={CELL_W * IDLE_COLUMNS} height={CELL_H * IDLE_ROWS} preserveAspectRatio="none"
      opacity={0} style={{ mixBlendMode: 'plus-lighter' }} />
  </g>;
}

// --- RALLY ---
/**
 * Raises the sword hand. Until the full drawing is decoded it holds the
 * still idle pose: the 20 px placeholder of a mostly transparent sprite
 * blurs into a faint smear, which made him seem to vanish for a second.
 */
function MikhaelRally() {
  const art = useProgressiveImage(rally);
  return <ProgressiveSvgImage href={art.isPlaceholder ? idle : rally} width={CELL_W} height={CELL_H} />;
}

// --- FOOT KEYING ---
/** Draws a raw pose with the dark oval below the boots keyed out. */
function KeyedPose({ children }: { children: ReactNode }) {
  const poseId = useId();
  return <>
    <defs>
      <g id={poseId}>{children}</g>
      <clipPath id={`${poseId}-upper`}>
        <rect width={CELL_W} height={FOOT_STRIP_Y} />
      </clipPath>
      <filter id={`${poseId}-boots`} filterUnits="userSpaceOnUse"
        x={0} y={FOOT_STRIP_Y} width={CELL_W} height={CELL_H - FOOT_STRIP_Y}
        colorInterpolationFilters="sRGB">
        <feColorMatrix in="SourceGraphic" result="bootMask" type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  8 8 0 0 -.95" />
        <feComposite in="SourceGraphic" in2="bootMask" operator="in" />
      </filter>
    </defs>
    <use href={`#${poseId}`} clipPath={`url(#${poseId}-upper)`} />
    <use href={`#${poseId}`} filter={`url(#${poseId}-boots)`} />
  </>;
}

/** Draws the registered sword rig with its pinned wings, halo and accent frames. */
export function MikhaelSwordRig({ size, action }: { size: HeroSize; action?: HeroAction | null | undefined }) {
  const clip = mikhaelSwordClip(action);
  const width = BODY_WIDTH[size] * RIG_WIDTH_SHARE;
  const height = width * CELL_H / CELL_W;
  useEffect(() => {
    // Start every pose's download at once: his opening hand-raise (rally) can
    // play right as the fight starts, before a delayed preload would finish.
    RIG_IMAGES.forEach((src) => { void loadFullImage(src); });
  }, []);
  return <g className="mikhael-sword-responsive" style={{ transformOrigin: BODY_WIDTH[size] / 2 + 'px ' + GROUND + 'px' }}>
  <svg data-mikhael-motion={clip} data-mikhael-weapon="sword" pointerEvents="none"
    x={(BODY_WIDTH[size] - width) / 2} y={GROUND - height * FOOT_SHARE} width={width} height={height}
    viewBox={'0 0 ' + CELL_W + ' ' + CELL_H} overflow="hidden" preserveAspectRatio="none">
    {clip === 'idle' ? <MikhaelIdleWind /> : <KeyedPose>{clip === 'rally'
      ? <MikhaelRally />
      : <MikhaelAttackAtlas key={clip} clip={clip} />}</KeyedPose>}
  </svg></g>;
}
