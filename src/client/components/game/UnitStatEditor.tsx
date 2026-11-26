// ===================================================================
// UNIT STAT EDITOR (ADMIN)
// Number fields for a unit's HP, speed and armor, with Save and Reset
// to catalog. Only rendered for admins; the server refuses anyone else.
// ===================================================================

import { EDITABLE_UNIT_STAT_IDS, EDITABLE_UNIT_STATS } from '../../../shared/game/unitOverrides';
import type { HeroId } from '../../../shared/game/heroes';
import { useUnitStatEditor } from '../../hooks/useUnitStatEditor';
import { Button } from '../ui/Button';

// --- CONSTANTS ---
const STATUS_TEXT = { idle: '', saving: 'Saving…', saved: 'Saved for every player', error: '' } as const;

// --- COMPONENT ---
/** The admin's stat fields for one unit; onSaved lets the list re-read. */
export const UnitStatEditor = ({ heroId, onSaved }: { heroId: HeroId; onSaved: () => void }) => {
  const { drafts, status, error, setDraft, save, reset } = useUnitStatEditor(heroId, onSaved);
  const isSaving = status === 'saving';
  return (
    <form className="unit-stat-editor" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <p className="unit-stat-editor-title">Admin: edit stats</p>
      {EDITABLE_UNIT_STAT_IDS.map((stat) => (
        <label key={stat}>
          {EDITABLE_UNIT_STATS[stat].label}
          <input
            type="number"
            inputMode="numeric"
            min={EDITABLE_UNIT_STATS[stat].min}
            max={EDITABLE_UNIT_STATS[stat].max}
            step={1}
            required
            value={drafts[stat]}
            onChange={(event) => setDraft(stat, event.target.value)}
          />
        </label>
      ))}
      <div className="unit-stat-editor-actions">
        <Button type="submit" className="h-8 px-3 text-xs" disabled={isSaving}>Save</Button>
        <Button variant="ghost" className="h-8 px-3 text-xs" disabled={isSaving} onClick={() => void reset()}>Reset</Button>
      </div>
      <p className="unit-stat-editor-status" role="status">{error ?? STATUS_TEXT[status]}</p>
    </form>
  );
};
