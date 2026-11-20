// ===================================================================
// REDIS KEYS
// The only place Redis key names are built. Every module that touches
// Redis asks this file for its key, so renaming a key or changing its
// layout is a one-line change and keys can never drift apart.
// ===================================================================

export const redisKeys = {
  /** Sorted set: username -> best score for one day. */
  dailyLeaderboard: (dailyKey: string) => `leaderboard:${dailyKey}`,
  /** Hash: one player's streak record (current, best, lastPlayedKey). */
  playerStreak: (userId: string) => `streak:${userId}`,
  /** String: the post id created for one day, so the daily post is made once. */
  dailyPostId: (dailyKey: string) => `daily-post:${dailyKey}`,
} as const;
