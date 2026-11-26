// ===================================================================
// USE UNLOCKS
// What the viewer may see in Illusion Training. Admins get null (all
// content); everyone else gets their saved unlocks from the profile,
// and nothing until it loads (a signed-out viewer never unlocks).
// ===================================================================
import { useEffect, useState } from 'react';
import { EMPTY_UNLOCKS, type UnlockAccess } from '../../shared/game/unlocks';
import { useAccountId } from '../lib/accountId';
import { useIsAdmin } from '../lib/adminRole';
import { apiClient } from '../lib/apiClient';

/** The viewer's unlock access: null for admins, else their unlocks. */
export const useUnlocks = (): UnlockAccess => {
  const isAdmin = useIsAdmin();
  const accountId = useAccountId();
  const [unlocks, setUnlocks] = useState(EMPTY_UNLOCKS);
  useEffect(() => {
    if (isAdmin || !accountId) return;
    let isLive = true;
    apiClient.profile()
      .then((profile) => { if (isLive) setUnlocks(profile.unlocks); })
      .catch(() => { /* Keep the locked view; training still works. */ });
    return () => { isLive = false; };
  }, [isAdmin, accountId]);
  return isAdmin ? null : unlocks;
};
