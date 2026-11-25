// ===================================================================
// API CONTRACTS
// Request and response shapes for every /api route. The client and the
// server both import from here, so a change breaks the type check on
// both sides instead of failing at runtime.
// ===================================================================

import type { RunAction, RunStats } from '../game/run.ts';

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
  lifetimeWins?: number;
  type: 'init';
  postId: string;
  dailyKey: string;
  username: string | null;
  bestScoreToday: number | null;
  streak: StreakSummary;
  /** True once the player has started today's ranked run. */
  hasStartedRankedRun: boolean;
};

// --- POST /api/run/start ---
// Called when the player begins a run. The first run of the day is the
// ranked one; any later run is practice and never touches the board.
export type StartRunResponse = {
  build?: import('../game/playerBuild.ts').PlayerBuild;
  profile?: { id: string; wins: number };
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
