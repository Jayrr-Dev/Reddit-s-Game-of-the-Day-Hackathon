// ===================================================================
// REDIS KEYS
// The only place Redis key names are built. Every module that touches
// Redis asks this file for its key, so renaming a key or changing its
// layout is a one-line change and keys can never drift apart.
// ===================================================================

export const redisKeys = {
  ringPurchases: (userId: string) => `profile:ring-purchases:v1:${userId}`,
  victories: (userId: string) => `progress:v1:${userId}:wins`,
  runBaseline: (userId: string, day: string, id: string) => `progress:v1:${userId}:${day}:${id}`,
  /** Sorted set: username -> best score for one day. */
  dailyLeaderboard: (dailyKey: string) => `leaderboard:${dailyKey}`,
  /** Hash: one player's streak record (current, best, lastPlayedKey). */
  playerStreak: (userId: string) => `streak:${userId}`,
  /** String: "started" or "finished" for a player's one ranked run of a day. */
  rankedRun: (dailyKey: string, userId: string) =>
    `ranked-run:${dailyKey}:${userId}`,
  /** String: the post id created for one day, so the daily post is made once. */
  dailyPostId: (dailyKey: string) => `daily-post:${dailyKey}`,
  /** String (JSON): one player's profile build (starter decks and character). */
  playerBuild: (userId: string) => `profile:build:v1:${userId}`,
  /** String (JSON): one player's item bag, item id -> count. Server-owned. */
  playerItems: (userId: string) => `profile:items:v1:${userId}`,
  /** String (JSON): what a player has unlocked in runs (kills, cards, maps). Server-owned. */
  playerUnlocks: (userId: string) => `profile:unlocks:v1:${userId}`,
  /** String (JSON): admin unit stat overrides, hero id -> changed stats. */
  unitOverrides: () => 'balance:v1:unit-overrides',
} as const;
