import { useEffect, useRef } from 'react';
import atlas from '../../../assets/heroes/archangels/uriel-motion-atlas.webp';
import type { HeroSize } from '../../../../shared/game/types';
import type { HeroAction } from '../../../content/heroLooks';
import { BODY_HEIGHT, BODY_WIDTH } from '../../../lib/heroFigure';
import { URIEL_ATLAS, urielFrameAt, urielFrameBox, urielPoseOf } from '../../../lib/urielMotion';
import { ProgressiveSvgImage } from '../../ui/ProgressiveImage';

type UrielFigureProps = { size: HeroSize; action?: HeroAction | null | undefined };

/** Plays the approved wing, halo, ribbon and sword rig on the existing combat action cues. */
export const UrielFigure = ({ size, action }: UrielFigureProps) => {
  const viewport = useRef<SVGSVGElement>(null);
  const pose = urielPoseOf(action);
  const { columns, rows, width, height } = URIEL_ATLAS;

  const drawHeight = BODY_WIDTH[size] * height / width;

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let handle = 0;
    let previous = -1;
    const update = (index: number) => {
      if (index !== previous) node.setAttribute('viewBox', urielFrameBox(index));
      previous = index;
    };
    const start = () => {
      window.cancelAnimationFrame(handle);
      if (reduced.matches) { update(0); return; }
      const began = performance.now();
      const tick = (timestamp: number) => {
        const elapsed = timestamp - began;
        update(urielFrameAt(pose, elapsed));
        if (pose === 'hover' || elapsed < 650) handle = window.requestAnimationFrame(tick);
      };
      update(urielFrameAt(pose, 0));
      handle = window.requestAnimationFrame(tick);
    };
    start();
    reduced.addEventListener('change', start);
    return () => {
      window.cancelAnimationFrame(handle);
      reduced.removeEventListener('change', start);
    };
  }, [pose]);

  return (
    <svg
      ref={viewport}
      width={BODY_WIDTH[size]}
      y={BODY_HEIGHT - drawHeight}
      height={drawHeight}
      viewBox={urielFrameBox(0)}
      preserveAspectRatio="xMidYMax meet"
      overflow="hidden"
      data-uriel-pose={pose}
    >
      <ProgressiveSvgImage href={atlas} width={width * columns} height={height * rows} />
    </svg>
  );
};
