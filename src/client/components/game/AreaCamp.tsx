import { isLastRegion, PURGATORY_ARENA_TITLE, REST_FRACTION } from '../../../shared/game/conquestAreas';
import { areaVisitedRooms } from '../../../shared/game/areaMap';
import { healingAmount } from '../../../shared/game/character';
import type { RunAction, RunState } from '../../../shared/game/run';
import { Button } from '../ui/Button';
import { LocalAreaMap } from './LocalAreaMap';

/** Returns to the same map after battle and opens its optional visit points. */
export function AreaCamp({ run, onAction }: { run: RunState; onAction: (action: RunAction) => void }) {
  const { area, phase } = run;
  if (!area || phase.kind !== 'area-camp') return null;
  const { explored, event } = phase;
  const heal = Math.min(run.maxHp - run.hp, healingAmount(Math.ceil(run.maxHp * REST_FRACTION), run.character));
  const continuing = area.battle + 1 < area.battles.length ? 'Next battle'
    : area.site.kind === 'capital' && isLastRegion(run.stop) ? 'Finish conquest' : 'Leave area';
  const finalArea = area.site.kind === 'capital' && isLastRegion(run.stop);
  return <LocalAreaMap key={area.battle} site={area.site} heading={finalArea ? PURGATORY_ARENA_TITLE : area.site.name} battles={area.battles} interaction={{
    battle: area.battle,
    visited: areaVisitedRooms(explored, phase.visited),
    onVisit: room => onAction({ type: 'areaCamp', choice: 'explore', room }),
  }}>
    {event && <aside className="local-area-result" aria-live="polite">
      <strong>{event.secret ? 'Secret: ' : ''}{event.title}</strong>
      <p>{event.detail}</p>
      {event.result && <small>{event.result}</small>}
    </aside>}
    {!explored && !!heal && <Button variant="menu" onClick={() => onAction({ type: 'areaCamp', choice: 'rest' })}>
      Rest (+{heal} HP)
    </Button>}
    <Button variant="menuPrimary" onClick={() => onAction({ type: 'areaCamp', choice: 'continue' })}>{continuing}</Button>
  </LocalAreaMap>;
}
