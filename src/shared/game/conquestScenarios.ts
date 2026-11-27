import type { HeroId } from './heroes.ts';

/** Hand-authored waves shared by Conquest and Illusion Training. */
export const CONQUEST_SCENARIOS = {
  roadPatrol: { name: 'Road Patrol', blurb: 'A lone guard holds the road.', heroIds: ['squire'] },
  tollWatch: { name: 'Toll Watch', blurb: 'Archers fire over a shield line.', heroIds: ['shieldmaiden', 'archer'] },
  sideStreetAmbush: { name: 'Side Street Ambush', blurb: 'A guard screens a poison thrower.', heroIds: ['squire', 'rogue'] },
  gateWatch: { name: 'Gate Watch', blurb: 'Two shield guards screen a marksman.', heroIds: ['shieldmaiden', 'squire', 'archer'] },
  cryptWardens: { name: 'Crypt Wardens', blurb: 'A priest and poison thrower hold the passage.', heroIds: ['squire', 'rogue', 'priest'] },
  woodlineSkirmish: { name: 'Woodline Skirmish', blurb: 'Two archers shoot past a guard.', heroIds: ['squire', 'archer', 'archer'] },
  cityGarrison: { name: 'City Garrison', blurb: 'The shield line advances while a priest and bard support it.', heroIds: ['shieldmaiden', 'squire', 'priest', 'bard'] },
  bridgeRetinue: { name: 'Bridge Retinue', blurb: 'Frontliners shield ranged troops on the approach.', heroIds: ['shieldmaiden', 'squire', 'rogue', 'archer'] },
  undercroftGuard: { name: 'Undercroft Guard', blurb: 'Shield guards protect a priest and two poison throwers.', heroIds: ['shieldmaiden', 'squire', 'rogue', 'rogue', 'priest'] },
  assassinPatrol: { name: 'Veiled Patrol', blurb: 'Two angel assassins advance with ranged cover.', heroIds: ['angelAssassin', 'angelAssassin', 'archer', 'priest'] },
  veteranEscort: { name: 'Elite Escort', blurb: 'A storm lancer and sword prelate fight under watch of a priest.', heroIds: ['stormLancer', 'swordPrelate', 'priest'] },
  siegeLine: { name: 'Siege Line', blurb: 'A Ballista fires past defenders advancing down the road.', heroIds: ['shieldmaiden', 'squire', 'ballista'] },
  capitalVanguard: { name: 'Capital Vanguard', blurb: 'Six defenders advance together under cover of arrows and a battle song.', heroIds: ['shieldmaiden', 'shieldmaiden', 'squire', 'bard', 'archer', 'priest'] },
} as const satisfies Record<string, { name: string; blurb: string; heroIds: readonly HeroId[] }>;
