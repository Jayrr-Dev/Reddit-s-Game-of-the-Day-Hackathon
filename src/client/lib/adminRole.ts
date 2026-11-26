// ===================================================================
// ADMIN ROLE
// True when the viewer is an admin (from /api/init). It only decides
// whether admin controls show; the server checks again on every save.
// ===================================================================

import { createContext, useContext } from 'react';

export const IsAdmin = createContext(false);

/** True when the viewer may see admin controls. */
export const useIsAdmin = () => useContext(IsAdmin);
