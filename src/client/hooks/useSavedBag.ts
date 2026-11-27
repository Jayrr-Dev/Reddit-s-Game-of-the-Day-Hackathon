// --- USE SAVED BAG ---
// The player's saved consumables, bag layout and wins, read once from
// the profile so a mid-battle character sheet can show the same
// Inventory and Profile tabs as the menu's Profile page.
import { useEffect, useState } from 'react';
import type { BagLayout } from '../../shared/game/bagLayout';
import { useAccountId } from '../lib/accountId';
import { apiClient } from '../lib/apiClient';
import { usePlayerItems } from './usePlayerItems';

/** Loads the saved bag on mount; the layout can be rearranged for this fight. */
export function useSavedBag() {
  const accountId = useAccountId();
  const { items, setItems, discard } = usePlayerItems(accountId);
  const [layout, setLayout] = useState<BagLayout | undefined>();
  const [wallet, setWallet] = useState({ wins: 0, gold: 0 });
  useEffect(() => {
    if (!accountId) return;
    let live = true;
    apiClient
      .profile()
      .then((result) => {
        if (!live) return;
        setItems(result.items);
        setLayout(result.build.bag);
        setWallet({ wins: result.wins, gold: result.gold });
      })
      .catch(() => {}); // Offline: the tabs still show the run's character and deck.
    return () => {
      live = false;
    };
  }, [accountId, setItems]);
  return { items, discard, layout, setLayout, ...wallet } as const;
}
