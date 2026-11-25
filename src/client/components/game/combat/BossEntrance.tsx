import { getHero } from '../../../../shared/game/heroes';
import type { HeroUnit } from '../../../../shared/game/types';
import { BOSS_ENTRANCE_MS, bossEntranceOf } from '../../../content/bossEntrances';

// --- COMPONENT ---
/** Renders the dim and the title card over the field; a tap calls onSkip. */
export const BossEntrance = ({
  boss,
  onSkip,
}: {
  boss: HeroUnit;
  onSkip: () => void;
}) => {
  const { epithet, line, durationMs = BOSS_ENTRANCE_MS } = bossEntranceOf(boss.heroId);
  return (
    <button
      type="button"
      onClick={onSkip}
      aria-label={getHero(boss.heroId).name + '. ' + epithet + '. ' + line + ' Skip introduction.'}
      autoFocus
      style={{ animationDuration: durationMs + 'ms' }}
      className="boss-entrance"
    >
      <span className="boss-dialogue">{line}</span>
      <span className="boss-entrance-card">
        <span className="boss-epithet">{epithet}</span>
        <span className="boss-entrance-name">{getHero(boss.heroId).name}</span>
      </span>
      <span className="boss-skip-hint">Skip intro</span>
    </button>
  );
};
