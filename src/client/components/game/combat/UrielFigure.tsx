import { useEffect, useRef, useState } from 'react';
import atlas from '../../../assets/heroes/archangels/uriel-motion-atlas.webp';
import still from '../../../assets/heroes/archangels/uriel-motion-still.webp';
import type { HeroSize } from '../../../../shared/game/types';
import type { HeroAction } from '../../../content/heroLooks';
import { BODY_HEIGHT, BODY_WIDTH } from '../../../lib/heroFigure';
import { URIEL_ATLAS, urielPlayback, urielPoseOf } from '../../../lib/urielMotion';
import { ProgressiveSvgImage } from '../../ui/ProgressiveImage';

type UrielFigureProps = { size: HeroSize; action?: HeroAction | null | undefined };

/** Moves one clipped image layer; the SVG viewport and battle layout stay fixed. */
export const UrielFigure = ({ size, action }: UrielFigureProps) => {
  const sprite = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const pose = urielPoseOf(action);
  const { columns, rows, width, height } = URIEL_ATLAS;
  const drawHeight = BODY_WIDTH[size] * height / width;
  // Training portraits use her one-cell size; battlefield props use the boss draw size.
  const isBattleSize = size === 3;

  useEffect(() => {
    const image = sprite.current;
    if (!loaded || !image || typeof image.animate !== 'function') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animation: Animation | undefined;
    const start = () => {
      animation?.cancel();
      if (reduced.matches) return;
      const { frames, duration, loop } = urielPlayback(pose);
      animation = image.animate(frames, {
        duration,
        iterations: loop ? Infinity : 1,
        fill: 'both',
      });
    };
    start();
    reduced.addEventListener('change', start);
    return () => {
      animation?.cancel();
      reduced.removeEventListener('change', start);
    };
  }, [isBattleSize, loaded, pose]);

  const y = BODY_HEIGHT - drawHeight;
  if (!isBattleSize) {
    return <ProgressiveSvgImage href={still} width={BODY_WIDTH[size]} height={drawHeight} y={y} />;
  }
  return (
    <foreignObject width={BODY_WIDTH[size]} height={drawHeight} y={y} data-uriel-pose={pose}>
      <div className="relative h-full w-full overflow-hidden"
        style={{ background: loaded ? undefined : 'url("' + still + '") center / 100% 100% no-repeat' }}>
        <img
          ref={sprite}
          src={atlas}
          onLoad={() => setLoaded(true)}
          alt=""
          draggable={false}
          className="pointer-events-none absolute left-0 top-0 max-w-none motion-safe:will-change-transform"
          style={{ width: `${columns * 100}%`, height: `${rows * 100}%` }}
        />
      </div>
    </foreignObject>
  );
};
