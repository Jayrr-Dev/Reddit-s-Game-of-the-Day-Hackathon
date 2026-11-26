// ===================================================================
// GAME CONSTANTS
// One source of truth for values shared by the client and the server.
// Change the game's identity and limits here, never inline.
// ===================================================================

// --- GAME IDENTITY ---
/** Display name used in post titles and on the title screen. */
export const GAME_TITLE = 'Villain Run';

// --- LEADERBOARD LIMITS ---
/** How many entries the daily leaderboard returns. */
export const LEADERBOARD_SIZE = 10;
/** How many of those rows fit under the title and results screens. */
export const LEADERBOARD_PREVIEW_ROWS = 3;

// --- REDIS RETENTION ---
/** Daily keys expire after this many days so Redis storage stays bounded. */
export const DAILY_DATA_TTL_DAYS = 30;

// --- PLAYER INVENTORY ---
/** Each inventory section shows at least this many slots, empty ones included, like an RPG bag. */
export const INVENTORY_MIN_SLOTS = 8;
