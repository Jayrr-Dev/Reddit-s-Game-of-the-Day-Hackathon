// ===================================================================
// GAME TYPES
// The vocabulary of Villain Arc. Catalogs (cards, heroes) are data that
// match these shapes, and every rule is a pure function over them.
// ===================================================================

import type { CardId } from './cards.ts';
import type { HeroId } from './heroes.ts';
import type { RngState } from './rng.ts';

// --- STATUSES ---
/**
 * Lingering effects on a combatant (shroud, the block value, lives on the
 * combatant itself because it resets every turn):
 * - hex:   loses this much HP at the end of its turn, then hex drops by 1
 * - dread: deals 25% less attack damage; drops by 1 at the end of its turn
 * - wrath: adds this much to every hit; lasts the whole fight
 */
export type StatusId = 'hex' | 'dread' | 'wrath';
export type Statuses = Record<StatusId, number>;

/** Anything with HP that fights: the villain or a hero. */
export type Combatant = {
  hp: number;
  maxHp: number;
  /** Absorbs damage before HP. Clears at the start of the owner's turn. */
  shroud: number;
  statuses: Statuses;
};

// --- CARDS ---
/** Who a hostile card effect hits: the tapped hero or every hero. */
export type CardTarget = 'one' | 'all';

/** One step of a card. A card's effects resolve in order. */
export type CardEffect =
  | { kind: 'damage'; amount: number; hits: number; target: CardTarget }
  | { kind: 'hex'; amount: number; target: CardTarget }
  | { kind: 'dread'; amount: number; target: CardTarget }
  /** Deals damage equal to the target's hex times `multiplier`. */
  | { kind: 'reap'; multiplier: number }
  | { kind: 'shroud'; amount: number }
  | { kind: 'wrath'; amount: number }
  | { kind: 'draw'; amount: number }
  | { kind: 'energy'; amount: number }
  | { kind: 'heal'; amount: number };

export type CardRarity = 'starter' | 'common' | 'uncommon' | 'rare';

export type CardDef = {
  name: string;
  cost: number;
  rarity: CardRarity;
  effects: readonly CardEffect[];
  /** A fading card leaves the fight after it is played. */
  fades: boolean;
};

// --- HEROES ---
/** One step of a hero's move. `allies` means every living hero. */
export type HeroEffect =
  | { kind: 'attack'; amount: number; hits: number }
  | { kind: 'hex'; amount: number }
  | { kind: 'dread'; amount: number }
  | { kind: 'shroud'; amount: number; who: 'self' | 'allies' }
  | { kind: 'wrath'; amount: number; who: 'self' | 'allies' }
  | { kind: 'heal'; amount: number; who: 'self' | 'allies' };

export type HeroMove = {
  name: string;
  effects: readonly HeroEffect[];
};

export type HeroTier = 'grunt' | 'elite' | 'champion';

export type HeroDef = {
  name: string;
  tier: HeroTier;
  maxHp: number;
  /** Moves repeat in order, so players can read and plan around them. */
  moves: readonly HeroMove[];
  /** Portrait hue (0 to 360). Each hero gets its own heraldic colour. */
  hue: number;
};

// --- COMBAT STATE ---
/** A hero on the field. `uid` tells two Archers apart for targeting. */
export type HeroUnit = Combatant & {
  uid: number;
  heroId: HeroId;
  moveIndex: number;
  /** Strength multiplier from how deep into the kingdom this fight is. */
  might: number;
};

export type CombatState = {
  player: Combatant;
  heroes: HeroUnit[];
  energy: number;
  hand: CardId[];
  drawPile: CardId[];
  discardPile: CardId[];
  fadedPile: CardId[];
  turn: number;
  /** Heroes defeated so far in this fight. */
  slain: number;
  rng: RngState;
};

export type CombatOutcome = 'ongoing' | 'won' | 'lost';
