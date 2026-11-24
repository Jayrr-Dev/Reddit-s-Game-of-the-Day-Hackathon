// ===================================================================
// USE HIT POPS
// Watches HP and guard and, whenever someone is hit, adds a "pop" that
// floats over them for a moment: the HP lost, and the part their guard
// blocked. Heroes also pop what they gain from their own moves (healing,
// Guard, Wrath) in the same spot, and anyone pops a debuff (Hex,
// Weaken ...) when one is laid on them. A hit that no attack dealt names
// the status that ticked (Hex, Poison, Burn), so it draws that effect. Each pop also drives the effect drawn
// over the character (see ImpactOverlay). Two hooks share the same rules:
//   useHitPops     every hero, each pop placed over that hero's body
//   usePlayerHits  the villain (drawn over the portrait)
// Pops clear themselves after HIT_POP_MS.
// ===================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BuffId,
  CardType,
  Combatant,
  HeroUnit,
  StatusId,
} from '../../shared/game/types';
import type { HitHistory } from '../lib/popSize';
import { HERO_ANCHOR_ATTR, HERO_UID_ATTR, type Point } from './useCardDrag';

// --- TYPES ---
/** A status that harms whoever carries it. */
export type DebuffKind =
  'hex' | 'poison' | 'burn' | 'frost' | 'bleed' | 'weaken' | 'enfeeble';

/** A status that deals damage on its own when it goes off (a tick). */
export type TickKind = 'hex' | 'poison' | 'burn';

/** What a pop shows: a hit, something gained, or a debuff laid on. */
export type PopKind =
  | 'hit'
  | 'heal'
  | 'guard'
  | 'wrath'
  | 'momentum'
  | 'protection'
  | 'brace'
  | BuffId
  | DebuffKind
  /** Bleed went off: a spray of blood over the unit (quiet). */
  | 'bleedBurst';

/**
 * One pop's numbers: for a hit, HP lost and damage the guard soaked up;
 * for a gain, how much was gained (blocked is 0).
 */
export type Hit = {
  kind: PopKind;
  amount: number;
  blocked: number;
  /** For a hit on a hero: the type of the card that dealt it (its colour). */
  source?: CardType | undefined;
  /** For a hit no attack dealt: the status that ticked (its own effect). */
  tick?: TickKind | undefined;
  /** True when only the effect over the character shows (no number). */
  isQuiet?: boolean;
  /** True when this hit took the target from alive to 0 HP. */
  isKill?: boolean;
};

/**
 * A pop on screen: id keys it while it floats, and `typical` is the
 * typical hit when it appeared, which sets its size (see popSize.ts).
 */
export type PlayerHitPop = Hit & { id: number; typical: number };

export type HitPop = PlayerHitPop & {
  uid: number;
  /** Where on screen (viewport px) the hero's body was when hit. */
  point: Point;
};

/** What we remember about a hero between looks. */
type HeroLook = {
  hp: number;
  guard: number;
  damageTaken: number;
  wrath: number;
  hex: number;
  poison: number;
  burn: number;
  frost: number;
  bleed: number;
  weaken: number;
  enfeeble: number;
  point: Point | null;
};

// --- CONSTANTS ---
/** How long a damage number stays on screen (matches --animate-hit-pop). */
const HIT_POP_MS = 1400;
/** How a hero that left the field looks: it lost whatever HP it had. */
const goneAfter = (old: HeroLook): Omit<HeroLook, 'point'> => ({
  hp: 0,
  guard: 0,
  damageTaken: old.damageTaken + old.hp,
  wrath: 0,
  hex: 0,
  poison: 0,
  burn: 0,
  frost: 0,
  bleed: 0,
  weaken: 0,
  enfeeble: 0,
});
/**
 * Time between the blows of a multi-hit attack on the villain: each
 * blow pops its own number (and draws its own mark, see PovImpact).
 */
export const BLOW_STAGGER_MS = 160;
/** Debuffs that pop (quietly) when laid on anyone. */
const DEBUFFS: readonly DebuffKind[] = [
  'hex',
  'poison',
  'burn',
  'frost',
  'weaken',
  'enfeeble',
];
/** Fight-long statuses the villain can gain from cards; each pops "+N". */
const VILLAIN_GAINS: readonly (StatusId & PopKind)[] = [
  'momentum',
  'protection',
  'wrath',
  'might',
  'surge',
  'hone',
  'reinforce',
  'brace',
];

// --- HELPERS ---
/** The numbers a hit is read from (HP, Guard, and damage taken). */
type HitLook = { hp: number; guard: number; damageTaken: number };

/**
 * The hit between two looks, or null if there was none. The damage is
 * what got past Guard, overkill included (from damageTaken, since HP
 * stops at 0); lost guard counts as blocked only when `countsBlocked`
 * (guard also fades on its own at turn changes, which is not a hit).
 */
const hitBetween = (
  before: HitLook,
  after: HitLook,
  countsBlocked: boolean
): Hit | null => {
  const amount = Math.max(0, after.damageTaken - before.damageTaken);
  const guardLost = Math.max(0, before.guard - after.guard);
  const blocked = countsBlocked ? guardLost : 0;
  const isKill = before.hp > 0 && after.hp <= 0;
  return amount > 0 || blocked > 0
    ? { kind: 'hit', amount, blocked, isKill }
    : null;
};

/**
 * Which status ticked between two looks, for a hit no attack dealt:
 * Burn and Poison drop when they tick; Hex always changes when it goes
 * off (it burns and shrinks, or clears). Null when none of them moved.
 */
const tickCauseOf = (
  before: Record<TickKind, number>,
  after: Record<TickKind, number>
): TickKind | undefined => {
  if (after.burn < before.burn) return 'burn';
  if (after.poison < before.poison) return 'poison';
  if (after.hex !== before.hex) return 'hex';
  return undefined;
};

/**
 * Splits a hit of several blows into one hit per blow. The engine lands
 * a move's blows in one step, so only their sum is seen; every blow of
 * an attack deals the same, so the sum splits evenly (any remainder on
 * the last), and Guard soaks the first blows until it runs out, as it
 * did in the engine. Only the last blow can be the kill.
 */
export const splitIntoBlows = (hit: Hit, strikes: number): Hit[] => {
  if (strikes <= 1) return [hit];
  const total = hit.amount + hit.blocked;
  const perBlow = Math.floor(total / strikes);
  let guardLeft = hit.blocked;
  return Array.from({ length: strikes }, (_, blow) => {
    const isLast = blow === strikes - 1;
    const damage = isLast ? total - perBlow * (strikes - 1) : perBlow;
    const blocked = Math.min(guardLeft, damage);
    guardLeft -= blocked;
    return {
      ...hit,
      amount: damage - blocked,
      blocked,
      isKill: isLast && hit.isKill === true,
    };
  });
};

/** What a hero gained between two looks (heal, Guard, Wrath). */
const gainsBetween = (
  before: Pick<HeroLook, 'hp' | 'guard' | 'wrath'>,
  after: Pick<HeroLook, 'hp' | 'guard' | 'wrath'>
): Hit[] => {
  const gains: [PopKind, number][] = [
    ['heal', after.hp - before.hp],
    ['guard', after.guard - before.guard],
    ['wrath', after.wrath - before.wrath],
  ];
  return gains
    .filter(([, amount]) => amount > 0)
    .map(([kind, amount]) => ({ kind, amount, blocked: 0 }));
};

/**
 * Debuffs laid on between two looks, plus a Bleed that went off (it
 * had stacks and now has none): effect only, no number.
 */
const debuffsBetween = (
  before: Record<DebuffKind, number>,
  after: Record<DebuffKind, number>
): Hit[] => {
  const laid: Hit[] = DEBUFFS.map((kind) => ({
    kind,
    amount: after[kind] - before[kind],
    blocked: 0,
    isQuiet: true,
  })).filter((debuff) => debuff.amount > 0);
  const hasBurst = before.bleed > 0 && after.bleed === 0;
  const burst: Hit = {
    kind: 'bleedBurst',
    amount: before.bleed,
    blocked: 0,
    isQuiet: true,
  };
  return hasBurst ? [...laid, burst] : laid;
};

/** The middle of a hero's drawn body, or null if it is not on screen. */
export const bodyPointOf = (uid: number): Point | null => {
  const body = document.querySelector(
    `[${HERO_UID_ATTR}="${uid}"] [${HERO_ANCHOR_ATTR}]`
  );
  if (!body) return null;
  const rect = body.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.4 };
};

/** Snapshots every hero, keeping the last known point of fallen ones. */
const lookAt = (
  heroes: readonly HeroUnit[],
  before: ReadonlyMap<number, HeroLook>
): Map<number, HeroLook> =>
  new Map(
    heroes.map((unit) => [
      unit.uid,
      {
        hp: unit.hp,
        guard: unit.guard,
        damageTaken: unit.damageTaken,
        wrath: unit.statuses.wrath,
        hex: unit.statuses.hex,
        poison: unit.statuses.poison,
        burn: unit.statuses.burn,
        frost: unit.statuses.frost,
        bleed: unit.statuses.bleed,
        weaken: unit.statuses.weaken,
        enfeeble: unit.statuses.enfeeble,
        point: bodyPointOf(unit.uid) ?? before.get(unit.uid)?.point ?? null,
      },
    ])
  );

/**
 * Hero pops since the last look: hits, and on the heroes' turn what
 * their moves gave them. A hero gone from the field lost all its HP.
 */
const heroPopsSince = (
  before: ReadonlyMap<number, HeroLook>,
  heroes: readonly HeroUnit[],
  countsBlocked: boolean,
  isHeroTurn: boolean,
  source: CardType | undefined
): Omit<HitPop, 'id' | 'typical'>[] =>
  [...before].flatMap(([uid, old]) => {
    const unit = heroes.find((hero) => hero.uid === uid);
    const now = unit
      ? {
          hp: unit.hp,
          guard: unit.guard,
          damageTaken: unit.damageTaken,
          wrath: unit.statuses.wrath,
          hex: unit.statuses.hex,
          poison: unit.statuses.poison,
          burn: unit.statuses.burn,
          frost: unit.statuses.frost,
          bleed: unit.statuses.bleed,
          weaken: unit.statuses.weaken,
          enfeeble: unit.statuses.enfeeble,
        }
      : goneAfter(old);
    const found = hitBetween(old, now, countsBlocked);
    // On the heroes' turn only statuses harm them: name the one that ticked.
    const tick = isHeroTurn ? tickCauseOf(old, now) : undefined;
    const hit = found ? { ...found, source, tick } : null;
    const gains = isHeroTurn && unit ? gainsBetween(old, now) : [];
    const debuffs = unit ? debuffsBetween(old, now) : [];
    const point = bodyPointOf(uid) ?? old.point;
    if (!point) return [];
    return [...(hit ? [hit] : []), ...gains, ...debuffs].map((pop) => ({
      ...pop,
      uid,
      point,
    }));
  });

// --- SHARED HOOK ---
/**
 * A list of pops that each remove themselves after HIT_POP_MS. Each is
 * stamped with the typical hit from `history`, then its damage is
 * recorded there for the pops that follow.
 */
const usePopQueue = <T extends Hit>(history: HitHistory) => {
  const [pops, setPops] = useState<(T & { id: number; typical: number })[]>([]);
  const nextIdRef = useRef(0);

  /** Shows new pops; each leaves on its own timer. */
  const add = useCallback(
    (fresh: readonly T[]) => {
      const typical = history.typical();
      const keyed = fresh.map((pop) => ({
        ...pop,
        id: nextIdRef.current++,
        typical,
      }));
      history.record(
        fresh
          .filter((pop) => pop.kind === 'hit')
          .map((pop) => pop.amount + pop.blocked)
      );
      setPops((current) => [...current, ...keyed]);
      const ids = keyed.map((pop) => pop.id);
      // No cleanup on purpose: a newer hit must not cancel this removal.
      window.setTimeout(
        () =>
          setPops((current) => current.filter((pop) => !ids.includes(pop.id))),
        HIT_POP_MS
      );
    },
    [history]
  );

  return [pops, add] as const;
};

// --- HOOKS ---
/**
 * The numbers to show over heroes right now. `isHeroTurn` is true
 * while the heroes' turn plays out: their guard fading then is not a
 * block, and what their moves give them (heal, Guard, Wrath) pops.
 * `cardType` is the type of the card you played last, which colours
 * its hits; on the heroes' turn the only harm to them is Hex ticking,
 * so those hits take the Curse colour.
 */
export const useHitPops = (
  heroes: readonly HeroUnit[],
  turn: number,
  isHeroTurn: boolean,
  cardType: CardType | undefined,
  history: HitHistory
): HitPop[] => {
  const [pops, add] = usePopQueue<Omit<HitPop, 'id' | 'typical'>>(history);
  const lastLookRef = useRef(new Map<number, HeroLook>());
  const lastTurnRef = useRef(turn);

  // HERO CHANGES -> NEW POPS
  useEffect(() => {
    const countsBlocked = lastTurnRef.current === turn && !isHeroTurn;
    const hits = heroPopsSince(
      lastLookRef.current,
      heroes,
      countsBlocked,
      isHeroTurn,
      isHeroTurn ? 'curse' : cardType
    );
    lastLookRef.current = lookAt(heroes, lastLookRef.current);
    lastTurnRef.current = turn;
    if (hits.length > 0) add(hits);
  }, [heroes, turn, isHeroTurn, cardType, add]);

  return pops;
};

/**
 * What the villain gained between two looks: HP healed ("+N"), buffs
 * and Wrath, plus Guard (quiet: Guard has its own "+N" pop by the
 * Guard chip).
 */
const villainGainsBetween = (before: Combatant, after: Combatant): Hit[] => {
  const buffs = VILLAIN_GAINS.map((kind) => ({
    kind,
    amount: after.statuses[kind] - before.statuses[kind],
    blocked: 0,
  }));
  const guard = {
    kind: 'guard' as const,
    amount: after.guard - before.guard,
    blocked: 0,
    isQuiet: true,
  };
  const healed = {
    kind: 'heal' as const,
    amount: after.hp - before.hp,
    blocked: 0,
  };
  return [healed, ...buffs, guard].filter((gain) => gain.amount > 0);
};

/**
 * The numbers to show over the villain right now: hits taken, "+N" for
 * HP healed and every buff or Wrath gained, and quiet pops for Guard
 * and debuffs.
 * `source` is how the hero attack landing now lands (Melee, Range or
 * Magic), which colours the hit; null for untyped harm such as Hex.
 */
export const usePlayerHits = (
  player: Combatant,
  turn: number,
  source: CardType | null,
  history: HitHistory,
  strikes = 1
): PlayerHitPop[] => {
  const [pops, add] = usePopQueue<Hit>(history);
  const lastRef = useRef({ player, turn });

  // VILLAIN CHANGES -> NEW POPS (a multi-hit pops once per blow)
  useEffect(() => {
    const last = lastRef.current;
    const found = hitBetween(last.player, player, last.turn === turn);
    // Untyped harm (no hero attack landing) is a status ticking.
    const tick =
      source === null
        ? tickCauseOf(last.player.statuses, player.statuses)
        : undefined;
    const [firstBlow, ...laterBlows] = found
      ? splitIntoBlows({ ...found, source: source ?? undefined, tick }, strikes)
      : [];
    const gains = villainGainsBetween(last.player, player);
    const debuffs = debuffsBetween(last.player.statuses, player.statuses);
    lastRef.current = { player, turn };
    const fresh = [...(firstBlow ? [firstBlow] : []), ...gains, ...debuffs];
    if (fresh.length > 0) add(fresh);
    // LATER BLOWS LAND IN TURN (no cleanup: a blow already struck)
    laterBlows.forEach((blow, index) =>
      window.setTimeout(() => add([blow]), (index + 1) * BLOW_STAGGER_MS)
    );
  }, [player, turn, source, strikes, add]);

  return pops;
};
