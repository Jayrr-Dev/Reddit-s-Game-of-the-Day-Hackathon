// ===================================================================
// USE HIT POPS
// Watches HP and shroud and, whenever someone is hit, adds a "pop" that
// floats over them for a moment: the HP lost, and the part their shroud
// blocked. Heroes also pop what they gain from their own moves (healing,
// Shroud, Wrath) in the same spot, and anyone pops a debuff (Hex,
// Dread) when one is laid on them. Each pop also drives the effect drawn
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
export type DebuffKind = 'hex' | 'dread';

/** What a pop shows: a hit, something gained, or a debuff laid on. */
export type PopKind =
  'hit' | 'heal' | 'shroud' | 'wrath' | 'momentum' | BuffId | DebuffKind;

/**
 * One pop's numbers: for a hit, HP lost and damage the shroud soaked up;
 * for a gain, how much was gained (blocked is 0).
 */
export type Hit = {
  kind: PopKind;
  amount: number;
  blocked: number;
  /** For a hit on a hero: the type of the card that dealt it (its colour). */
  source?: CardType | undefined;
  /** True when only the effect over the character shows (no number). */
  isQuiet?: boolean;
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
  shroud: number;
  wrath: number;
  hex: number;
  dread: number;
  point: Point | null;
};

// --- CONSTANTS ---
/** How long a damage number stays on screen (matches --animate-hit-pop). */
const HIT_POP_MS = 1400;
const GONE = { hp: 0, shroud: 0, wrath: 0, hex: 0, dread: 0 };
/** Debuffs that pop (quietly) when laid on anyone. */
const DEBUFFS: readonly DebuffKind[] = ['hex', 'dread'];
/** Fight-long statuses the villain can gain from cards; each pops "+N". */
const VILLAIN_GAINS: readonly (StatusId & PopKind)[] = [
  'momentum',
  'wrath',
  'might',
  'surge',
  'piercing',
  'protection',
];

// --- HELPERS ---
/**
 * The hit between two looks, or null if there was none. Lost HP is
 * plain; lost shroud counts as blocked only when `countsBlocked` (shroud
 * also fades on its own at turn changes, which is not a hit).
 */
const hitBetween = (
  before: { hp: number; shroud: number },
  after: { hp: number; shroud: number },
  countsBlocked: boolean
): Hit | null => {
  const amount = Math.max(0, before.hp - after.hp);
  const shroudLost = Math.max(0, before.shroud - after.shroud);
  const blocked = countsBlocked ? shroudLost : 0;
  return amount > 0 || blocked > 0 ? { kind: 'hit', amount, blocked } : null;
};

/** What a hero gained between two looks (heal, Shroud, Wrath). */
const gainsBetween = (
  before: Pick<HeroLook, 'hp' | 'shroud' | 'wrath'>,
  after: Pick<HeroLook, 'hp' | 'shroud' | 'wrath'>
): Hit[] => {
  const gains: [PopKind, number][] = [
    ['heal', after.hp - before.hp],
    ['shroud', after.shroud - before.shroud],
    ['wrath', after.wrath - before.wrath],
  ];
  return gains
    .filter(([, amount]) => amount > 0)
    .map(([kind, amount]) => ({ kind, amount, blocked: 0 }));
};

/** Debuffs laid on between two looks: effect only, no number. */
const debuffsBetween = (
  before: Record<DebuffKind, number>,
  after: Record<DebuffKind, number>
): Hit[] =>
  DEBUFFS.map((kind) => ({
    kind,
    amount: after[kind] - before[kind],
    blocked: 0,
    isQuiet: true,
  })).filter((debuff) => debuff.amount > 0);

/** The middle of a hero's drawn body, or null if it is not on screen. */
const bodyPointOf = (uid: number): Point | null => {
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
        shroud: unit.shroud,
        wrath: unit.statuses.wrath,
        hex: unit.statuses.hex,
        dread: unit.statuses.dread,
        point: bodyPointOf(unit.uid) ?? before.get(unit.uid)?.point ?? null,
      },
    ])
  );

/**
 * Hero pops since the last look: hits, and on the heroes' turn what
 * their moves gave them. A fallen hero counts as 0 HP.
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
          shroud: unit.shroud,
          wrath: unit.statuses.wrath,
          hex: unit.statuses.hex,
          dread: unit.statuses.dread,
        }
      : GONE;
    const found = hitBetween(old, now, countsBlocked);
    const hit = found ? { ...found, source } : null;
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
 * while the heroes' turn plays out: their shroud fading then is not a
 * block, and what their moves give them (heal, Shroud, Wrath) pops.
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
 * Buffs (and Wrath) the villain gained between two looks, plus Guard
 * gained (quiet: Guard has its own "+N" pop by the Guard chip).
 */
const villainGainsBetween = (before: Combatant, after: Combatant): Hit[] => {
  const buffs = VILLAIN_GAINS.map((kind) => ({
    kind,
    amount: after.statuses[kind] - before.statuses[kind],
    blocked: 0,
  }));
  const guard = {
    kind: 'shroud' as const,
    amount: after.shroud - before.shroud,
    blocked: 0,
    isQuiet: true,
  };
  return [...buffs, guard].filter((gain) => gain.amount > 0);
};

/**
 * The numbers to show over the villain right now: hits taken, "+N" for
 * every buff or Wrath gained, and quiet pops for Guard and debuffs.
 * `source` is how the hero attack landing now lands (Melee, Range or
 * Magic), which colours the hit; null for untyped harm such as Hex.
 */
export const usePlayerHits = (
  player: Combatant,
  turn: number,
  source: CardType | null,
  history: HitHistory
): PlayerHitPop[] => {
  const [pops, add] = usePopQueue<Hit>(history);
  const lastRef = useRef({ player, turn });

  // VILLAIN CHANGES -> NEW POPS
  useEffect(() => {
    const last = lastRef.current;
    const found = hitBetween(last.player, player, last.turn === turn);
    const hit = found ? { ...found, source: source ?? undefined } : null;
    const gains = villainGainsBetween(last.player, player);
    const debuffs = debuffsBetween(last.player.statuses, player.statuses);
    lastRef.current = { player, turn };
    const fresh = [...(hit ? [hit] : []), ...gains, ...debuffs];
    if (fresh.length > 0) add(fresh);
  }, [player, turn, source, add]);

  return pops;
};
