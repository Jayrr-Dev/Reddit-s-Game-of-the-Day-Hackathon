// ===================================================================
// UNIT INFO
// The body of a unit's info window on the Units tab, in three tabs:
// Sprite (its art, large), Moveset (its moves in the order it cycles
// them) and Stats (rank, HP, line and traits). Every word comes from the
// hero catalog through describeHeroMoveList and describeUnitStats.
// Admins also get stat fields on the Stats tab (UnitStatEditor).
// ===================================================================

import { useReducer, type ReactNode } from 'react';
import { describeHeroMoveList } from '../../../shared/game/describe';
import type { HeroId } from '../../../shared/game/heroes';
import { describeUnitStats } from '../../../shared/game/sandbox';
import { RichText } from '../ui/RichText';
import { TabBar } from '../ui/TabBar';
import { useIsAdmin } from '../../lib/adminRole';
import { MoveEffect } from './MoveEffect';
import { UnitStatEditor } from './UnitStatEditor';

// --- TYPES ---
export type UnitInfoTab = 'sprite' | 'moveset' | 'stats';

// --- CONSTANTS ---
const UNIT_INFO_TABS: readonly UnitInfoTab[] = ['sprite', 'moveset', 'stats'];
const UNIT_INFO_LABELS: Readonly<Record<UnitInfoTab, string>> = {
  sprite: 'Sprite',
  moveset: 'Moveset',
  stats: 'Stats',
};

// --- SUBCOMPONENTS ---
/** One unit's moves, in the order it cycles them, each with its effects. */
const UnitMoveList = ({ heroId }: { heroId: HeroId }) => (
  <ol className="unit-move-list">
    {describeHeroMoveList(heroId).map((move, index) => (
      <li key={index} data-signature={move.isSignature || undefined}>
        <span className="unit-move-name">
          <span className="unit-move-step">{index + 1}</span>
          {move.name}
          {move.isSignature && <span className="unit-move-tag">Signature</span>}
        </span>
        <ul>
          {move.intents.map((intent, i) => <MoveEffect key={i} intent={intent} />)}
        </ul>
      </li>
    ))}
  </ol>
);

/** A unit's stats as label / value rows; a trait's rules sit under it. */
const UnitStatList = ({ heroId }: { heroId: HeroId }) => (
  <dl className="unit-stat-list">
    {describeUnitStats(heroId).map((stat, index) => (
      <div key={index}>
        <dt>{stat.label}</dt>
        <dd>{stat.value}</dd>
        {stat.info && <p><RichText text={stat.info} /></p>}
      </div>
    ))}
  </dl>
);

// --- COMPONENTS ---
/**
 * The Sprite / Moveset / Stats tabs. The tabs and the view are separate
 * pieces so the window can pin the tabs and scroll only the view.
 */
export const UnitInfoTabs = ({ tab, onTab }: { tab: UnitInfoTab; onTab: (tab: UnitInfoTab) => void }) => (
  <TabBar ids={UNIT_INFO_TABS} labels={UNIT_INFO_LABELS} tab={tab} onTab={onTab} className="mt-2" />
);

/** The chosen tab's view (admins also get the stat editor on Stats). */
export const UnitInfoPanel = ({ heroId, sprite, tab }: { heroId: HeroId; sprite: ReactNode; tab: UnitInfoTab }) => {
  const isAdmin = useIsAdmin();
  // Bumped after an admin save so the stat list re-reads getHero.
  const [, refreshStats] = useReducer((count: number) => count + 1, 0);
  return (
    <div role="tabpanel" aria-label={UNIT_INFO_LABELS[tab]} className="grid gap-2">
      {tab === 'sprite' && <div className="unit-sprite">{sprite}</div>}
      {tab === 'moveset' && <UnitMoveList heroId={heroId} />}
      {tab === 'stats' && isAdmin && <UnitStatEditor heroId={heroId} onSaved={refreshStats} />}
      {tab === 'stats' && <UnitStatList heroId={heroId} />}
    </div>
  );
};
