import type { CSSProperties } from 'react';
import type { HeroAction } from '../../../content/heroLooks';
import { HERO_ATTACK_MS } from '../../../hooks/useHeroTurn';
import woodland from '../../../assets/heroes/woodland-archers/woodland-archer-strip.webp';
import crowned from '../../../assets/heroes/woodland-archers/crowned-archer-strip.webp';
import angel from '../../../assets/heroes/woodland-archers/angel-archer-strip.webp';
import './woodland-archer.css';

const atlas = { archer: woodland, lysa: crowned, wingedArcher: angel };

export function ArcherSprite({ heroId, action }: {
  heroId: keyof typeof atlas;
  action?: HeroAction | null;
}) {
  const shooting = action?.style === 'range';
  return (
    <div
      aria-hidden="true"
      className="woodland-archer"
      data-archer-sprite={heroId}
      data-shooting={shooting ? 'true' : undefined}
      style={{
        backgroundImage: `url("${atlas[heroId]}")`,
        '--archer-shot-time': `${HERO_ATTACK_MS}ms`,
      } as CSSProperties}
    >
      {/* Approximate full-draw nock location; the flight effect owns the arrow after release. */}
      <span data-archer-arrow-origin className="woodland-arrow-origin" />
    </div>
  );
}
