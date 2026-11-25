import { getHero } from './heroes.ts';
import type { CombatHistoryRecord, CombatState, Combatant, StatusId } from './types.ts';

export function appendCombatHistory(history: readonly CombatHistoryRecord[] | undefined, ...entries: CombatHistoryRecord[]) {
  return [...(history ?? []), ...entries].slice(-10);
}

export function recordEffects(before: CombatState, after: CombatState): CombatState {
  const entries: CombatHistoryRecord[] = [];
  const compare = (subject: string, old: Combatant, now?: Combatant) => {
    const turn = before.turn;
    if (!now || now.hp <= 0) {
      if (old.hp > 0) entries.push({ event: 'death', turn, subject, detail: 'Defeated' });
      return;
    }
    if (now.hp > old.hp) entries.push({ event: 'heal', turn, subject, detail: 'Healed ' + (now.hp - old.hp) + ' health' });
    if (now.guard > old.guard) entries.push({ event: 'guard', turn, subject, detail: 'Gained ' + (now.guard - old.guard) + ' Guard' });
    for (const status of Object.keys(now.statuses) as StatusId[]) {
      const gain = now.statuses[status] - old.statuses[status];
      if (gain > 0) entries.push({ event: 'status', turn, subject, status, detail: status[0]!.toUpperCase() + status.slice(1) + ' +' + gain + ' (' + now.statuses[status] + ' total)' });
    }
  };
  compare('Villain', before.player, after.player);
  for (const unit of before.heroes) compare(getHero(unit.heroId).name, unit, after.heroes.find(hero => hero.uid === unit.uid));
  for (const unit of after.heroes) if (!before.heroes.some(hero => hero.uid === unit.uid))
    entries.push({ event: 'arrival', turn: before.turn, subject: getHero(unit.heroId).name, detail: 'Joined the battle' });
  return entries.length ? { ...after, playHistory: appendCombatHistory(after.playHistory, ...entries) } : after;
}
