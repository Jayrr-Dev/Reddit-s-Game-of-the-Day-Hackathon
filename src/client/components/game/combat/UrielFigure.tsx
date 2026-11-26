import { useRef } from 'react';
import type { HeroSize } from '../../../../shared/game/types';
import type { HeroAction } from '../../../content/heroLooks';
import { URIEL_VIEW } from '../../../content/urielRigArt';
import { useUrielRig } from '../../../hooks/useUrielRig';
import { BODY_HEIGHT, BODY_WIDTH } from '../../../lib/heroFigure';
import { urielPoseOf } from '../../../lib/urielMotion';
import { UrielRigParts } from './UrielRigParts';

type UrielFigureProps = { size: HeroSize; action?: HeroAction | null | undefined };

/** Size 3 is her battlefield draw size; smaller sizes are still portraits. */
const BATTLE_SIZE: HeroSize = 3;

/**
 * Archangel Uriel as a live layered rig standing on the figure's
 * baseline. Vectors and full-size layers keep her sharp at any size.
 */
export const UrielFigure = ({ size, action }: UrielFigureProps) => {
  const rig = useRef<SVGSVGElement>(null);
  const pose = urielPoseOf(action);
  useUrielRig(rig, pose, size === BATTLE_SIZE);

  const width = BODY_WIDTH[size];
  const height = width * URIEL_VIEW.height / URIEL_VIEW.width;
  return (
    <svg ref={rig} y={BODY_HEIGHT - height} width={width} height={height} overflow="visible"
      viewBox={`${URIEL_VIEW.x} ${URIEL_VIEW.y} ${URIEL_VIEW.width} ${URIEL_VIEW.height}`} data-uriel-pose={pose}>
      <UrielRigParts />
    </svg>
  );
};
