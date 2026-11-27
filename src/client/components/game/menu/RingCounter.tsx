import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../lib/apiClient';
import { useAccountId } from '../../../lib/accountId';
import { GoldCoins } from '../profileParts';
import type { RingShopResponse, ShopReward } from '../../../../shared/types/api';
import { getItem, itemQuantity, REALM_APPLE, SHOP_APPLE, type ItemBag, type ShopApple } from '../../../../shared/game/items';
import { getCard } from '../../../../shared/game/cards';
import type { CarryCard } from '../../../../shared/game/carryCards';
import { Glyph } from '../../ui/Glyph';
import type { ShopOfferId, ShopRingId } from '../../../../shared/game/ringShop';
import { MysteryChest, MysteryReveal } from './MysteryReveal';
import { ShopJewelryArt } from './ShopJewelryArt';
import './ring-counter.css';

export function RingCounter({ onSale, onReroll, onBuyingChange, onTestInventory }: { onSale: () => void; onReroll: (item: ShopApple) => void; onBuyingChange: (buying: boolean) => void; onTestInventory?: (items: ShopRingId[], visit: string, carry: CarryCard[]) => void }) {
  const account = useAccountId();
  const busyRef = useRef(false);
  const testVisitRef = useRef<string>(undefined);
  const [shop, setShop] = useState<RingShopResponse>();
  const [busy, setBusy] = useState<ShopOfferId>();
  const [selected, setSelected] = useState<ShopOfferId>();
  const [apples, setApples] = useState<ItemBag>({});
  const [offeringApple, setOfferingApple] = useState<ShopApple>();
  const [reward, setReward] = useState<ShopReward>();
  const [note, setNote] = useState('');
  const visibleApples = shop?.testVisit ? shop.testItems ?? {} : testVisitRef.current ? {} : apples;
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!account) return;
    let active = true;
    setError(false);
    apiClient.profile().then(result => { if (active) setApples(result.items); }).catch(() => {});
    apiClient.ringShop(testVisitRef.current).then(result => {
      if (!active) return;
      setShop(result);
      if (result.testVisit) testVisitRef.current = result.testVisit;
      else if (testVisitRef.current) setNote('Test visit expired. Reopen the Shop.');
      if (result.testVisit) onTestInventory?.(result.owned, result.testVisit, result.carryCards ?? []);
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

  useEffect(() => {
    const hour = 60 * 60 * 1000;
    const tick = () => { if (!busyRef.current) setRetry(value => value + 1); };
    let timer: number;
    const first = window.setTimeout(() => { tick(); timer = window.setInterval(tick, hour); }, hour - Date.now() % hour + 800);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, []);

  /** Revalidate the offer, price and wallet on the server before confirming a sale. */
  async function buy(id: ShopOfferId) {
    if (!shop || busyRef.current) return;
    busyRef.current = true;
    onBuyingChange(true);
    setBusy(id);
    setNote('');
    let revealing = false;
    try {
      const result = await apiClient.buyRing({ ringId: id, offerDay: shop.offerDay, ...(shop.testVisit && { testVisit: shop.testVisit }) });
      setShop(result.shop);
      if (result.shop.testVisit) onTestInventory?.(result.shop.owned, result.shop.testVisit, result.shop.carryCards ?? []);
      if (result.status === 'bought' && !result.reward) onSale();
      if (result.reward) { revealing = true; setReward(result.reward); }
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
      if (!revealing) onBuyingChange(false);
      setBusy(undefined);
    }
  }

  /** Offer a real item; leave the account Gold and admin visit intact. */
  async function giftApple(item: ShopApple) {
    if (!itemQuantity(visibleApples, item) || busyRef.current) return;
    busyRef.current = true;
    onBuyingChange(true);
    setOfferingApple(item);
    setNote('');
    try {
      const result = await apiClient.offerApple(item, testVisitRef.current);
      if (result.shop) setShop(result.shop);
      else setApples(result.items);
      setSelected(undefined);
      onReroll(item);
      setNote(item === REALM_APPLE ? 'Realm Apple given. Legendary stock refreshed.' : 'Apple given. Stock refreshed.');
      if (!result.shop) setRetry(value => value + 1);
    } catch {
      setNote('The apple could not be offered. Check your Inventory.');
    } finally {
      busyRef.current = false;
      onBuyingChange(false);
      setOfferingApple(undefined);
    }
  }

  if (!account) return <p className="ring-counter-state">Sign in to buy jewelry with Gold.</p>;
  if (error) return <div className="ring-counter-state">Could not load the shop. <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></div>;
  if (!shop) return <p className="ring-counter-state" role="status">Loading stock.</p>;
  return <section className="ring-counter" aria-label="Metatron's stock">
    <span className="ring-counter-gold" aria-label={shop.gold + (shop.testVisit ? ' test Gold available' : ' Gold available')}><GoldCoins /> {shop.gold.toLocaleString()} {shop.testVisit ? 'Test Gold' : 'Gold'}</span>
    <div className="shop-apple-offer">
      {([SHOP_APPLE, REALM_APPLE] as const).map(item => {
        const count = itemQuantity(visibleApples, item);
        const name = item === SHOP_APPLE ? 'Apple' : getItem(item).name;
        return count > 0 && <div key={item} className="shop-apple-row">
          <span>{name}: {count}</span>
          <button type="button" className="ring-counter-price" disabled={busy !== undefined || offeringApple !== undefined}
            title={item === REALM_APPLE ? 'Reroll with a guaranteed Legendary' : 'Reroll the shop'}
            onClick={() => void giftApple(item)}>{offeringApple === item ? 'Giving…' : 'Give ' + name}</button>
        </div>;
      })}
    </div>
    <div className="ring-counter-layer">
      <div className="ring-counter-frame">
        <ul className="ring-counter-stock">
          {shop.offers.map(offer => {
            const box = offer.slot === 'box';
            const owned = offer.slot === 'box' ? shop.opened.includes(offer.id) : offer.slot === 'card' ? shop.imbueBought : shop.owned.includes(offer.id);
            const inspecting = selected === offer.id;
            const detailsId = 'shop-details-' + offer.id;
            const short = shop.gold < offer.price;
            return <li key={offer.id} className="ring-counter-item" data-rarity={offer.rarity} data-box={box || undefined}>
              <span className="ring-counter-name" title={offer.name}>{offer.name}</span>
              <button type="button" className="ring-counter-disc" aria-expanded={inspecting} aria-controls={inspecting ? detailsId : undefined} data-shop-inspect
                aria-label={'Inspect ' + offer.name} onClick={() => { setNote(''); setSelected(previous => previous === offer.id ? undefined : offer.id); }}>
                {offer.slot === 'box' ? <MysteryChest /> : offer.slot === 'card' ? <Glyph name="altar" className="size-8" /> : <ShopJewelryArt offer={offer} />}
              </button>
              {inspecting && <div className="ring-counter-popover" id={detailsId} data-shop-inspect>
                <strong>{offer.name}</strong>
                {!box && <small>{offer.rarity} {offer.slot === 'card' ? (getCard(offer.cardId).type === 'imbue' ? 'Imbue Card' : 'Card') : offer.slot === 'amulet' ? 'Amulet' : 'Ring'}</small>}
                <p>{offer.flavor}</p>
                <span>{offer.slot === 'box' ? 'May give jewelry, change your Gold, or bless or curse your next conquest.' : offer.slot === 'card' ? 'Added to Inventory. Use Bring Card when starting a conquest.' : offer.effect ?? 'Cosmetic'}</span>
              </div>}
              <button type="button" className="ring-counter-price" disabled={owned || short || busy !== undefined || offeringApple !== undefined}
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
    {reward && <MysteryReveal reward={reward} onClose={() => { setReward(undefined); onSale(); onBuyingChange(false); }} />}
  </section>;
}
