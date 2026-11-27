import { areaCounts, isLastRegion, REST_FRACTION } from '../../../shared/game/conquestAreas';
import { healingAmount } from '../../../shared/game/character';
import type { RunAction, RunState } from '../../../shared/game/run';
import { Button } from '../ui/Button';
import { MAP_IMAGES, MAP_NAMES } from './combat/Backdrop';
import { ProgressiveImg } from '../ui/ProgressiveImage';

/** The choice after claiming battle rewards: search the rooms or spend the time resting. */
export function AreaCamp({ run, onAction }: { run: RunState; onAction: (action: RunAction) => void }) {
  const { area, phase } = run;
  if (!area || phase.kind !== 'area-camp') return null;
  const { explored, event } = phase;
  const { rooms } = area.battles[area.battle]!;
  const { battles } = areaCounts(area.site);
  const heal = Math.min(run.maxHp - run.hp, healingAmount(Math.ceil(run.maxHp * REST_FRACTION), run.character));
  const image = MAP_IMAGES[MAP_NAMES.findIndex(name => name === area.site.map)];
  const continuing = area.battle + 1 < battles ? 'Continue to next battle'
    : area.site.kind === 'capital' && isLastRegion(run.stop) ? 'Finish conquest' : 'Leave location';
  return <section className="area-camp" aria-label="Explore or rest">
    {image && <ProgressiveImg src={image} className="area-camp-art" alt="" />}
    <header>
      <small>Battle {area.battle + 1} of {battles} won</small>
      <h1>{area.site.name}</h1>
      <p>{explored ? 'Rooms searched: ' + explored + ' / ' + rooms : 'Explore the rooms or rest to recover HP.'}</p>
    </header>
    {event && <aside className="area-camp-event" aria-live="polite">
      <strong>{event.secret ? 'Secret: ' : ''}{event.title}</strong>
      <p>{event.detail}</p>
      {event.result && <small>{event.result}</small>}
    </aside>}
    <footer>
      {explored < rooms && <Button variant="menuPrimary" onClick={() => onAction({ type: 'areaCamp', choice: 'explore' })}>
        {explored ? 'Explore next room' : 'Explore rooms'}
      </Button>}
      {!explored && <Button variant="menu" disabled={heal === 0} onClick={() => onAction({ type: 'areaCamp', choice: 'rest' })}>
        {heal ? 'Rest (+' + heal + ' HP)' : 'Rest (full HP)'}
      </Button>}
      <Button variant="menu" onClick={() => onAction({ type: 'areaCamp', choice: 'continue' })}>{continuing}</Button>
    </footer>
  </section>;
}
