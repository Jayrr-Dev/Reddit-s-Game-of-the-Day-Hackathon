import { createRun, isRunOver, runReducer, type RunAction, type RunState } from './run.ts';
import type { CardId } from './cards.ts';

/** Endless uses the day's seeded battles without campaign routing or a final stop. */
export function createEndless(day: string, deck?: readonly CardId[]): RunState {
  const fresh = createRun(day + ':endless', undefined, 0, 0, [], undefined, 1);
  return runReducer(deck ? { ...fresh, deck: [...deck] } : fresh, { type: 'chooseStop', option: 0 });
}

/** The first seeded path is always a fight, including a champion every fifth wave. */
export function reduceEndless(run: RunState, action: RunAction): RunState {
  if (isRunOver(run) || action.type === 'chooseStop' || action.type === 'chooseRegion') return run;
  const next = runReducer(run, action);
  return next !== run && next.phase.kind === 'route'
    ? runReducer(next, { type: 'chooseStop', option: 0 })
    : next;
}
