// ===================================================================
// USE PLAYER ITEMS
// The player's item bag on the client. Signed-in players spend items
// through the server, which owns the counts; a local player (no Reddit
// account, e.g. dev) spends from an in-memory starting bag.
// ===================================================================
import { useCallback, useState } from 'react';
import { spendItem, startingBag, type ItemBag, type ItemId } from '../../shared/game/items';
import { apiClient } from '../lib/apiClient';

/** Holds the bag and spends one item at a time; spend resolves false when it fails. */
export function usePlayerItems(accountId: string | undefined) {
  const [items, setItems] = useState<ItemBag>(startingBag);
  const spend = useCallback(
    async (id: ItemId): Promise<boolean> => {
      if (!accountId) {
        const next = spendItem(items, id);
        if (next) setItems(next);
        return !!next;
      }
      try {
        const result = await apiClient.useItem({ itemId: id });
        setItems(result.items);
        return true;
      } catch {
        return false;
      }
    },
    [accountId, items]
  );
  return { items, setItems, spend } as const;
}
