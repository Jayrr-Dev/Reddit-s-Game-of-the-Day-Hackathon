import { useEffect, useState } from 'react';
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

/** Draws the registered sword rig with its pinned wings, halo and accent frames. */
export function MikhaelSwordRig({ size, action }: { size: HeroSize; action?: HeroAction | null | undefined }) {
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
    {clip === 'idle' || clip === 'rally'
      ? <ProgressiveSvgImage href={clip === 'rally' ? rally : idle} width={CELL_W} height={CELL_H} />
      : <MikhaelAttackAtlas key={clip} clip={clip} />}
  </svg></g>;
}
