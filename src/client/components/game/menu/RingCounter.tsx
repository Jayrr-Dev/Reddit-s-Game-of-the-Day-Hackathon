import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../lib/apiClient';
import { useAccountId } from '../../../lib/accountId';
import { GoldCoins } from '../profileParts';
import type { RingShopResponse, ShopReward } from '../../../../shared/types/api';
import type { ShopOfferId, ShopRingId } from '../../../../shared/game/ringShop';
import { MysteryChest, MysteryReveal } from './MysteryReveal';
import { ShopJewelryArt } from './ShopJewelryArt';
import './ring-counter.css';

export function RingCounter({ onSale, onBuyingChange, onTestInventory }: { onSale: () => void; onBuyingChange: (buying: boolean) => void; onTestInventory?: (items: ShopRingId[], visit: string) => void }) {
  const account = useAccountId();
  const busyRef = useRef(false);
  const testVisitRef = useRef<string>(undefined);
  const [shop, setShop] = useState<RingShopResponse>();
  const [busy, setBusy] = useState<ShopOfferId>();
  const [selected, setSelected] = useState<ShopOfferId>();
  const [reward, setReward] = useState<ShopReward>();
  const [note, setNote] = useState('');
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!account) return;
    let active = true;
    setError(false);
    apiClient.ringShop(testVisitRef.current).then(result => {
      if (!active) return;
      setShop(result);
      if (result.testVisit) testVisitRef.current = result.testVisit;
      else if (testVisitRef.current) setNote('Test visit expired. Reopen the Shop.');
      if (result.testVisit) onTestInventory?.(result.owned, result.testVisit);
    }).catch(() => {
      if (active) setError(true);
    });
    return () => { active = false; };
  }, [account, retry, onTestInventory]);

  useEffect(() => {
    if (!selected) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest('[data-shop-inspect]')) setSelected(undefined);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(undefined);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [selected]);

  /** Revalidate the offer, price and wallet on the server before confirming a sale. */
  async function buy(id: ShopOfferId) {
    if (!shop || busyRef.current) return;
    busyRef.current = true;
    onBuyingChange(true);
    setBusy(id);
    setNote('');
    try {
      const result = await apiClient.buyRing({ ringId: id, offerDay: shop.offerDay, ...(shop.testVisit && { testVisit: shop.testVisit }) });
      setShop(result.shop);
      if (result.shop.testVisit) onTestInventory?.(result.shop.owned, result.shop.testVisit);
      if (result.status === 'bought') onSale();
      if (result.reward) setReward(result.reward);
      setNote(result.status === 'bought' ? (result.shop.testVisit ? 'Test result applies to this visit only.' : 'Bought. Equip it in Profile.') :
        result.status === 'owned' ? 'This offer is no longer available.' :
        result.status === 'short' ? 'Not enough Gold.' :
        result.status === 'stale' ? (shop.testVisit && !result.shop.testVisit ? 'Test visit expired. Reopen the Shop.' : 'Stock changed. Check the new offers.') :
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

  if (!account) return <p className="ring-counter-state">Sign in to buy jewelry with Gold.</p>;
  if (error) return <div className="ring-counter-state">Could not load the shop. <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></div>;
  if (!shop) return <p className="ring-counter-state" role="status">Loading stock.</p>;
  return <section className="ring-counter" aria-label="Jewelry for sale">
    <span className="ring-counter-gold" aria-label={shop.gold + (shop.testVisit ? ' test Gold available' : ' Gold available')}><GoldCoins /> {shop.gold.toLocaleString()} {shop.testVisit ? 'Test Gold' : 'Gold'}</span>
    <div className="ring-counter-layer">
      <div className="ring-counter-frame">
        <ul className="ring-counter-stock">
          {shop.offers.map(offer => {
            const box = offer.slot === 'box';
            const owned = box ? shop.opened.includes(offer.id) : shop.owned.includes(offer.id);
            const inspecting = selected === offer.id;
            const detailsId = 'shop-details-' + offer.id;
            const short = shop.gold < offer.price;
            return <li key={offer.id} className="ring-counter-item" data-rarity={offer.rarity} data-box={box || undefined}>
              <span className="ring-counter-name" title={offer.name}>{offer.name}</span>
              <button type="button" className="ring-counter-disc" aria-expanded={inspecting} aria-controls={inspecting ? detailsId : undefined} data-shop-inspect
                aria-label={'Inspect ' + offer.name} onClick={() => { setNote(''); setSelected(previous => previous === offer.id ? undefined : offer.id); }}>
                {box ? <MysteryChest /> : <ShopJewelryArt offer={offer} />}
              </button>
              {inspecting && <div className="ring-counter-popover" id={detailsId} data-shop-inspect>
                <strong>{offer.name}</strong>
                {!box && <small>{offer.rarity} {offer.slot === 'amulet' ? 'Amulet' : 'Ring'}</small>}
                <p>{offer.flavor}</p>
                <span>{box ? 'May give jewelry, change your Gold, or bless or curse your next conquest.' : offer.effect ?? 'Cosmetic'}</span>
              </div>}
              <button type="button" className="ring-counter-price" disabled={owned || short || busy !== undefined}
                aria-label={owned ? offer.name + (box ? ' opened' : ' owned') : (box ? 'Open ' : 'Buy ') + offer.name + ' for ' + offer.price + ' Gold' + (short ? ', not enough Gold' : '')}
                onClick={() => void buy(offer.id)}>
                {owned ? box ? 'Opened' : 'Owned' : busy === offer.id ? box ? 'Opening' : 'Buying' : <><GoldCoins /> {offer.price}</>}
              </button>
            </li>;
          })}
        </ul>
        <div className="ring-counter-readout">
          {note && <p role="status">{note}</p>}
        </div>
      </div>
    </div>
    {reward && <MysteryReveal reward={reward} onClose={() => setReward(undefined)} />}
  </section>;
}
