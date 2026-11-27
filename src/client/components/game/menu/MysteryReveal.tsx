import { useEffect, useRef, useState } from 'react';
import type { ShopReward } from '../../../../shared/types/api';
import { playSound } from '../../../lib/gameAudio';
import { ShopJewelryArt } from './ShopJewelryArt';

const REVEAL_MS = 840;

/** A two-piece reliquary, shared by the counter and the animated reveal. */
export function MysteryChest() {
  return <svg className="shop-mystery-art" viewBox="0 0 72 64" aria-hidden="true">
    <ellipse cx="36" cy="52" rx="24" ry="5" fill="#150e1a" />
    <path d="M13 32h46l-4 18-19 4-19-4Z" fill="#492d35" stroke="#b48b60" strokeWidth="1.5" />
    <path d="M25 33v18m22-18v18" stroke="#c29560" strokeWidth="3" />
    <g className="shop-chest-lid">
      <path d="m12 32 3-11 13-7h17l12 7 3 11-24 7Z" fill="#754952" stroke="#d8b076" strokeWidth="1.6" />
      <path d="m14 31 22 6 22-6m-21-15-8 8-4 11m13-19 7 8 3 11" fill="none" stroke="#c79a6b" strokeWidth="1.4" />
      <path d="m36 27 5 5-5 8-5-8Z" fill="#dabc75" stroke="#422b39" />
    </g>
  </svg>;
}

/** A short, optional animation for a reward the server has already granted. */
export function MysteryReveal({ reward, onClose }: { reward: ShopReward; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const sounded = useRef(false);
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
        playSound('reward', reward.rarity === 'Legendary' ? 0.9 : 1, 0.72);
      }
      return;
    }
    const stop = playSound('runeClick', 0.78, 0.55);
    const timer = window.setTimeout(() => setShown(true), REVEAL_MS);
    return () => { window.clearTimeout(timer); stop?.(); };
  }, [shown, reward.rarity]);

  return <dialog ref={dialog} className="shop-mystery" aria-label="Mystery Box reward" data-rarity={reward.rarity}
    onCancel={event => { event.preventDefault(); if (shown) onClose(); else setShown(true); }}>
    <p className="shop-mystery-label">{shown ? 'You found' : 'Mystery Box'}</p>
    {shown
      ? <div className="shop-mystery-reward" role="status">
          <div className="shop-reward-sigil"><ShopJewelryArt offer={reward} /></div>
          <strong>{reward.name}</strong>
          <span>{reward.rarity} {reward.slot === 'amulet' ? 'Amulet' : 'Ring'}</span>
        </div>
      : <div className="shop-mystery-opening" aria-hidden="true"><i /><MysteryChest /></div>}
    <button type="button" className="shop-mystery-action" onClick={shown ? onClose : () => setShown(true)}>
      {shown ? 'Continue' : 'Skip reveal'}
    </button>
  </dialog>;
}
