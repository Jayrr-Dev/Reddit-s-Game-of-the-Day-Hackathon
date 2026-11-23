// ===================================================================
// GAME CONSTANTS
// One source of truth for values shared by the client and the server.
// Change the game's identity and limits here, never inline.
// ===================================================================

// --- GAME IDENTITY ---
/** Display name used in post titles and the splash screen. */
export const GAME_TITLE = 'Villain Arc';

// --- LEADERBOARD LIMITS ---
/** How many entries the daily leaderboard returns. */
export const LEADERBOARD_SIZE = 10;

// --- REDIS RETENTION ---
/** Daily keys expire after this many days so Redis storage stays bounded. */
export const DAILY_DATA_TTL_DAYS = 30;
