import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { PANDORA_RUN_COPY } from '../../../../shared/game/pandora';
import { GoldCoins } from '../profileParts';
import { PANDORA_BOX_NAME } from '../../../../shared/game/ringShop';
import type { ShopReward } from '../../../../shared/types/api';
import { playSound } from '../../../lib/gameAudio';
import { MagicCircle } from '../fx/MagicCircle';
import { ShopJewelryArt } from './ShopJewelryArt';

const REVEAL_MS = { Common: 3600, Uncommon: 4000, Rare: 4600, Epic: 5250, Legendary: 6200 };
const LOOT_COUNT = { Common: 14, Uncommon: 22, Rare: 32, Epic: 44, Legendary: 56 };
type ChestRarity = keyof typeof REVEAL_MS;
const RIBBONS = [
  'M380 356 C333 325 260 298 261 252 C263 197 504 257 501 171 C492 102 260 174 263 98 C271 38 493 54 570 20',
  'M380 356 C425 326 502 300 501 251 C497 199 255 244 260 169 C266 109 501 149 500 94 C497 40 291 54 221 19',
  'M380 356 C395 284 467 288 443 232 C423 184 358 191 367 147 C376 100 449 109 420 67 C397 30 370 29 362 4',
] as const;

function TreasureBurst({ rarity }: { rarity: ChestRarity }) {
  const paint = useId();
  return <div className="pandora-burst" aria-hidden="true">
    <svg className="pandora-beams" viewBox="0 0 760 440" preserveAspectRatio="none">
      <defs>
        <linearGradient id={paint} x1="0" y1="1" x2="0" y2="0" gradientUnits="objectBoundingBox">
          <stop stopColor="#fff0b8" stopOpacity=".94" />
          <stop offset=".34" stopColor="currentColor" stopOpacity=".65" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g fill={`url(#${paint})`}>
        <path d="M378 351 5 0 170 0 389 351Z" />
        <path d="M376 350 306 0 462 0 391 350Z" />
        <path d="M379 350 596 0 760 0 390 350Z" />
        {(rarity === 'Epic' || rarity === 'Legendary') && <path d="M375 353 174 0 237 0 386 350ZM385 352 533 0 591 0 393 355Z" opacity=".45" />}
      </g>
      <g className="pandora-ribbon-strokes" fill="none" strokeLinecap="round">
        {RIBBONS.slice(0, rarity === 'Legendary' ? 3 : rarity === 'Common' ? 1 : 2).map((d, i) => <g key={d}>
          <path d={d} pathLength="100" className="pandora-ribbon-glow" style={{ '--ribbon-delay': i * 75 + 'ms' } as CSSProperties} />
          <path d={d} pathLength="100" className="pandora-ribbon-core" style={{ '--ribbon-delay': i * 75 + 'ms' } as CSSProperties} />
        </g>)}
      </g>
    </svg>
    <div className="pandora-treasure">
      {Array.from({ length: LOOT_COUNT[rarity] }, (_, i) => {
        const size = 8 + (i * 7) % 13;
        return <svg key={i} viewBox="0 0 20 20" className="pandora-loot" style={{
          '--loot-x': (((i * 137.508) % 93) - 46.5) + 'cqw',
          '--loot-y': -(21 + (i * 23) % 50) + 'cqh',
          '--loot-wait': (i * 61 % 620) + 'ms',
          '--loot-size': size + 'px',
          '--loot-spin': ((i % 2 ? -1 : 1) * (255 + (i * 73) % 400)) + 'deg',
        } as CSSProperties}>
          {i % 9 === 0 ? <path d="M10 1 18 7 15 15 10 19 4 15 2 7Z" fill="#54c7b7" stroke="#cbfff3" strokeWidth="1.1" />
          : i % 7 === 0 ? <><rect x="4" y="1" width="12" height="18" rx="2" fill="#392442" stroke="#f3cc82" /><path d="M10 5 13 10 10 15 7 10Z" fill="#f6d08b" /></>
          : <><ellipse cx="10" cy="10" rx="7.3" ry="8.8" fill={i % 5 ? '#cf8f31' : '#9a9bac'} stroke={i % 5 ? '#ffe38a' : '#f0e9ff'} strokeWidth="1.5" /><ellipse cx="10" cy="10" rx="4.6" ry="6.5" fill="none" stroke={i % 5 ? '#ffe3a0' : '#ece8fd'} /><path d="M8 13 12 7" stroke="#fff7dc" opacity=".74" /></>}
        </svg>;
      })}
    </div>
  </div>;
}

/** A two-piece reliquary, shared by the counter and the animated reveal. */
export function MysteryChest() {
  const paint = useId();
  return <svg className="shop-mystery-art" viewBox="0 0 72 64" aria-hidden="true">
    <defs>
      <linearGradient id={paint} x2="0" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#663c51"/><stop offset=".52" stopColor="#342137"/><stop offset="1" stopColor="#130d19"/></linearGradient>
    </defs>
    <ellipse cx="36" cy="55" rx="27" ry="5" fill="#100b16" />
    <path d="M10 31h52l-5 19-21 7-21-7Z" fill={`url(#${paint})`} stroke="#b48b60" strokeWidth="1.3" />
    <path d="m13 36 7 11 16 6 16-6 7-11M21 36l3 14m27-14-3 14" fill="none" stroke="#a97654" strokeWidth="1.1" />
    <path d="m36 36 6 6-6 7-6-7Z" fill="#211421" stroke="#bc9869"/><path d="M36 39v6m-2-2h4" stroke="#f0c98d" strokeWidth=".75"/>
    <path d="M10 34 36 42 62 34" fill="none" stroke="var(--reveal-ink, #f5c27b)" className="shop-chest-seam" />
    <g className="shop-chest-lid">
      <path d="m12 32 3-11 13-7h17l12 7 3 11-24 7Z" fill="#754952" stroke="#d8b076" strokeWidth="1.6" />
      <path d="m14 31 22 6 22-6m-21-15-8 8-4 11m13-19 7 8 3 11" fill="none" stroke="#c79a6b" strokeWidth="1.4" />
      <path d="m36 17 8 5v7l-8 6-8-6v-7Z" fill="#382036" stroke="#dabc75" strokeWidth=".8" />
      <path d="m36 20 4 5-4 6-4-6Z" fill="#f2ce88" stroke="#61425c" />
      <path d="m20 23 6-3m20 0 6 3m-34 5 6 1m24 0 6-1" stroke="#e3ac72" strokeWidth=".8" />
    </g>
  </svg>;
}

/** The illuminated corners stay sharp as the reward panel changes size. */
function TreasureRewardFrame() {
  return <div className="pandora-reward-frame" aria-hidden="true">
    {[0, 1, 2, 3].map(corner => <svg key={corner} className="pandora-reward-corner" viewBox="0 0 36 36" fill="none">
      <path d="M2 33V13l5-5 7-6h19M6 26V15l8-8h12" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
      <path d="M7 19c2-7 5-10 12-12M11 13l2-2 3 1-4 4Z" stroke="currentColor" strokeWidth=".85" strokeLinejoin="round" />
      <path d="m3 3 5 2-3 3-2-5Zm18 7 3-2 3 2-3 2ZM8 24l2-3 2 3-2 3Z" fill="currentColor" />
    </svg>)}
    <i className="pandora-frame-jewel" /><i className="pandora-frame-jewel" />
  </div>;
}

/** Play the full reveal for a reward the server has already granted. */
export function MysteryReveal({ reward, onClose }: { reward: ShopReward; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const sounded = useRef(false);
  const continueButton = useRef<HTMLButtonElement>(null);
  const rarity = reward.kind === 'jewelry' ? reward.rarity : reward.kind === 'gold' && reward.change > 0 ? reward.duplicateRarity ?? 'Legendary' : 'Rare';
  const bad = reward.kind === 'gold' ? reward.change <= 0 : reward.kind === 'run' && reward.effect !== 'lasting-vigor';
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  useEffect(() => {
    if (shown) {
      continueButton.current?.focus();
      if (!sounded.current) {
        sounded.current = true;
        playSound(bad ? 'pandoraCurse' : 'pandoraReward', 1, rarity === 'Legendary' ? .88 : .72);
      }
      return;
    }
    const duration = REVEAL_MS[rarity];
    const playing = [playSound('runeClick', .74, .46)];
    const seal = window.setTimeout(() => playing.push(playSound('cervielSeal', bad ? .76 : .97, .36)), duration * .26);
    const crack = window.setTimeout(() => playing.push(playSound('cervielCrack', .86, rarity === 'Legendary' ? .72 : .45)), duration * .59);
    const timer = window.setTimeout(() => setShown(true), duration);
    return () => { [seal, crack, timer].forEach(id => window.clearTimeout(id)); playing.forEach(stop => stop?.()); };
  }, [shown, rarity, bad]);

  return <dialog ref={dialog} className="shop-mystery" aria-label={PANDORA_BOX_NAME + ' reward'} data-rarity={rarity} data-curse={bad || undefined} data-opening={!shown || undefined} style={{ '--opening-time': REVEAL_MS[rarity] + 'ms' } as CSSProperties}
    onCancel={event => { event.preventDefault(); if (shown) onClose(); }}>
    {shown && <TreasureRewardFrame />}
    <p className="shop-mystery-label">{shown ? reward.kind === 'jewelry' ? 'You found' : 'The box has spoken' : PANDORA_BOX_NAME}</p>
    {shown
      ? <div className="shop-mystery-reward" role="status">
          {reward.kind === 'jewelry' ? <>
            <div className="shop-reward-sigil"><ShopJewelryArt offer={reward} /></div>
            <strong>{reward.name}</strong>
            <span>{reward.rarity} {reward.slot === 'amulet' ? 'Amulet' : 'Ring'}</span>
          </> : reward.kind === 'gold' ? <>
            <div className="shop-reward-sigil"><GoldCoins /></div>
            <strong>{reward.change > 0 ? '+' : ''}{reward.change} Gold</strong>
            <span>{reward.duplicateRarity ? 'Already owned: ' + reward.duplicateRarity + ' jewelry exchanged for Gold.' : reward.change > 0 ? 'A purse left for the next hand.' : reward.change < 0 ? 'The box took more than its price.' : 'No Gold left for the box to take.'}</span>
          </> : <>
            <div className="shop-reward-sigil"><MysteryChest /></div>
            <strong>{PANDORA_RUN_COPY[reward.effect].title}</strong>
            <span>{PANDORA_RUN_COPY[reward.effect].detail}</span>
          </>}
        </div>
      : <div className="shop-mystery-opening" aria-hidden="true">
          <div className="pandora-seal"><MagicCircle complexity={rarity === 'Legendary' || rarity === 'Epic' ? 'complex' : 'large'} seed={83} color="var(--reveal-ink)" /></div>
          <div className="pandora-floor"><MagicCircle complexity="large" seed={31} placement="ground" color="var(--reveal-ink)" /></div>
          <TreasureBurst rarity={rarity} />
          <div className="pandora-chest-anchor"><MysteryChest /></div>
        </div>}
    {shown
      ? <button ref={continueButton} type="button" className="shop-mystery-action" onClick={onClose}>Continue</button>
      : <p className="shop-mystery-wait" role="status">The seal is breaking.</p>}
  </dialog>;
}
