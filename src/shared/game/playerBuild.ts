import { isRunAction, type RunAction } from './run.ts';
import {
  isStarterName,
  validStarter,
  starterNames,
  type StarterName,
} from './starters.ts';
import type { CardId } from './cards.ts';

export type PlayerBuild = {
  selected: StarterName;
  decks: Partial<Record<StarterName, CardId[]>>;
  character: RunAction[];
};
export const defaultBuild = (): PlayerBuild => ({
  selected: 'Warrior',
  decks: {},
  character: [],
});
export const characterEdit = (a: RunAction) =>
  ['equipItem', 'setTraitNode', 'skillPath', 'buySkill'].includes(a.type);
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
    Array.isArray(data.decks)
  )
    return false;
  return Object.entries(data.decks).every(([key, list]) =>
    starterNames.some((name) => name === key && validStarter(name, list))
  );
}
