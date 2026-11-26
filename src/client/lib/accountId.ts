// --- ACCOUNT ID ---
// The signed-in player's account (from /api/init), or undefined for a
// local player. Lets deep screens such as the mid-battle character sheet
// load the saved bag without threading the id through every fight view.
import { createContext, useContext } from 'react';

export const AccountId = createContext<string | undefined>(undefined);

/** The viewer's account id, if signed in. */
export const useAccountId = () => useContext(AccountId);
