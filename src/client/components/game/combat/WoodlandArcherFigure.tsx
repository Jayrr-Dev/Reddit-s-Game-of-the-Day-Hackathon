import type { CSSProperties } from 'react';
import type { HeroAction } from '../../../content/heroLooks';
import { HERO_ATTACK_MS } from '../../../hooks/useHeroTurn';
import woodland from '../../../assets/heroes/woodland-archers/woodland-archer-strip.webp';
import crowned from '../../../assets/heroes/woodland-archers/crowned-archer-strip.webp';
import './woodland-archer.css';

export function WoodlandArcherFigure({ crownedArcher, action }: {
  crownedArcher: boolean;
  action?: HeroAction | null;
}) {
  const shooting = action?.style === 'range';
  return (
    <div
      aria-hidden="true"
      className="woodland-archer"
      data-woodland-archer={crownedArcher ? 'crowned' : 'hooded'}
      data-shooting={shooting ? 'true' : undefined}
      style={{
        backgroundImage: `url("${crownedArcher ? crowned : woodland}")`,
        '--archer-shot-time': `${HERO_ATTACK_MS}ms`,
      } as CSSProperties}
    >
      {/* Approximate full-draw nock location; the flight effect owns the arrow after release. */}
      <span data-woodland-arrow-origin className="woodland-arrow-origin" />
    </div>
  );
}
