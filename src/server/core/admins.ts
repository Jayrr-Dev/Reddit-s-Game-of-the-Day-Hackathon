// ===================================================================
// ADMINS
// The Reddit accounts with admin privileges (today: editing unit stats
// in game for balancing). This list is the only place admins are named.
// The server checks it on every admin request, so hiding the edit
// controls on the client is a convenience, not the protection.
// ===================================================================

import { reddit } from '@devvit/web/server';

// --- CONFIG ---
/** Reddit usernames (without u/) that are admins. */
const ADMIN_USERNAMES: readonly string[] = ['IanoMasuel'];

// --- CHECKS ---
/** True when the username is on the admin list (Reddit names ignore case). */
export const isAdminUsername = (username: string | null | undefined): boolean =>
  !!username &&
  ADMIN_USERNAMES.some((admin) => admin.toLowerCase() === username.toLowerCase());

/** True when the user making this request is an admin. */
export const isCurrentUserAdmin = async (): Promise<boolean> =>
  isAdminUsername(await reddit.getCurrentUsername());
