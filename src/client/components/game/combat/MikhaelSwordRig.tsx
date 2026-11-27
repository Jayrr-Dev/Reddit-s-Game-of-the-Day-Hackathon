import { useEffect, useId, useState } from 'react';
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
const CELL_W = 704;
const CELL_H = 396;
const COLS = 4;
const ROWS = 3;
const RIG_WIDTH_SHARE = 1.74;
const GROUND = 98;
const FOOT_SHARE = 0.932;
// The source sword cels have a dark oval below the boots. Key it out
// only in the foot strip; the separate World/Floor shadow stays put.
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

/** Plays the planted body's wing, fabric and hair cels at the held animation cadence. */
function MikhaelIdleWind() {
  const art = useProgressiveImage(idleWind);
  const [cel, setCel] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (art.isPlaceholder || reduced.matches) return;
    const started = performance.now();
    const tick = () => {
      if (document.visibilityState === 'visible' && !reduced.matches)
        setCel(Math.floor((performance.now() - started) / IDLE_BEAT_MS) % IDLE_CELS);
    };
    const timer = window.setInterval(tick, IDLE_BEAT_MS);
    return () => window.clearInterval(timer);
  }, [art.isPlaceholder]);
  if (art.isPlaceholder) return <ProgressiveSvgImage href={idle} width={CELL_W} height={CELL_H} />;
  return <g data-mikhael-idle-cel={cel}>
    <image href={art.src} width={CELL_W * IDLE_COLUMNS} height={CELL_H * IDLE_ROWS}
      x={-(cel % IDLE_COLUMNS) * CELL_W} y={-Math.floor(cel / IDLE_COLUMNS) * CELL_H} preserveAspectRatio="none" />
  </g>;
}

/** Draws the registered sword rig with its pinned wings, halo and accent frames. */
export function MikhaelSwordRig({ size, action }: { size: HeroSize; action?: HeroAction | null | undefined }) {
  const poseId = useId();
  const clip = mikhaelSwordClip(action);
  const width = BODY_WIDTH[size] * RIG_WIDTH_SHARE;
  const height = width * CELL_H / CELL_W;
  useEffect(() => {
    const timer = window.setTimeout(() => { Object.values(FRAMES).forEach((src) => { void loadFullImage(src); }); }, 300);
    return () => window.clearTimeout(timer);
  }, []);
  return <g className="mikhael-sword-responsive" style={{ transformOrigin: BODY_WIDTH[size] / 2 + 'px ' + GROUND + 'px' }}>
  <svg data-mikhael-motion={clip} data-mikhael-weapon="sword" pointerEvents="none"
    x={(BODY_WIDTH[size] - width) / 2} y={GROUND - height * FOOT_SHARE} width={width} height={height}
    viewBox={'0 0 ' + CELL_W + ' ' + CELL_H} overflow="hidden" preserveAspectRatio="none">
    <defs>
      <g id={poseId}>
        {clip === 'idle' ? <MikhaelIdleWind /> : clip === 'rally'
          ? <ProgressiveSvgImage href={rally} width={CELL_W} height={CELL_H} />
          : <MikhaelAttackAtlas key={clip} clip={clip} />}
      </g>
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
  </svg></g>;
}
