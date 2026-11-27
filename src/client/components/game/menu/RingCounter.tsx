import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { playSound } from '../../../lib/gameAudio';
import { apiClient } from '../../../lib/apiClient';
import { useAccountId } from '../../../lib/accountId';
import { ShopAppleIcon } from './ShopAppleIcon';
import { GoldCoins } from '../profileParts';
import type { RingShopResponse, ShopReward } from '../../../../shared/types/api';
import { getItem, itemQuantity, REALM_APPLE, SHOP_APPLE, type ItemBag, type ShopApple } from '../../../../shared/game/items';
import type { CarryCard } from '../../../../shared/game/carryCards';
import { CardView } from '../CardView';
import type { ShopOffer, ShopOfferId, ShopRingId } from '../../../../shared/game/ringShop';
import { MysteryChest, MysteryReveal } from './MysteryReveal';
import { ShopJewelryArt } from './ShopJewelryArt';
import './ring-counter.css';

/** A face-down shop card, sized like the other stock icons. */
function ShopCardBack() {
  return <svg className="shop-card-back" viewBox="0 0 54 80" aria-hidden="true">
    <rect className="shop-card-back-paper" x="2" y="2" width="50" height="76" rx="5" />
    <path className="shop-card-back-ink" d="M7 15a8 8 0 0 0 8-8h24a8 8 0 0 0 8 8v50a8 8 0 0 0-8 8H15a8 8 0 0 0-8-8ZM27 18l15 22-15 22L12 40Z" />
    <path className="shop-card-back-seal" d="M27 53c-5 0-9-4-9-9 0-4 2-6 4-8 0 3 1 4 2 5 0-6 4-10 5-14 5 5 2 10 5 13l2-3c1 3 1 5 1 7 0 5-5 9-10 9Z" />
    <path className="shop-card-back-ink" d="M27 10v5m0 50v5M10 27l5-5m24 36 5-5M10 53l5 5m24-36 5 5" />
  </svg>;
}

export function RingCounter({ onSale, onReroll, onBuyingChange, onTestInventory }: { onSale: (purchase?: Pick<ShopOffer, 'slot' | 'rarity'>) => void; onReroll: (item: ShopApple) => void; onBuyingChange: (buying: boolean) => void; onTestInventory?: (items: ShopRingId[], visit: string, carry: CarryCard[]) => void }) {
  const account = useAccountId();
  const busyRef = useRef(false);
  const testVisitRef = useRef<string>(undefined);
  const [shop, setShop] = useState<RingShopResponse>();
  const [busy, setBusy] = useState<ShopOfferId>();
  const [selected, setSelected] = useState<ShopOfferId | ShopApple>();
  const [apples, setApples] = useState<ItemBag>({});
  const [offeringApple, setOfferingApple] = useState<ShopApple>();
  const [stockMotion, setStockMotion] = useState<'gather' | 'deal'>();
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
    const offer = shop.offers.find(item => item.id === id);
    const expectedFree = offer?.slot === 'box' && offer.price === 0;
    let revealing = false;
    try {
      const result = await apiClient.buyRing({ ringId: id, offerDay: shop.offerDay,
        ...(shop.testVisit && { testVisit: shop.testVisit }), ...(expectedFree && { expectedFree: true as const }) });
      setShop(result.shop);
      if (result.shop.testVisit) onTestInventory?.(result.shop.owned, result.shop.testVisit, result.shop.carryCards ?? []);
      if (result.status === 'bought' && !result.reward) onSale(offer);
      if (result.reward) { revealing = true; setReward(result.reward); }
      setNote(result.status === 'bought' ? (offer?.slot === 'card' ? (result.shop.testVisit ? 'Check your Album.' : 'Added to Album.') : result.reward ? expectedFree ? 'Daily opening claimed.' : 'Opening paid.' : result.shop.testVisit ? '' : 'Bought. Equip it in Profile.') :
        result.status === 'owned' ? 'This offer is no longer available.' :
        result.status === 'short' ? 'Not enough Gold.' :
        result.status === 'stale' ? (shop.testVisit && !result.shop.testVisit ? 'Test visit expired. Reopen the Shop.' : expectedFree ? 'Free opening no longer available. No Gold was charged.' : 'Stock changed. Check the new offers.') :
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
    setSelected(undefined);
    const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const settle = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));
    let credited = false;
    if (animate) {
      setStockMotion('gather');
      playSound('shuffle', .89, .49);
    }
    try {
      const [result] = await Promise.all([
        apiClient.offerApple(item, testVisitRef.current),
        animate ? settle(420) : Promise.resolve(),
      ]);
      credited = true;
      if (!result.shop) setApples(result.items);
      const updated = result.shop ?? await apiClient.ringShop();
      setShop(updated);
      if (animate) {
        setStockMotion('deal');
        playSound('reward', item === REALM_APPLE ? 1.09 : .91, .42);
        await settle(490);
      }
      onReroll(item);
      setNote(item === REALM_APPLE ? 'Realm Apple given. Legendary stock refreshed.' : 'Apple given. Stock refreshed.');
    } catch {
      if (credited || !testVisitRef.current) setRetry(value => value + 1);
      setNote(credited ? 'Apple given. Checking the new stock.' : 'The apple could not be offered. Check your Inventory.');
    } finally {
      setStockMotion(undefined);
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
        const inspected = selected === item;
        const description = getItem(item).description;
        return count > 0 && <div key={item} className="shop-apple-row" data-shop-inspect>
          <button type="button" className="shop-apple-icon-button" aria-label={name + ': ' + count + ' available'}
            title={name} aria-expanded={inspected} onClick={() => { setNote(''); setSelected(inspected ? undefined : item); }}>
            <ShopAppleIcon item={item} /><span aria-hidden="true">×{count}</span>
          </button>
          {inspected && <div className="shop-apple-popover">
            <strong>{name}</strong>
            <p>{description}</p>
            <button type="button" className="ring-counter-price" disabled={busy !== undefined || offeringApple !== undefined}
              onClick={() => void giftApple(item)}>{offeringApple === item ? 'Giving…' : 'Give ' + name}</button>
          </div>}
        </div>;
      })}
    </div>
    <div className="ring-counter-layer">
      <div className="ring-counter-frame">
        <ul className="ring-counter-stock" data-stock-motion={stockMotion} aria-busy={stockMotion !== undefined}>
          {shop.offers.map((offer, slot) => {
            const box = offer.slot === 'box';
            const owned = offer.slot === 'box' ? shop.opened.includes(offer.id) : offer.slot === 'card' ? shop.imbueBought : shop.owned.includes(offer.id);
            const inspecting = selected === offer.id;
            const detailsId = 'shop-details-' + offer.id;
            const short = shop.gold < offer.price;
            const free = box && !owned && offer.price === 0;
            const priceLabel = owned ? offer.name + (box ? ' opened' : ' owned') : free ? 'Open ' + offer.name + ' for free' :
              (box ? 'Open ' : 'Buy ') + offer.name + ' for ' + offer.price + ' Gold' + (short ? ', not enough Gold' : '');
            return <li key={offer.id} className="ring-counter-item" style={{ '--shop-slot': slot } as CSSProperties} data-rarity={offer.rarity} data-box={box || undefined}>
              <span className="ring-counter-name" title={offer.name}>{offer.name}</span>
              <button type="button" className="ring-counter-disc" data-card={offer.slot === 'card' || undefined} aria-expanded={inspecting} aria-controls={inspecting ? detailsId : undefined} data-shop-inspect
                aria-label={'Inspect ' + offer.name} onClick={() => { setNote(''); setSelected(previous => previous === offer.id ? undefined : offer.id); }}>
                {free && <span className="pandora-free-ribbon" aria-hidden="true">Free</span>}
                {offer.slot === 'box' ? <MysteryChest /> : offer.slot === 'card' ? <ShopCardBack /> : <ShopJewelryArt offer={offer} />}
              </button>
              {inspecting && offer.slot === 'card' && <div className="shop-full-card" id={detailsId} data-shop-inspect>
                <CardView cardId={offer.cardId} label={'Close ' + offer.name + ' card preview'} onClick={() => setSelected(undefined)} />
              </div>}
              {inspecting && offer.slot !== 'card' && <div className="ring-counter-popover" id={detailsId} data-shop-inspect>
                <strong>{offer.name}</strong>
                {!box && <small>{offer.rarity} {offer.slot === 'amulet' ? 'Amulet' : 'Ring'}</small>}
                <p>{offer.flavor}</p>
                <span>{offer.slot === 'box' ? free ? 'Your daily opening costs no Gold. The box can still grant a reward or a curse.' : 'Pay to open it once. The box stays with Metatron. The reward is yours.' : offer.effect ?? 'Cosmetic'}</span>
              </div>}
              <button type="button" className="ring-counter-price" disabled={owned || short || busy !== undefined || offeringApple !== undefined}
                aria-label={priceLabel}
                onClick={() => void buy(offer.id)}>
                {owned ? box ? 'Opened' : 'Owned' : busy === offer.id ? box ? 'Opening' : 'Buying' : free ? 'Open free' : <><GoldCoins /> {offer.price}</>}
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
