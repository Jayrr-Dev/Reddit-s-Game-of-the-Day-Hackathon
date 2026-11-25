import type { BossImpactCue } from './useHeroTurn';
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
  MagicElement,
  MeleeEdge,
  StatusId,
} from '../../shared/game/types';
import type { HitHistory } from '../lib/popSize';
import { HERO_ANCHOR_ATTR, HERO_UID_ATTR, type Point } from './useCardDrag';

// --- TYPES ---
/** A status that harms whoever carries it. */
export type DebuffKind =
  | 'hex'
  | 'poison'
  | 'burn'
  | 'frost'
  | 'shock'
  | 'bleed'
  | 'weaken'
  | 'vex'
  | 'enfeeble';

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
  | 'armor'
  | BuffId
  | DebuffKind
  /** Shock went off: a spray of blood over the unit (quiet). */
  | 'shockBurst'
  /** Bleed opened on a hit taken: its damage as its own number. */
  | 'bleedBite'
  /** A shot Out of Range missed: "Miss" floats up, nothing is drawn. */
  | 'miss'
  | 'dodge';

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
  /** For a Magic hit on a hero: the spell's element (its burst's look). */
  element?: MagicElement | undefined;
  /** For a Melee hit on a hero: the card's edge (slice or thud). */
  edge?: MeleeEdge | undefined;
  /** For a hit no attack dealt: the status that ticked (its own effect). */
  tick?: TickKind | undefined;
  /** Use the unique boss attack impact instead of a standard hit. */
  bossImpact?: BossImpactCue;
  /** True when only the effect over the character shows (no number). */
  isQuiet?: boolean;
  /** True when this hit took the target from alive to 0 HP. */
  isKill?: boolean;
  /** For a hit: damage the target's Armor soaked (its armor icon). */
  armored?: number;
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
  missedShots: number;
  armorSoaked: number;
  wrath: number;
  hex: number;
  poison: number;
  burn: number;
  frost: number;
  shock: number;
  bleed: number;
  weaken: number;
  vex: number;
  enfeeble: number;
  shockDamageTaken: number;
  bleedTaken: number;
  point: Point | null;
};

// --- CONSTANTS ---
/** How long a damage number stays on screen (matches --animate-hit-pop). */
const HIT_POP_MS = 1400;
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
  'bleed',
  'vex',
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
  'sharpshooter',
  'berserker',
  'bane',
  'instinct',
  'armor',
];

// --- HELPERS ---
/** The numbers a hit is read from (HP, Guard, and damage taken). */
type HitLook = {
  hp: number;
  guard: number;
  damageTaken: number;
  armorSoaked?: number | undefined;
};

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
  const armored = Math.max(
    0,
    (after.armorSoaked ?? 0) - (before.armorSoaked ?? 0)
  );
  return amount > 0 || blocked > 0 || armored > 0
    ? { kind: 'hit', amount, blocked, isKill, armored }
    : null;
};

/**
 * Shots that missed between two looks (Out of Range), as one "Miss"
 * pop each. Older saves have no count yet: they read as 0.
 */
const missesBetween = (
  before: Pick<Combatant, 'missedShots'>,
  after: Pick<Combatant, 'missedShots'>
): Hit[] =>
  Array.from(
    {
      length: Math.max(0, (after.missedShots ?? 0) - (before.missedShots ?? 0)),
    },
    () => ({ kind: 'miss' as const, amount: 0, blocked: 0 })
  );

/** Hits and afflictions dodged between two looks (Instinct), one "Dodge" pop each. */
const dodgesBetween = (
  before: Pick<Combatant, 'dodgedHits'>,
  after: Pick<Combatant, 'dodgedHits'>
): Hit[] =>
  Array.from(
    {
      length: Math.max(0, (after.dodgedHits ?? 0) - (before.dodgedHits ?? 0)),
    },
    () => ({ kind: 'dodge' as const, amount: 0, blocked: 0 })
  );

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
 * did in the engine. The blow that crosses zero carries the skull.
 */
export const splitIntoBlows = (hit: Hit, strikes: number, startingHp = hit.amount): Hit[] => {
  if (strikes <= 1) return [hit];
  const total = hit.amount + hit.blocked;
  const perBlow = Math.floor(total / strikes);
  let guardLeft = hit.blocked;
  let hp = startingHp;
  // Armor soaks the same off every blow (any remainder on the last).
  const armored = hit.armored ?? 0;
  const armorPerBlow = Math.floor(armored / strikes);
  return Array.from({ length: strikes }, (_, blow) => {
    const isLast = blow === strikes - 1;
    const damage = isLast ? total - perBlow * (strikes - 1) : perBlow;
    const blocked = Math.min(guardLeft, damage);
    guardLeft -= blocked;
    const isKill = hit.isKill === true && hp > 0 && damage - blocked >= hp;
    hp -= damage - blocked;
    return {
      ...hit,
      amount: damage - blocked,
      blocked,
      armored: isLast ? armored - armorPerBlow * (strikes - 1) : armorPerBlow,
      isKill,
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

/** What debuff pops read from a unit: its debuffs, Shock bursts, Bleed bites. */
type DebuffLook = Record<DebuffKind, number> & {
  shockDamageTaken: number;
  bleedTaken: number;
};

/** A unit's debuffs and burst/bite counts, for debuffsBetween. */
const debuffLookOf = (unit: Combatant): DebuffLook => ({
  ...unit.statuses,
        shockDamageTaken: unit.shockDamageTaken ?? 0,
  bleedTaken: unit.bleedTaken ?? 0,
});

/**
 * Pops whose damage the engine lands inside a hit but which show as
 * their own number (in their status colour): taken out of the hit.
 */
const SPLIT_POPS: ReadonlySet<PopKind> = new Set(['shockBurst', 'bleedBite']);

/** True for a pop that shows damage split out of a hit (see SPLIT_POPS). */
const isSplitPop = (pop: Hit): boolean => SPLIT_POPS.has(pop.kind);

/**
 * Debuffs laid on between two looks, plus a Shock that went off (the
 * engine counted a burst): effect only, no number.
 */
const debuffsBetween = (before: DebuffLook, after: DebuffLook): Hit[] => {
  const laid: Hit[] = DEBUFFS.map((kind) => ({
    kind,
    amount: after[kind] - before[kind],
    blocked: 0,
    isQuiet: true,
  })).filter((debuff) => debuff.amount > 0);
  const burst = shockBurstBetween(before, after);
  const bite = bleedBiteBetween(before, after);
  return [...laid, ...(burst ? [burst] : []), ...(bite ? [bite] : [])];
};

/** HP Bleed cost between two looks, as its own number (null for none). */
const bleedBiteBetween = (
  before: Pick<DebuffLook, 'bleedTaken'>,
  after: Pick<DebuffLook, 'bleedTaken'>
): Hit | null => {
  const amount = after.bleedTaken - before.bleedTaken;
  return amount > 0 ? { kind: 'bleedBite', amount, blocked: 0 } : null;
};

/**
 * A Shock that went off between two looks: its damage as its own number,
 * in the Shock colour. Only the engine's burst count says so, since
 * Shock also reaches 0 by fading after an action (no burst, no damage).
 */
const shockBurstBetween = (
  before: Pick<DebuffLook, 'shockDamageTaken'>,
  after: Pick<DebuffLook, 'shockDamageTaken'>
): Hit | null =>
  after.shockDamageTaken > before.shockDamageTaken
    ? {
        kind: 'shockBurst',
        amount: after.shockDamageTaken - before.shockDamageTaken,
        blocked: 0,
      }
    : null;

/**
 * The hit with split pops' damage (a Shock burst, a Bleed bite) taken
 * out, since each shows as its own number (the engine lands them in the
 * same step). Null when nothing is left.
 */
const withoutSplits = (hit: Hit | null, splits: Hit[], startingHp: number): Hit | null => {
  if (!hit || splits.length === 0) return hit;
  const split = splits.reduce((sum, pop) => sum + pop.amount, 0);
  const amount = Math.max(0, hit.amount - split);
  let hp = startingHp - amount;
  for (const pop of splits) {
    pop.isKill = !!hit.isKill && hp > 0 && pop.amount >= hp;
    hp -= pop.amount;
  }
  return amount > 0 || hit.blocked > 0 || (hit.armored ?? 0) > 0
    ? { ...hit, amount, isKill: !!hit.isKill && amount >= startingHp }
    : null;
};

/** How far down a hero's drawn box its hits land (0 top, 1 feet). */
const BODY_FOCUS_Y = 0.58;

/** The middle of a hero's drawn body, or null if it is not on screen. */
export const bodyPointOf = (uid: number, strikeIndex?: number): Point | null => {
  const body = document.querySelector(
    `[${HERO_UID_ATTR}="${uid}"] [${HERO_ANCHOR_ATTR}]`
  );
  if (!body) return null;
  const rect = body.getBoundingClientRect();
  // A golden-angle step separates consecutive strikes across the torso.
  const angle = ((uid + (strikeIndex ?? 0)) * 137.5 * Math.PI) / 180;
  const dx = strikeIndex === undefined ? 0 : Math.cos(angle) * rect.width * 0.18;
  const dy = strikeIndex === undefined ? 0 : Math.sin(angle) * rect.height * 0.16;
  return {
    x: rect.left + rect.width / 2 + dx,
    y: rect.top + rect.height * BODY_FOCUS_Y + dy,
  };
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
        missedShots: unit.missedShots ?? 0,
        armorSoaked: unit.armorSoaked ?? 0,
        wrath: unit.statuses.wrath,
        hex: unit.statuses.hex,
        poison: unit.statuses.poison,
        burn: unit.statuses.burn,
        frost: unit.statuses.frost,
        shock: unit.statuses.shock,
        bleed: unit.statuses.bleed,
        weaken: unit.statuses.weaken,
        vex: unit.statuses.vex,
        enfeeble: unit.statuses.enfeeble,
        shockDamageTaken: unit.shockDamageTaken ?? 0,
        bleedTaken: unit.bleedTaken ?? 0,
        point: bodyPointOf(unit.uid) ?? before.get(unit.uid)?.point ?? null,
      },
    ])
  );

/**
 * Hero pops since the last look: hits, and on the heroes' turn what
 * their moves gave them. Removed heroes use the final counters recorded by the engine.
 */
const heroPopsSince = (
  before: ReadonlyMap<number, HeroLook>,
  heroes: readonly HeroUnit[],
  countsBlocked: boolean,
  isHeroTurn: boolean,
  source: CardType | undefined,
  element: MagicElement | undefined,
  edge: MeleeEdge | undefined,
  strikeIndex: number
): Omit<HitPop, 'id' | 'typical'>[] =>
  [...before].flatMap(([uid, old]) => {
    const unit = heroes.find((hero) => hero.uid === uid);
    if (!unit) return [];
    const now = {
          hp: unit.hp,
          guard: unit.guard,
          damageTaken: unit.damageTaken,
          missedShots: unit.missedShots ?? 0,
          armorSoaked: unit.armorSoaked ?? 0,
          wrath: unit.statuses.wrath,
          hex: unit.statuses.hex,
          poison: unit.statuses.poison,
          burn: unit.statuses.burn,
          frost: unit.statuses.frost,
          shock: unit.statuses.shock,
          bleed: unit.statuses.bleed,
          weaken: unit.statuses.weaken,
          vex: unit.statuses.vex,
          enfeeble: unit.statuses.enfeeble,
        shockDamageTaken: unit.shockDamageTaken ?? 0,
          bleedTaken: unit.bleedTaken ?? 0,
        };
    const debuffs = debuffsBetween(old, now);
    const splits = debuffs.filter(isSplitPop);
    const found = withoutSplits(hitBetween(old, now, countsBlocked), splits, old.hp);
    // On the heroes' turn only statuses harm them: name the one that ticked.
    const tick = isHeroTurn ? tickCauseOf(old, now) : undefined;
    const hit = found ? { ...found, source, element, edge, tick } : null;
    const gains = isHeroTurn ? gainsBetween(old, now) : [];
    const misses = missesBetween(old, now);
    const point = bodyPointOf(uid, hit && !isHeroTurn ? strikeIndex : undefined) ?? old.point;
    if (!point) return [];
    return [...(hit ? [hit] : []), ...misses, ...gains, ...debuffs].map(
      (pop) => ({
        ...pop,
        uid,
        point,
      })
    );
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
 * its hits (`element`, a Magic card's, shapes its bursts; `edge`, a
 * Melee card's, picks slice or thud); on the heroes' turn the only harm to them is Hex ticking,
 * so those hits take the Curse colour.
 */
export const useHitPops = (
  heroes: readonly HeroUnit[],
  turn: number,
  isHeroTurn: boolean,
  cardType: CardType | undefined,
  element: MagicElement | undefined,
  edge: MeleeEdge | undefined,
  history: HitHistory,
  strikeIndex: number,
  fallen: readonly HeroUnit[]
): HitPop[] => {
  const [pops, add] = usePopQueue<Omit<HitPop, 'id' | 'typical'>>(history);
  const lastLookRef = useRef(new Map<number, HeroLook>());
  const lastTurnRef = useRef(turn);

  // HERO CHANGES -> NEW POPS
  useEffect(() => {
    const countsBlocked = lastTurnRef.current === turn && !isHeroTurn;
    const hits = heroPopsSince(
      lastLookRef.current,
      [...heroes, ...fallen],
      countsBlocked,
      isHeroTurn,
      isHeroTurn ? 'curse' : cardType,
      isHeroTurn ? undefined : element,
      isHeroTurn ? undefined : edge,
      strikeIndex
    );
    lastLookRef.current = lookAt(heroes, lastLookRef.current);
    lastTurnRef.current = turn;
    if (hits.length > 0) add(hits);
  }, [heroes, turn, isHeroTurn, cardType, element, edge, strikeIndex, fallen, add]);

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
    amount: kind === 'protection' && after.statuses[kind] > before.statuses[kind]
      ? after.statuses[kind] : after.statuses[kind] - before.statuses[kind],
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
  strikes = 1,
  element?: MagicElement,
  edge?: MeleeEdge,
  impactDelay = 0,
  bossImpact?: BossImpactCue
): PlayerHitPop[] => {
  const [pops, add] = usePopQueue<Hit>(history);
  const lastRef = useRef({ player, turn });
  const impactTimers = useRef(new Set<number>());
  useEffect(() => {
    const timers = impactTimers.current;
    return () => { timers.forEach(id => window.clearTimeout(id)); timers.clear(); };
  }, []);

  // VILLAIN CHANGES -> NEW POPS (a multi-hit pops once per blow)
  useEffect(() => {
    const last = lastRef.current;
    const allDebuffs = debuffsBetween(
      debuffLookOf(last.player),
      debuffLookOf(player)
    );
    const splits = allDebuffs.filter(isSplitPop);
    const debuffs = allDebuffs.filter((pop) => !isSplitPop(pop));
    const found = withoutSplits(
      hitBetween(last.player, player, last.turn === turn),
      splits, last.player.hp
    );
    // Untyped harm (no hero attack landing) is a status ticking.
    const tick =
      source === null
        ? tickCauseOf(last.player.statuses, player.statuses)
        : undefined;
    const [firstBlow, ...laterBlows] = found
      ? splitIntoBlows({ ...found, source: source ?? undefined, element, edge, tick }, strikes, last.player.hp)
      : [];
    const gains = villainGainsBetween(last.player, player);
    const misses = missesBetween(last.player, player);
    const dodges = dodgesBetween(last.player, player);
    lastRef.current = { player, turn };
    const fresh = [
      ...(firstBlow ? [bossImpact ? { ...firstBlow, bossImpact } : firstBlow] : []),
      ...misses,
      ...dodges,
      ...gains,
      ...debuffs,
    ];
    // Keep incoming projectile hit visuals and their cues on the same beat.
    // Each queued impact survives subsequent turns but not teardown.
    const queue = (hits: Hit[], delay: number) => {
      if (!hits.length) return;
      if (!delay) { add(hits); return; }
      const timers = impactTimers.current;
      const id = window.setTimeout(() => { timers.delete(id); add(hits); }, delay);
      timers.add(id);
    };
    queue(fresh, impactDelay);
    laterBlows.forEach((blow, index) =>
      queue([blow], impactDelay + (index + 1) * BLOW_STAGGER_MS)
    );
    queue(splits, impactDelay + laterBlows.length * BLOW_STAGGER_MS);
  }, [player, turn, source, strikes, element, edge, impactDelay, bossImpact, add]);

  return pops;
};
