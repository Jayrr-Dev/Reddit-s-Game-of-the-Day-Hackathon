// ===================================================================
// COST CURVE CONFIG
// Every number the card balance calculator guesses lives here, so a
// balance pass is "change a number, run `npm run balance`".
//
// Method: Ian Schreiber, "Level 3: Transitive Mechanics and Cost Curves"
// (Game Balance Concepts, 2010). Every effect is priced in DAMAGE POINTS
// (1 point = 1 damage to one hero), the way the article prices
// everything in mana. A card is balanced when its value equals the
// target for its cost and rarity:
//
//   target = (cardSlot + energyValue × cost) × rarityPremium[rarity]
//   ratio  = value / target
//
// Game rules (Hex growth, Burn halving, Shock hits...) are NOT copied
// here: the calculator reads them from rules.ts and combatant.ts. Only
// the assumptions about a typical fight are.
// ===================================================================

import type { CardRarity } from '../game/types.ts';

// --- TYPES ---
/** All tunable numbers, grouped by what they describe. */
export type CostCurveConfig = {
  curve: {
    /** What a card is worth just for existing (Magic's "cost of existing"). */
    cardSlot: number;
    /** Damage points one energy should buy. */
    energyValue: number;
    /**
     * Minimum target for a 0-cost card. You draw 5 cards but only have
     * energy for about 3, so a free card is close to a free extra play.
     */
    zeroCostFloor: number;
  };
  /** How much better than a Common each rarity is allowed to be. */
  rarityPremium: Record<CardRarity, number>;
  verdict: {
    /** Ratio above this: too strong. */
    tooStrongAbove: number;
    /** Ratio below this: too weak. */
    tooWeakBelow: number;
  };
  /** A typical fight, as the cards see it. */
  battle: {
    /** Damage one hero move deals (grunts deal 4 to 7). */
    heroHitDamage: number;
    /** Damage all heroes deal in one enemy turn. */
    incomingPerTurn: number;
    /** Heroes a reaching ALL effect (Range, Magic, Curse) hits. */
    heroesInReach: number;
    /** Heroes a Melee ALL effect hits (front line only). */
    heroesInFrontLine: number;
    /** Share of value kept for each turn an effect is delayed. */
    delayKeptPerTurn: number;
    /** Extra cut on Hex: it always lands a turn late, so it can't finish a unit now. */
    hexLandsLate: number;
    /** Share of area damage that isn't overkill on small grunts. */
    areaOverkill: number;
    /** Share of a Randomly hit's value (it can't be aimed). */
    randomAim: number;
    /** Chance a Shock goes off (3 hits on one hero in one turn). */
    shockBurstChance: number;
    /** Later Melee or Range attacks on a bleeding hero. */
    laterAttacksForBleed: number;
    /** Melee or Range hits the villain still takes this fight (for Armor). */
    physicalHitsLeft: number;
    /** Shock already on a target when Overcharge is played. */
    shockOnTarget: number;
    /** Hex already on a target when Reap is played. */
    hexOnTarget: number;
  };
  /** Prices for moving (see movement.ts: button = 1 energy + the streak). */
  movement: {
    /** Average energy a Charge or Back Step button press costs. */
    avgButtonEnergy: number;
    /** Chance a free move has room and is wanted. */
    moveUsefulChance: number;
    /** Same, for a second free move in one turn (Rush 2). */
    secondMoveUsefulChance: number;
    /** Energy a movement card saves over the button (only the streak). */
    streakEnergySaved: number;
    /** Chance a Melee card follows Momentum this turn. */
    meleeFollowsChance: number;
    /** Damage of the Melee card that uses Momentum. */
    meleeCardDamage: number;
    /** Value of +N rows on the next move (Follow Up). */
    extraRowsValue: number;
  };
  /** Hits left in the fight that a fight-long buff stack boosts. */
  buffHitsLeft: { might: number; surge: number; hone: number; wrath: number };
  /** Flat prices for effects that aren't simulated. */
  prices: {
    guard: number;
    heal: number;
    draw: number;
    cleanse: number;
    dispelPerBuff: number;
    /** Disrupt: per stack it lowers on each target. */
    disruptPerStack: number;
    /** Hit Limit: share of a turn's incoming damage it stops. */
    hitLimitShare: number;
    /** Each row a hero is pulled or knocked back. */
    movePerRow: number;
    /** Brace: per extra turn Guard is kept. */
    bracePerStack: number;
    vexPerStack: number;
    /** Scramble: share of one hero move wasted. */
    scrambleShare: number;
    malaisePerTurn: number;
    pinPerTurn: number;
    cloakPerTurn: number;
    /** Reinforce: guard cards left this fight that it boosts. */
    reinforcedGuardCards: number;
    /** Bane: afflictions you'll still lay this fight. */
    baneAfflictionsLeft: number;
    /** Sharpshooter, Berserker, Reflex, Invincible: whole-buff guesses. */
    sharpshooter: number;
    berserker: number;
    reflex: number;
    invincible: number;
    /** A timed buff: hits it boosts before it lapses. */
    hitsThisTurn: number;
    hitsThisAction: number;
  };
  /** Imbues: a gift stays on one card for the fight. */
  imbue: {
    /** Plays of the imbued card left in the fight. */
    playsLeft: number;
    /** Hits per play of a typical imbued card. */
    hitsPerPlay: number;
  };
  /** Keyword prices (flat points, or a share of the card's damage). */
  keywords: {
    hold: number;
    remove: number;
    /** Exhaust: limited uses per run. */
    exhaust: number;
    unique: number;
    piercingShare: number;
    piercingFlat: number;
    longRangeShare: number;
    longRangeFlat: number;
    /** Rampage: chance the card kills (it Charges on kill). */
    rampageKillChance: number;
    /** Rampage: double Momentum, as a share of damage. */
    rampageShare: number;
    /** Charge keyword: chance there's room, so Momentum lands. */
    chargeMomentumChance: number;
    /** Cheaper per kill (Decimate). */
    cheaperPerKill: number;
  };
  /**
   * Unit power (unitPower.ts). The villain's damage per turn is not set
   * here: it is ENERGY_PER_TURN × curve.energyValue, so units and cards
   * share one currency.
   */
  unit: {
    /** Villain hits per turn (Armor cuts each physical one). */
    villainHitsPerTurn: number;
    /** Share of the villain's hits that are Melee or Range (Armor applies). */
    physicalShare: number;
    /** Extra toughness for standing out of Melee reach. */
    backlineShield: number;
    horizonShield: number;
    /** Other heroes an "allies" effect also helps. */
    alliesHelped: number;
    /** Share of a heal that lands on missing HP. */
    healUsed: number;
    /** Turns left in the fight for fight-long gains (Wrath, summons). */
    turnsLeft: number;
    /** Hits per move of an ally that Wrath on allies boosts. */
    allyHitsPerMove: number;
    /** One extra move a turn (Vigor) is worth this share of a move. */
    vigorShare: number;
    /** Longrange passive: shots never miss into the Horizon. */
    longRangeBonus: number;
    /** Anchored passive: immune to Pull and Knockback. */
    anchoredBonus: number;
    /** Fatigue: share of an energy each +1 card cost really takes. */
    fatigueEnergyShare: number;
    /** Scramble on the villain: energy of a random card auto-played. */
    scrambleEnergy: number;
    /** Revive: flat points for bringing fallen allies back. */
    revive: number;
    /** Soar: share of a villain turn its Aloft dodges. */
    soarShare: number;
  };
  /** Player power (playerPower.ts): what the player's Guard and Distance hold off. */
  player: {
    /** Damage a boss deals the player in one turn (Mikhael's threat is about 52). */
    incomingPerTurn: number;
    /** Most of a turn's damage Guard and Distance can stop (afflictions and Piercing still land). */
    maxBlockedShare: number;
    /** Share of a turn's damage one Distance move dodges (only Melee is out of reach). */
    distanceDodgeShare: number;
    /** Random hands drawn to average a deckset's damage per turn. */
    handSamples: number;
  };
};

// --- DEFAULTS ---
/** The numbers behind the 2026-11-27 benchmark. Tune these. */
export const COST_CURVE_CONFIG: CostCurveConfig = {
  curve: { cardSlot: 1, energyValue: 8, zeroCostFloor: 4 },
  rarityPremium: {
    basic: 0.75,
    common: 1,
    uncommon: 1.1,
    rare: 1.25,
    legendary: 1.5,
  },
  verdict: { tooStrongAbove: 1.2, tooWeakBelow: 0.8 },
  battle: {
    heroHitDamage: 5,
    incomingPerTurn: 15,
    heroesInReach: 3,
    heroesInFrontLine: 2,
    // Conservative (Sam, 2026-11-27): no discount for delay or landing
    // late, since both were guesses. Effects are priced at full damage,
    // so a card that passes the curve is not secretly too strong.
    delayKeptPerTurn: 1,
    hexLandsLate: 1,
    areaOverkill: 0.8,
    randomAim: 0.9,
    shockBurstChance: 0.5,
    laterAttacksForBleed: 2,
    physicalHitsLeft: 8,
    shockOnTarget: 4,
    hexOnTarget: 4,
  },
  movement: {
    avgButtonEnergy: 1.5,
    moveUsefulChance: 0.5,
    secondMoveUsefulChance: 0.25,
    streakEnergySaved: 0.5,
    meleeFollowsChance: 0.7,
    meleeCardDamage: 9,
    extraRowsValue: 3,
  },
  buffHitsLeft: { might: 5, surge: 4, hone: 4, wrath: 7 },
  prices: {
    guard: 1,
    heal: 1,
    draw: 3,
    cleanse: 3,
    dispelPerBuff: 3,
    disruptPerStack: 0.6,
    hitLimitShare: 0.5,
    movePerRow: 1.5,
    bracePerStack: 2.5,
    vexPerStack: 1,
    scrambleShare: 0.6,
    malaisePerTurn: 2,
    pinPerTurn: 2,
    cloakPerTurn: 5,
    reinforcedGuardCards: 3,
    baneAfflictionsLeft: 4,
    sharpshooter: 8,
    berserker: 15,
    reflex: 3.75,
    invincible: 5,
    hitsThisTurn: 2,
    hitsThisAction: 1.5,
  },
  imbue: { playsLeft: 1.5, hitsPerPlay: 1.5 },
  keywords: {
    hold: 1.5,
    remove: -0.5,
    exhaust: -1,
    unique: 0,
    piercingShare: 0.4,
    piercingFlat: 1,
    longRangeShare: 0.25,
    longRangeFlat: 1,
    rampageKillChance: 0.35,
    rampageShare: 0.15,
    chargeMomentumChance: 0.5,
    cheaperPerKill: 3,
  },
  unit: {
    villainHitsPerTurn: 3,
    physicalShare: 0.6,
    backlineShield: 0.25,
    horizonShield: 0.5,
    alliesHelped: 2,
    healUsed: 0.5,
    turnsLeft: 3,
    allyHitsPerMove: 1.5,
    vigorShare: 1,
    longRangeBonus: 0.1,
    anchoredBonus: 0.05,
    fatigueEnergyShare: 0.5,
    scrambleEnergy: 0.5,
    revive: 30,
    soarShare: 0.5,
  },
  player: { incomingPerTurn: 50, maxBlockedShare: 0.8, distanceDodgeShare: 0.2, handSamples: 400 },
};

// --- OVERRIDES ---
/** True for a plain object (a config group), not a number. */
const isGroup = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * A copy of `config` with one number changed, by dotted path
 * ("battle.heroHitDamage"). Throws on a path that isn't a number in
 * the config, so a typo can't silently do nothing.
 */
export const withOverride = (
  config: CostCurveConfig,
  path: string,
  value: number
): CostCurveConfig => {
  const copy = structuredClone(config);
  const keys = path.split('.');
  const last = keys.pop();
  const group = keys.reduce<unknown>(
    (node, key) => (isGroup(node) ? node[key] : undefined),
    copy
  );
  if (!last || !isGroup(group) || typeof group[last] !== 'number') {
    throw new Error(`Unknown config number: ${path}`);
  }
  group[last] = value;
  return copy;
};
