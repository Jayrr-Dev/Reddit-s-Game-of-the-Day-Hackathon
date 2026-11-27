import {
  createRun,
  isRunAction,
  replayRun,
  runReducer,
  type RunAction,
  type RunState,
} from './run.ts';
import {
  migratePathNodes,
  normalizeTraitNodeIds,
  traitNodeArms,
  traitNodeIds,
  type RingProgress,
  type TraitId,
} from './character.ts';

import type { RunProfile } from '../types/api.ts';
import { isCardId } from './cards.ts';
import { isPandoraRunEffect } from './pandora.ts';
import { shopRingIds } from './ringShop.ts';

type SaveStore = {
  length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type LoggedRun = {
  profile?: RunProfile;
  run: RunState;
  actions: RunAction[];
  attempt: number;
  initialRings: RingProgress;
};

const logKey = (dailyKey: string) => `villain-arc:run:${dailyKey}`;
const awardPrefix = 'villain-arc:ring-awards:';
const awardKey = (state: LoggedRun) =>
  `${awardPrefix}${state.run.dailyKey}:${state.attempt}`;
const emptyProgress = (): RingProgress => ({ bossWins: 0, rareSlots: [] });
const slots = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);

const progressOf = (value: unknown): RingProgress => {
  if (!value || typeof value !== 'object') return emptyProgress();
  return {
    bossWins:
      'bossWins' in value &&
      typeof value.bossWins === 'number' &&
      Number.isSafeInteger(value.bossWins)
        ? Math.max(0, value.bossWins)
        : 0,
    rareSlots:
      'rareSlots' in value && Array.isArray(value.rareSlots)
        ? slots(
            value.rareSlots.filter(
              (n): n is number => Number.isInteger(n) && n >= 6 && n <= 10
            )
          )
        : [],
  };
};

const read = (storage: SaveStore, key: string): unknown => {
  const raw = storage.getItem(key);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** Each daily attempt contributes its own delta exactly once, even when its log is replayed. */
const lifetimeRings = (storage: SaveStore): RingProgress => {
  let bossWins = 0;
  const rareSlots: number[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(awardPrefix)) continue;
    const earned = progressOf(read(storage, key));
    bossWins += earned.bossWins;
    rareSlots.push(...earned.rareSlots);
  }
  return { bossWins, rareSlots: slots(rareSlots) };
};

const newAttempt = (
  day: string,
  initialRings: RingProgress,
  attempt: number
): LoggedRun => ({
  run: createRun(day, initialRings, attempt),
  initialRings,
  attempt,
  actions: [],
});

/**
 * Old saves recorded arbitrary node IDs. Replay their buys and refunds as the
 * equivalent next node or tip on that arm, keeping the same number of points.
 * Keep the original IDs during conversion so refunding an old interior node
 * removes exactly one tip even after later purchases on the same arm.
 */
const restoreActions = (
  day: string,
  raw: unknown[],
  initialRings: RingProgress,
  attempt: number,
  connected: boolean
): LoggedRun => {
  const valid = raw.filter(isRunAction);
  if (connected || !valid.some((action) => action.type === 'setTraitNode'))
    return {
      run: replayRun(day, valid, initialRings, attempt),
      actions: valid,
      initialRings,
      attempt,
    };
  let run = createRun(day, initialRings, attempt);
  const actions: RunAction[] = [];
  const previousIds = new Map<TraitId, readonly number[]>();
  for (const action of valid) {
    const character = run.character;
    if (action.type === 'setTraitNode') {
      const { trait, node, owned } = action;
      const current = traitNodeIds(
        character.traits,
        character.traitNodes,
        trait
      );
      const selected = previousIds.get(trait) ?? current;
      if (selected.includes(node) === owned) continue;
      const originalIds = owned
        ? [...selected, node]
        : selected.filter((id) => id !== node);
      const desired = normalizeTraitNodeIds(trait, originalIds);
      const order = [1, ...Object.values(traitNodeArms(trait)).flat()];
      const removals = order
        .filter((id) => current.includes(id) && !desired.includes(id))
        .reverse();
      const additions = order.filter(
        (id) => !current.includes(id) && desired.includes(id)
      );
      const changes = [
        ...removals.map((id) => ({ ...action, node: id, owned: false })),
        ...additions.map((id) => ({ ...action, node: id, owned: true })),
      ];
      let candidate = run;
      for (const change of changes) candidate = runReducer(candidate, change);
      const result = traitNodeIds(
        candidate.character.traits,
        candidate.character.traitNodes,
        trait
      );
      if (
        result.length !== desired.length ||
        !desired.every((id) => result.includes(id))
      )
        continue;
      run = candidate;
      actions.push(...changes);
      previousIds.set(trait, originalIds);
    } else {
      const next = runReducer(run, action);
      if (next === run) continue;
      if ('trait' in action) {
        const path = next.character.traitPaths?.[action.trait];
        const rawIds = path
          ? migratePathNodes(action.trait, path)
          : Array.from(
              { length: next.character.traits[action.trait] },
              (_, i) => i + 1
            );
        previousIds.set(action.trait, rawIds);
      }
      run = next;
      actions.push(action);
    }
  }
  return { run, actions, initialRings, attempt };
};

export const restoreLoggedRun = (
  day: string,
  storage?: SaveStore
): LoggedRun => {
  if (storage) {
    try {
      const saved = read(storage, logKey(day));
      if (Array.isArray(saved)) {
        return restoreActions(day, saved, emptyProgress(), 0, false);
      }
      if (
        saved &&
        typeof saved === 'object' &&
        'actions' in saved &&
        Array.isArray(saved.actions) &&
        'attempt' in saved &&
        typeof saved.attempt === 'number' &&
        Number.isSafeInteger(saved.attempt) &&
        saved.attempt >= 0 &&
        'initialRings' in saved
      ) {
        const initialRings = progressOf(saved.initialRings);
        if ('profile' in saved && saved.profile && typeof saved.profile === 'object' &&
          'id' in saved.profile && typeof saved.profile.id === 'string' &&
          'wins' in saved.profile && typeof saved.profile.wins === 'number' && Number.isSafeInteger(saved.profile.wins)) {
          const profile = { id: saved.profile.id, wins: saved.profile.wins, ...('shopRings' in saved.profile && { shopRings: shopRingIds(saved.profile.shopRings) }),
            ...('pandoraEffect' in saved.profile && isPandoraRunEffect(saved.profile.pandoraEffect) && { pandoraEffect: saved.profile.pandoraEffect }),
            ...('cardRules' in saved.profile && saved.profile.cardRules === 1 && { cardRules: 1 as const }),
            ...('carriedCard' in saved.profile && isCardId(saved.profile.carriedCard) && { carriedCard: saved.profile.carriedCard }) };
          const actions = saved.actions.filter(isRunAction);
          return { run: replayRun(day, actions, initialRings, saved.attempt, profile.wins, profile.shopRings, profile.pandoraEffect, profile.cardRules, profile.carriedCard), attempt: saved.attempt, initialRings, actions, profile };
        }
        return restoreActions(
          day,
          saved.actions,
          initialRings,
          saved.attempt,
          'traitRuleVersion' in saved && saved.traitRuleVersion === 5
        );
      }
      return newAttempt(day, lifetimeRings(storage), 0);
    } catch {
      /* Storage may be unavailable in a webview. */
    }
  }
  return newAttempt(day, emptyProgress(), 0);
};

export const saveLoggedRun = (state: LoggedRun, storage?: SaveStore): void => {
  if (!storage) return;
  try {
    const current = state.run.character.ringProgress;
    const bossWins = Math.max(
      0,
      current.bossWins - state.initialRings.bossWins
    );
    const newSlots = current.rareSlots.filter(
      (index) => !state.initialRings.rareSlots.includes(index)
    );
    if (bossWins || newSlots.length) {
      const key = awardKey(state);
      const earned = progressOf(read(storage, key));
      const rareSlots = slots([...earned.rareSlots, ...newSlots]);
      if (
        bossWins > earned.bossWins ||
        rareSlots.length !== earned.rareSlots.length
      )
        storage.setItem(
          key,
          JSON.stringify({
            bossWins: Math.max(earned.bossWins, bossWins),
            rareSlots,
          })
        );
    }
    const key = logKey(state.run.dailyKey);
    const old = read(storage, key);
    if (
      old &&
      typeof old === 'object' &&
      'attempt' in old &&
      typeof old.attempt === 'number' &&
      (old.attempt > state.attempt ||
        (old.attempt === state.attempt &&
          'traitRuleVersion' in old &&
          old.traitRuleVersion === 5 &&
          'actions' in old &&
          Array.isArray(old.actions) &&
          old.actions.length > state.actions.length))
    )
      return;
    storage.setItem(
      key,
      JSON.stringify({
        traitRuleVersion: 5,
        profile: state.profile,
        initialRings: state.initialRings,
        attempt: state.attempt,
        actions: state.actions,
      })
    );
  } catch {
    /* Continue playing when storage is full or disabled. */
  }
};

export const restartLoggedRun = (
  state: LoggedRun,
  storage?: SaveStore
): LoggedRun => {
  if (state.actions.length) saveLoggedRun(state, storage);
  let initialRings = state.run.character.ringProgress;
  if (storage) {
    try {
      const latest = read(storage, logKey(state.run.dailyKey));
      if (
        latest &&
        typeof latest === 'object' &&
        'attempt' in latest &&
        typeof latest.attempt === 'number' &&
        (latest.attempt > state.attempt ||
          (!state.actions.length &&
            latest.attempt === state.attempt &&
            'actions' in latest &&
            Array.isArray(latest.actions) &&
            latest.actions.length > 0))
      )
        return restoreLoggedRun(state.run.dailyKey, storage);
      const earned = lifetimeRings(storage);
      initialRings = {
        bossWins: Math.max(earned.bossWins, initialRings.bossWins),
        rareSlots: slots([...earned.rareSlots, ...initialRings.rareSlots]),
      };
    } catch {
      /* Keep progress in memory when storage is unavailable. */
    }
  }
  return newAttempt(
    state.run.dailyKey,
    initialRings,
    state.attempt + (state.actions.length ? 1 : 0)
  );
};
