import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../lib/apiClient';
import { useAccountId } from '../../../lib/accountId';
import { GoldCoins } from '../profileParts';
import type { RingShopResponse } from '../../../../shared/types/api';
import type { ShopRingId } from '../../../../shared/game/ringShop';
import './ring-counter.css';

export function RingCounter({ onSale, onBuyingChange }: { onSale: () => void; onBuyingChange: (buying: boolean) => void }) {
  const account = useAccountId();
  const busyRef = useRef(false);
  const [shop, setShop] = useState<RingShopResponse>();
  const [busy, setBusy] = useState<ShopRingId>();
  const [note, setNote] = useState('');
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!account) return;
    let active = true;
    setError(false);
    apiClient.ringShop().then(result => { if (active) setShop(result); }).catch(() => {
      if (active) setError(true);
    });
    return () => { active = false; };
  }, [account, retry]);
  async function buy(id: ShopRingId) {
    if (!shop || busyRef.current) return;
    busyRef.current = true;
    onBuyingChange(true);
    setBusy(id);
    setNote('');
    try {
      const result = await apiClient.buyRing({ ringId: id, offerDay: shop.offerDay });
      setShop(result.shop);
      if (result.status === 'bought') onSale();
      setNote(result.status === 'bought' ? 'Ring added to your Inventory.' :
        result.status === 'owned' ? 'You already own this ring.' :
        result.status === 'short' ? 'Not enough Gold.' :
        result.status === 'stale' ? 'Prices changed. Review the new offer before buying.' :
        'The shop is busy. Please try again.');
    } catch {
      setNote('Purchase could not be confirmed. Check the shop again before retrying.');
      setRetry(value => value + 1);
    } finally {
      busyRef.current = false;
      onBuyingChange(false);
      setBusy(undefined);
    }
  }
  if (!account) return <section className="ring-counter"><p>Sign in to buy rings with Gold.</p></section>;
  if (error) return <section className="ring-counter"><p>Could not load the shop.</p><button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></section>;
  if (!shop) return <section className="ring-counter" role="status"><p>Loading rings…</p></section>;
  return <section className="ring-counter" aria-label="Rings for sale">
    <div className="ring-counter-heading">
      <h3>Rings for sale</h3>
      <span className="ring-counter-gold" aria-label={shop.gold + ' Gold available'}><GoldCoins /> {shop.gold.toLocaleString()} Gold</span>
    </div>
    <div className="ring-counter-scroll">
      <p className="ring-counter-hint">Prices change daily. Equip purchased rings in Profile once you unlock a ring slot.</p>
      <ul>
        {shop.offers.map(offer => {
          const owned = shop.owned.includes(offer.id);
          const short = shop.gold < offer.price;
          return <li key={offer.id} className="ring-counter-item" data-rarity={offer.rarity} title={offer.flavor}>
            <div><strong>{offer.name}</strong><span className="ring-counter-rarity">{offer.rarity}</span></div>
            <button type="button" disabled={owned || short || busy !== undefined} aria-label={owned ? offer.name + ' owned' : 'Buy ' + offer.name + ' for ' + offer.price + ' Gold' + (short ? ', not enough Gold' : '')} onClick={() => void buy(offer.id)}>
              {owned ? 'Owned' : busy === offer.id ? 'Buying…' : <><GoldCoins /> {offer.price}</>}
            </button>
          </li>;
        })}
      </ul>
    </div>
    {note && <p className="ring-counter-note" role="status">{note}</p>}
  </section>;
}
