import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { PANDORA_RUN_COPY } from '../../../../shared/game/pandora';
import { GoldCoins } from '../profileParts';
import { PANDORA_BOX_NAME } from '../../../../shared/game/ringShop';
import type { ShopReward } from '../../../../shared/types/api';
import { playSound } from '../../../lib/gameAudio';
import { ShopJewelryArt } from './ShopJewelryArt';

const REVEAL_MS = { Common: 2600, Uncommon: 2900, Rare: 3400, Epic: 4100, Legendary: 4800 };
const RAYS = { Common: 3, Uncommon: 5, Rare: 8, Epic: 13, Legendary: 19 };

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

/** A short, optional animation for a reward the server has already granted. */
export function MysteryReveal({ reward, onClose }: { reward: ShopReward; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const sounded = useRef(false);
  const rarity = reward.kind === 'jewelry' ? reward.rarity : reward.kind === 'gold' && reward.change > 0 ? 'Legendary' : 'Rare';
  const bad = reward.kind === 'gold' ? reward.change <= 0 : reward.kind === 'run' && reward.effect !== 'lasting-vigor';
  const [shown, setShown] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  useEffect(() => {
    if (shown) {
      if (!sounded.current) {
        sounded.current = true;
        playSound(bad ? 'curse' : 'reward', rarity === 'Legendary' ? 0.9 : 1, 0.72);
      }
      return;
    }
    const duration = REVEAL_MS[rarity];
    const playing = [playSound('runeClick', .74, .46)];
    const seal = window.setTimeout(() => playing.push(playSound('cervielSeal', bad ? .76 : .97, .36)), duration * .26);
    const crack = window.setTimeout(() => playing.push(playSound('cervielCrack', .86, rarity === 'Legendary' ? .72 : .45)), duration * .81);
    const timer = window.setTimeout(() => setShown(true), duration);
    return () => { [seal, crack, timer].forEach(id => window.clearTimeout(id)); playing.forEach(stop => stop?.()); };
  }, [shown, rarity, bad]);

  return <dialog ref={dialog} className="shop-mystery" aria-label={PANDORA_BOX_NAME + ' reward'} data-rarity={rarity} data-curse={bad || undefined} style={{ '--opening-time': REVEAL_MS[rarity] + 'ms' } as CSSProperties}
    onCancel={event => { event.preventDefault(); if (shown) onClose(); else setShown(true); }}>
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
            <span>{reward.change > 0 ? 'A purse left for the next hand.' : reward.change < 0 ? 'The box took more than its price.' : 'No Gold left for the box to take.'}</span>
          </> : <>
            <div className="shop-reward-sigil"><MysteryChest /></div>
            <strong>{PANDORA_RUN_COPY[reward.effect].title}</strong>
            <span>{PANDORA_RUN_COPY[reward.effect].detail}</span>
          </>}
        </div>
      : <div className="shop-mystery-opening" aria-hidden="true">
          <i className="shop-chest-glow" /><div className="shop-chest-circle" /><div className="shop-chest-circle shop-chest-circle-inner" />
          <div className="shop-chest-particles">
            {Array.from({ length: RAYS[rarity] }, (_, i) => <i key={i} style={{
              '--angle': i * 137.508 + 'deg', '--distance': (25 + (i * 11) % 50) + 'px', '--size': (2 + i % 4) + 'px',
            } as CSSProperties} />)}
          </div>
          <MysteryChest />
        </div>}
    <button type="button" className="shop-mystery-action" onClick={shown ? onClose : () => setShown(true)}>
      {shown ? 'Continue' : 'Skip reveal'}
    </button>
  </dialog>;
}
