// ===================================================================
// BOSS ENTRANCE
// The overlay a boss enters under: the field dims, then a title card
// with "BOSS", its name and its epithet (from BOSS_ENTRANCES) sweeps
// in, holds and fades, while the boss itself descends or rises into its
// spot (HeroOnField, "boss-arrive"), lands with a shake and dust, its
// halo flares and its HP bar fills. Tapping anywhere on it skips.
// PERFORMANCE: transform and opacity only (index.css "BOSS ENTRANCE").
// ===================================================================

import { getHero } from '../../../../shared/game/heroes';
import type { HeroUnit } from '../../../../shared/game/types';
import { bossEntranceOf } from '../../../content/bossEntrances';

// --- COMPONENT ---
/** Renders the dim and the title card over the field; a tap calls onSkip. */
export const BossEntrance = ({
  boss,
  onSkip,
}: {
  boss: HeroUnit;
  onSkip: () => void;
}) => {
  const { epithet } = bossEntranceOf(boss.heroId);
  return (
    <button
      type="button"
      onClick={onSkip}
      aria-label={`${getHero(boss.heroId).name} enters. Tap to skip.`}
      className="boss-entrance absolute inset-0 z-20 flex cursor-pointer flex-col items-center justify-start pt-[14%]"
    >
      <span className="boss-entrance-dim absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgb(0_0_0/0.75)_80%)]" />
      <span className="boss-entrance-card relative flex flex-col items-center gap-0.5 text-center">
        <span className="font-display text-[11px] font-black uppercase tracking-[0.5em] text-hp">
          Boss
        </span>
        <span className="font-display text-[clamp(1.5rem,8cqw,2.5rem)] font-black uppercase leading-none tracking-wide text-accent [paint-order:stroke_fill] [-webkit-text-stroke:3px_black]">
          {getHero(boss.heroId).name}
        </span>
        <span className="boss-entrance-rule mt-1 h-px w-40 bg-gradient-to-r from-transparent via-accent to-transparent" />
        <span className="text-xs italic text-ink [text-shadow:0_1px_4px_black]">
          {epithet}
        </span>
      </span>
    </button>
  );
};
