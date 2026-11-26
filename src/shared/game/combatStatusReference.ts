import {
  CLEANSE_INFO,
  DISPEL_INFO,
  DISRUPT_INFO,
  HOMING_INFO,
  KNOCKBACK_INFO,
  OUT_OF_RANGE_INFO,
  IDEAL_RANGE_INFO,
  PASSIVE_INFO,
  PULL_INFO,
  STATUS_INFO,
  type StatusInfo,
} from './describe.ts';
import { BLEED_BITE_FACTOR } from './rules.ts';

type BadgeId = keyof typeof STATUS_INFO;
export type ReferenceEntry = StatusInfo & { badge?: BadgeId };
type ReferenceSection = { title: string; headline: string; entries: readonly ReferenceEntry[] };

const status = (...ids: BadgeId[]): ReferenceEntry[] => ids.map((id) => ({
  ...STATUS_INFO[id],
  badge: id,
  ...(id === 'bleed' ? {
    description: STATUS_INFO.bleed.description.replace('**?**', `**${Math.round(BLEED_BITE_FACTOR * 100)}%**`),
  } : {}),
}));

/** Every active status, plus battlefield passives and ways effects are changed. */
export const COMBAT_STATUS_SECTIONS: readonly ReferenceSection[] = [
  { title: 'Damage afflictions', headline: 'When damage triggers', entries: status('hex', 'poison', 'burn', 'bleed', 'shock') },
  { title: 'Control afflictions', headline: 'What a debuff takes away', entries: status('frost', 'weaken', 'enfeeble', 'vex', 'malaise', 'hitLimit', 'pin', 'fatigue') },
  { title: 'Defense effects', headline: 'Block or reduce the damage', entries: status('guard', 'armor', 'protection', 'brace', 'reinforce', 'invincible') },
  { title: 'Evasion', headline: 'Dodge hits or prevent targeting', entries: status('instinct', 'reflex', 'cloak', 'aloft') },
  { title: 'Offense buffs', headline: 'Which attacks improve', entries: status('wrath', 'might', 'surge', 'hone', 'bane', 'sharpshooter', 'berserker') },
  { title: 'Movement effects', headline: 'Change distance or movement cost', entries: [...status('momentum', 'move', 'rush'), PULL_INFO, KNOCKBACK_INFO] },
  { title: 'Counters and passives', headline: 'Remove, reduce, or bypass effects', entries: [CLEANSE_INFO, DISPEL_INFO, DISRUPT_INFO, HOMING_INFO, IDEAL_RANGE_INFO, OUT_OF_RANGE_INFO, ...Object.values(PASSIVE_INFO)] },
];
