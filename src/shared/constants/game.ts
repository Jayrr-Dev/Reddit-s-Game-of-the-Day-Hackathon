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
/** Cells in the backpack grid (4 x 4). It grows by whole rows if a player owns more. */
export const BACKPACK_SLOTS = 12;
/** Columns in the backpack grid. */
export const BACKPACK_COLUMNS = 4;
/** Cells in the belt strip under the backpack; with the trash it fills one 4-square row. */
export const BELT_SLOTS = 3;
