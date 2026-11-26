import { isRunAction, type RunAction } from './run.ts';
import {
  isStarterName,
  validStarter,
  starterNames,
  type StarterName,
} from './starters.ts';
import type { CardId } from './cards.ts';
import { isBagLayout, type BagLayout } from './bagLayout.ts';

export type PlayerBuild = {
  selected: StarterName;
  decks: Partial<Record<StarterName, CardId[]>>;
  character: RunAction[];
  /** Where the player arranged their Inventory stacks (positions only). */
  bag?: BagLayout;
};
export const defaultBuild = (): PlayerBuild => ({
  selected: 'Warrior',
  decks: {},
  character: [],
});
export const characterEdit = (a: RunAction) =>
  ['equipItem', 'discardItem', 'setTraitNode', 'saveTraits', 'skillPath', 'buySkill'].includes(a.type);
export function isPlayerBuild(data: unknown): data is PlayerBuild {
  if (
    !data ||
    typeof data !== 'object' ||
    !('selected' in data) ||
    !isStarterName(data.selected) ||
    !('character' in data) ||
    !Array.isArray(data.character) ||
    data.character.length > 1024 ||
    !data.character.every((a) => isRunAction(a) && characterEdit(a)) ||
    !('decks' in data) ||
    !data.decks ||
    typeof data.decks !== 'object' ||
    Array.isArray(data.decks) ||
    ('bag' in data && !isBagLayout(data.bag))
  )
    return false;
  return Object.entries(data.decks).every(([key, list]) =>
    starterNames.some((name) => name === key && validStarter(name, list))
  );
}
