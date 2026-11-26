import { useEffect, useState } from 'react';
import type { HeroAction, WolfAttack } from '../../../content/heroLooks';
import type { HeroSize } from '../../../../shared/game/types';
import { BODY_HEIGHT, BODY_WIDTH } from '../../../lib/heroFigure';
import ivoryIdle from '../../../assets/heroes/wolves/ivory-idle.webp';
import centaurIdle from '../../../assets/heroes/wolves/centaur-idle.webp';
import rend from '../../../assets/heroes/wolves/ivory-rend-threes.webp';
import pounce from '../../../assets/heroes/wolves/ivory-pounce-threes.webp';
import staff from '../../../assets/heroes/wolves/centaur-staff-threes.webp';
import { ProgressiveSvgImage } from '../../ui/ProgressiveImage';
import './wolf-sprite.css';

type FigureProps = { size: HeroSize; action?: HeroAction | null };
const atlas = { rend, pounce, staff };
const moves = { ivory: ['rend', 'pounce'], centaur: ['staff'] } as const;
const idleArt = { ivory: ivoryIdle, centaur: centaurIdle };

function WolfSpriteFigure({ size, action, unit }: FigureProps & { unit: keyof typeof moves }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let keep = true;
    void Promise.all(moves[unit].map((move) => {
      const image = new Image();
      image.src = atlas[move];
      return image.decode();
    })).then(() => { if (keep) setReady(true); }).catch(() => { /* Fall back to idle. */ });
    return () => { keep = false; };
  }, [unit]);

  const attack = ready && action?.wolfAttack && (moves[unit] as readonly WolfAttack[]).includes(action.wolfAttack)
    ? action.wolfAttack : undefined;
  // The same 240 × 282 canvas is used for every pose, including idle.
  const width = unit === 'ivory' ? 114 : 108;
  const height = width * 282 / 240;
  const x = (BODY_WIDTH[size] - width) / 2 - (unit === 'centaur' ? 5 : 0);
  const y = BODY_HEIGHT - height;
  return (
    <g key={attack ?? 'idle'} data-wolf-attack={attack}>
      <g className="wolf-idle-art">
        <ProgressiveSvgImage href={idleArt[unit]} x={x} y={y} width={width} height={height} />
      </g>
      {attack && (
        <foreignObject className="wolf-strip-gate" x={x} y={y} width={width} height={height}>
          <div className="wolf-attack-strip" style={{ backgroundImage: `url("${atlas[attack]}")` }} />
        </foreignObject>
      )}
    </g>
  );
}

export const IvoryWerewolf = (props: FigureProps) => <WolfSpriteFigure {...props} unit="ivory" />;
export const WolfCentaur = (props: FigureProps) => <WolfSpriteFigure {...props} unit="centaur" />;
