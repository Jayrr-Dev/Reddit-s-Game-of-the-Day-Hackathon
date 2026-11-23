// ===================================================================
// STATUS ROW
// Shroud plus any active statuses on a combatant, as chips.
// ===================================================================

import { STATUS_INFO } from '../../../shared/game/describe';
import type { Combatant, StatusId } from '../../../shared/game/types';
import { STATUS_LOOK } from '../../content/visuals';
import { Chip } from '../ui/Chip';

// --- CONSTANTS ---
const STATUS_ORDER: readonly StatusId[] = ['wrath', 'hex', 'dread'];

// --- COMPONENT ---
/** Shows only the statuses that are above zero. */
export const StatusRow = ({ combatant }: { combatant: Combatant }) => {
  const active = STATUS_ORDER.filter((id) => combatant.statuses[id] > 0);
  const hasShroud = combatant.shroud > 0;
  if (!hasShroud && active.length === 0) return <div className="h-5" />;

  return (
    <div className="flex h-5 flex-wrap justify-center gap-1">
      {hasShroud && (
        <Chip
          {...STATUS_LOOK.shroud}
          text={String(combatant.shroud)}
          title={STATUS_INFO.shroud.description}
        />
      )}
      {active.map((id) => (
        <Chip
          key={id}
          {...STATUS_LOOK[id]}
          text={String(combatant.statuses[id])}
          title={`${STATUS_INFO[id].label}: ${STATUS_INFO[id].description}`}
        />
      ))}
    </div>
  );
};
