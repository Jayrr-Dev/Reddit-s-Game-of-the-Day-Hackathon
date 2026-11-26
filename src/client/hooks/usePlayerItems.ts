// ===================================================================
// USE PLAYER ITEMS
// The player's item bag on the client. Signed-in players spend and
// trash items through the server, which owns the counts; a local
// player (no Reddit account, e.g. dev) uses an in-memory starting bag.
// ===================================================================
import { useCallback, useState } from 'react';
import { discardStack, spendItem, startingBag, type ItemBag, type ItemId } from '../../shared/game/items';
import { apiClient } from '../lib/apiClient';

/** Holds the bag; spend and discard resolve false when the change fails. */
export function usePlayerItems(accountId: string | undefined) {
  const [items, setItems] = useState<ItemBag>(startingBag);
  /** Spends one item (a respec). */
  const spend = useCallback(
    async (id: ItemId): Promise<boolean> => {
      if (!accountId) {
        const next = spendItem(items, id);
        if (next) setItems(next);
        return !!next;
      }
      try {
        setItems((await apiClient.useItem({ itemId: id })).items);
        return true;
      } catch {
        return false;
      }
    },
    [accountId, items]
  );
  /** Destroys the whole stack of one item (the trash). */
  const discard = useCallback(
    async (id: ItemId): Promise<boolean> => {
      if (!accountId) {
        setItems((bag) => discardStack(bag, id));
        return true;
      }
      try {
        setItems((await apiClient.discardItem({ itemId: id })).items);
        return true;
      } catch {
        return false;
      }
    },
    [accountId]
  );
  return { items, setItems, spend, discard } as const;
}
