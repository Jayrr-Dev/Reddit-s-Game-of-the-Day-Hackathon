// ===================================================================
// API CONTRACTS
// Request and response shapes for every /api route. The client and the
// server both import from here, so a change breaks the type check on
// both sides instead of failing at runtime.
// ===================================================================

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
  type: 'init';
  postId: string;
  dailyKey: string;
  username: string | null;
  bestScoreToday: number | null;
  streak: StreakSummary;
};

// --- POST /api/score ---
export type SubmitScoreRequest = {
  score: number;
};

export type SubmitScoreResponse = {
  type: 'score';
  bestScoreToday: number;
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
