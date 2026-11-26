// ===================================================================
// UNIT INFO
// The body of a unit's info window on the Units tab, in three tabs:
// Sprite (its art, large), Moveset (its moves in the order it cycles
// them) and Stats (rank, HP, line and traits). Every word comes from the
// hero catalog through describeHeroMoveList and describeUnitStats.
// Admins also get stat fields on the Stats tab (UnitStatEditor).
// ===================================================================

import { useReducer, useState, type ReactNode } from 'react';
import { describeHeroMoveList } from '../../../shared/game/describe';
import type { HeroId } from '../../../shared/game/heroes';
import { describeUnitStats } from '../../../shared/game/sandbox';
import { RichText } from '../ui/RichText';
import { TabBar } from '../ui/TabBar';
import { useIsAdmin } from '../../lib/adminRole';
import { MoveEffect } from './MoveEffect';
import { UnitStatEditor } from './UnitStatEditor';

// --- TYPES ---
type UnitInfoTab = 'sprite' | 'moveset' | 'stats';

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

// --- COMPONENT ---
/** The tabs and the chosen tab's view; Sprite opens first. */
export const UnitInfo = ({ heroId, sprite }: { heroId: HeroId; sprite: ReactNode }) => {
  const [tab, setTab] = useState<UnitInfoTab>('sprite');
  const isAdmin = useIsAdmin();
  // Bumped after an admin save so the stat list re-reads getHero.
  const [, refreshStats] = useReducer((count: number) => count + 1, 0);
  return (
    <div className="unit-info">
      <TabBar ids={UNIT_INFO_TABS} labels={UNIT_INFO_LABELS} tab={tab} onTab={setTab} />
      <div role="tabpanel" aria-label={UNIT_INFO_LABELS[tab]}>
        {tab === 'sprite' && <div className="unit-sprite">{sprite}</div>}
        {tab === 'moveset' && <UnitMoveList heroId={heroId} />}
        {tab === 'stats' && isAdmin && <UnitStatEditor heroId={heroId} onSaved={refreshStats} />}
        {tab === 'stats' && <UnitStatList heroId={heroId} />}
      </div>
    </div>
  );
};
