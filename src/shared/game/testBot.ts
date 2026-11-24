// ===================================================================
// TEST BOT
// A simple greedy player used only by tests: it proves whole runs can be
// played and replayed, and gives a rough read on game balance.
// ===================================================================

import { getCard } from './cards.ts';
import { canPlayCard, targetsFor } from './combat.ts';
import { describeHeroIntent } from './describe.ts';
import { imbueSlotsFor } from './imbue.ts';
import {
  createRun,
  isRunOver,
  runReducer,
  type RunAction,
  type RunState,
} from './run.ts';
import type { CombatState } from './types.ts';

// --- HELPERS ---

/** True when any hero is about to attack. */
const isUnderAttack = (combat: CombatState): boolean =>
  combat.heroes.some((unit) =>
    describeHeroIntent(unit, combat.heroes).intents.some(
      (intent) => intent.kind === 'attack'
    )
  );

/** The weakest hero this card may hit (finish off targets first). */
const weakestUid = (combat: CombatState, handIndex: number): number => {
  const cardId = combat.hand[handIndex];
  const legal = cardId === undefined ? [] : targetsFor(combat, cardId);
  return [...legal].sort((a, b) => a.hp - b.hp)[0]?.uid ?? 0;
};

/**
 * For an Imbue card, the first card in hand it may imbue (as the play's
 * imbueIndex); nothing for any other card.
 */
const imbueTargetOf = (combat: CombatState, handIndex: number) => {
  const [slot] = imbueSlotsFor(combat, handIndex);
  return slot === undefined ? {} : { imbueIndex: slot };
};

/** Picks a hand slot to play, preferring guard when attacked. */
const pickHandIndex = (combat: CombatState): number | null => {
  const playable = combat.hand
    .map((cardId, index) => ({ cardId, index }))
    .filter(({ index }) => canPlayCard(combat, index));
  const wantsGuard = isUnderAttack(combat) && combat.player.guard < 8;
  const guard = playable.find(({ cardId }) =>
    getCard(cardId).effects.some((effect) => effect.kind === 'guard')
  );
  const choice = wantsGuard && guard ? guard : playable[0];
  return choice ? choice.index : null;
};

/** Decides the bot's next action for the current phase. */
export const botAction = (state: RunState): RunAction => {
  const { phase } = state;
  switch (phase.kind) {
    case 'route': {
      const graveIndex = phase.options.findIndex(
        (stop) => stop.kind === 'grave'
      );
      const isHurt = state.hp < state.maxHp * 0.5;
      return {
        type: 'chooseStop',
        option: isHurt && graveIndex >= 0 ? graveIndex : 0,
      };
    }
    case 'combat': {
      const handIndex = pickHandIndex(phase.combat);
      return handIndex === null
        ? { type: 'endTurn' }
        : {
            type: 'playCard',
            handIndex,
            targetUid: weakestUid(phase.combat, handIndex),
            // An Imbue card imbues the first card that can take it.
            ...imbueTargetOf(phase.combat, handIndex),
          };
    }
    case 'reward':
    case 'altar':
      return { type: 'pickCard', offerIndex: 0 };
    case 'grave':
      return { type: 'graveChoice', choice: 'mourn' };
    case 'fallen':
      return { type: 'endTurn' };
  }
};

/** Plays a full run with the bot and returns the final state and the log. */
export const playBotRun = (dailyKey: string, maxActions = 5000) => {
  let state = createRun(dailyKey);
  const actions: RunAction[] = [];
  while (!isRunOver(state) && actions.length < maxActions) {
    const action = botAction(state);
    actions.push(action);
    state = runReducer(state, action);
  }
  return { state, actions };
};
