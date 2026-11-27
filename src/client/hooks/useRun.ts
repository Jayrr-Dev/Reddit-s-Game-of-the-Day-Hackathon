import { useCallback, useEffect, useReducer } from 'react';
import { localBuild } from '../lib/playerBuild';
import { starterDeck } from '../../shared/game/starters';
import type { PlayerBuild } from '../../shared/game/playerBuild';
import { createRun, runReducer, type RunAction } from '../../shared/game/run';
import {
  restartLoggedRun,
  restoreLoggedRun,
  saveLoggedRun,
  type LoggedRun,
} from '../../shared/game/runSave';

const browserStore = (accountId?: string) => {
  try {
    const store = window.localStorage;
    if (!accountId) return store;
    const prefix = accountId + '/';
    return { get length() { return store.length; }, key(i: number) {
      const key = store.key(i);
      return key?.startsWith(prefix) ? key.slice(prefix.length) : null;
    }, getItem: (k: string) => store.getItem(prefix + k), setItem: (k: string, v: string) => store.setItem(prefix + k, v) };
  } catch {
    return undefined;
  }
};

type RunEvent =
  { type: 'act'; action: RunAction } | { type: 'restart'; state: LoggedRun } | { type: 'resumeView'; state: LoggedRun };
const loggedRunReducer = (state: LoggedRun, event: RunEvent): LoggedRun => {
  if (event.type === 'restart') return event.state;
  if (event.type === 'resumeView') {
    const next = event.state;
    const sameRun = next.attempt === state.attempt && next.profile?.id === state.profile?.id;
    const extendsLog = next.actions.length > state.actions.length &&
      state.actions.every((action, index) => JSON.stringify(action) === JSON.stringify(next.actions[index]));
    return sameRun && extendsLog ? next : state;
  }
  const run = runReducer(state.run, event.action);
  return run === state.run
    ? state
    : { ...state, run, actions: [...state.actions, event.action] };
};

export const useRun = (dailyKey: string, accountId?: string) => {
  const [state, send] = useReducer(loggedRunReducer, dailyKey, (day) =>
    restoreLoggedRun(day, browserStore(accountId))
  );
  useEffect(() => saveLoggedRun(state, browserStore(accountId)), [state, accountId]);
  useEffect(() => {
    // Reddit can recreate the view. On return, take any actions played in the larger view.
    const resumeView = () => send({ type: 'resumeView', state: restoreLoggedRun(dailyKey, browserStore(accountId)) });
    window.addEventListener('focus', resumeView);
    return () => window.removeEventListener('focus', resumeView);
  }, [dailyKey, accountId]);
  const act = useCallback(
    (action: RunAction) => send({ type: 'act', action }),
    []
  );
  const restart = useCallback((profile?: LoggedRun["profile"], build?: PlayerBuild) => {
    const next = restartLoggedRun(state, browserStore(accountId));
    if (!next.actions.length && profile) {
      next.profile = profile;
      next.run = createRun(dailyKey, next.initialRings, next.attempt, profile.wins, profile.shopRings, profile.pandoraEffect, profile.cardRules, profile.carriedCards ?? profile.carriedCard, profile.progressionVersion !== 2, profile.conquestVersion, profile.xpStartWins);
    }
    if (!next.actions.length && !profile) {
      next.run = createRun(dailyKey, next.initialRings, next.attempt, 0, [], undefined, 1, undefined, false, 1, 0);
    }
    if (!next.actions.length) {
      const chosen = build ?? localBuild(accountId);
      const actions:RunAction[] = [...chosen.character];
      actions.unshift({type:'starterDeck',favorStarter:true,name:chosen.selected,cards:chosen.decks[chosen.selected] ?? starterDeck(chosen.selected)});
      for(const action of actions) {
        const updated=runReducer(next.run,action);
        if(updated!==next.run){ next.run=updated; next.actions = [...next.actions,action]; }
      }
    }
    saveLoggedRun(next, browserStore(accountId));
    send({ type: 'restart', state: next });
  }, [state, accountId, dailyKey]);
  return {
    run: state.run,
    actions: state.actions,
    profile: state.profile,
    hasProgress: state.actions.length > 0,
    act,
    restart,
  } as const;
};
