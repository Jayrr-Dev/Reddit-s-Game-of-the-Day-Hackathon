// ===================================================================
// API CONTRACTS
// Request and response shapes for every /api route. The client and the
// server both import from here, so a change breaks the type check on
// both sides instead of failing at runtime.
// ===================================================================

import type { ConquestVersion } from '../game/conquestAreas.ts';
import type { CardId } from '../game/cards.ts';
import type { CarryCard } from '../game/carryCards.ts';
import type { PandoraRunEffect } from '../game/pandora.ts';
import type { ShopReward, ShopOffer, ShopOfferId, ShopRingId, MysteryBoxId } from '../game/ringShop.ts';
import type { RunAction, RunStats } from '../game/run.ts';
import type { UnitStatOverride, UnitStatOverrides } from '../game/unitOverrides.ts';

// --- SHARED SHAPES ---
/** A single row on the daily leaderboard. */
export type LeaderboardEntry = {
  rank: number;
  username: string;
  score: number;
};

/** The player's streak: consecutive days played, ending today or yesterday. */
export type StreakSummary = {
  current: number;
  best: number;
};

// --- GET /api/init ---
export type InitResponse = {
  accountId?: string;
  appVersion?: string;
  lifetimeWins?: number;
  xpStartWins?: number | undefined;
  gold?: number;
  type: 'init';
  postId: string;
  dailyKey: string;
  username: string | null;
  bestScoreToday: number | null;
  streak: StreakSummary;
  /** True once the player has started today's ranked run. */
  hasStartedRankedRun: boolean;
  /** True when the viewer may edit unit stats (checked again on save). */
  isAdmin: boolean;
  /** Admin balance changes laid over the hero catalog. */
  unitOverrides: UnitStatOverrides;
};

// --- POST /api/admin/unit-stats ---
// Admin only. Saves one unit's stat override; null resets it to the catalog.
export type SaveUnitStatsRequest = {
  heroId: string;
  override: UnitStatOverride | null;
};

export type SaveUnitStatsResponse = {
  type: 'unitStats';
  unitOverrides: UnitStatOverrides;
};

// --- GET /api/profile ---
// The player's saved build, wins, and item bag.
export type ProfileResponse = {
  build: import('../game/playerBuild.ts').PlayerBuild;
  wins: number;
  xpStartWins?: number | undefined;
  /** Gold balance on the player account. */
  gold: number;
  shopRings: ShopRingId[];
  carryCards: CarryCard[];
  nextEffect?: PandoraRunEffect;
  items: import('../game/items.ts').ItemBag;
  /** What the player has unlocked in runs (Illusion Training content). */
  unlocks: import('../game/unlocks.ts').Unlocks;
};

// --- POST /api/profile/use-item ---
// Spends one item from the player's bag. Admins use items for free.
export type UseItemRequest = { itemId: string };
export type UseItemResponse = {
  items: import('../game/items.ts').ItemBag;
  /** False when an admin used the item without spending it. */
  spent: boolean;
};

// --- POST /api/profile/discard-item ---
// The Inventory trash: destroys every copy of one item (UseItemRequest body).
export type DiscardItemResponse = { items: import('../game/items.ts').ItemBag };

// --- POST /api/run/start ---
// Called when the player begins a run. The first run of the day is the
// ranked one; any later run is practice and never touches the board.
export type RingShopResponse = {
  offerDay: string;
  gold: number;
  offers: ShopOffer[];
  opened: MysteryBoxId[];
  collectedAll: boolean;
  testVisit?: string;
  testItems?: import('../game/items.ts').ItemBag;
  carryCards: CarryCard[];
  nextEffect?: PandoraRunEffect;
  imbueBought: boolean;
  owned: ShopRingId[];
};
export type BuyRingRequest = { ringId: ShopOfferId; offerDay: string; testVisit?: string };
export type { ShopReward } from '../game/ringShop.ts';
export type BuyRingResponse = { status: 'bought' | 'owned' | 'short' | 'stale' | 'retry'; shop: RingShopResponse; reward?: ShopReward };
export type RunProfile = { id: string; wins: number; shopRings?: ShopRingId[]; pandoraEffect?: PandoraRunEffect; cardRules?: 1; progressionVersion?: 2; conquestVersion?: ConquestVersion; xpStartWins?: number; carriedCard?: CardId; carriedCards?: CardId[] };
export type StartRunResponse = {
  build?: import('../game/playerBuild.ts').PlayerBuild;
  profile?: RunProfile;
  type: 'runStart';
  isRanked: boolean;
};

// --- POST /api/run/finish ---
// The client sends its action log, not a score. The server replays the
// log with the shared engine and computes the score itself.
export type FinishRunRequest = {
  runId?: string;
  actions: RunAction[];
};

export type FinishRunResponse = {
  type: 'runFinish';
  score: number;
  stats: RunStats;
  isRanked: boolean;
  bestScoreToday: number | null;
  rank: number | null;
  streak: StreakSummary;
};

// --- GET /api/leaderboard ---
export type LeaderboardResponse = {
  type: 'leaderboard';
  dailyKey: string;
  entries: LeaderboardEntry[];
};

// --- ERRORS ---
/** Every failed /api call returns this shape with a non-2xx status. */
export type ApiErrorResponse = {
  status: 'error';
  message: string;
};
