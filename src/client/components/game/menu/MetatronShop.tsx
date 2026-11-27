import { useEffect, useId, useState } from 'react';
import type { ShopRingId } from '../../../../shared/game/ringShop';
import shopAmbient from '../../../assets/npcs/metatron-shop-ambient.webp';
import shopFrame from '../../../assets/npcs/metatron-shop-frame.webp';
import { Button } from '../../ui/Button';
import { ProgressiveImg, ProgressiveSvgImage } from '../../ui/ProgressiveImage';
import { RingCounter } from './RingCounter';
import './metatron-shop.css';

const SALE_LINES = [
  'Ah, gold matching ambition.',
  'You bargain with gold. The world deals in consequences.',
  'No trinket can tell you what to reach for.',
  'Even fallen things can still catch the light.',
  'Everything I sell remembers who wore it last.',
  'Keep a little gold. Want is rarely satisfied.',
] as const;

const WAIT_LINES = [
  'Take your time. Haste is the most expensive thing I sell.',
  'You’ve gone quiet. A good sign, usually.',
  'Even the dust has learned to wait.',
  'The door stays where it is.',
] as const;

const SCENE_WIDTH = 1200;
const SCENE_HEIGHT = 675;

/** Animate only the feathers and skull inside the approved painting. */
function MetatronIdle() {
  const id = useId();
  const frame = { width: SCENE_WIDTH, height: SCENE_HEIGHT };
  const region = { x: 0, y: 0, ...frame, maskUnits: 'userSpaceOnUse' };
  return (
    <svg className="metatron-idle pointer-events-none absolute inset-0 -z-10 h-full w-full"
      viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-soft-edge`}>
          <stop offset=".54" stopColor="white" />
          <stop offset="1" stopColor="black" />
        </radialGradient>
        <mask id={`${id}-head`} {...region}>
          <ellipse cx="600" cy="179" rx="184" ry="157" fill={`url(#${id}-soft-edge)`} />
        </mask>
        <mask id={`${id}-feathers`} {...region}>
          <ellipse cx="481" cy="302" rx="72" ry="82" fill={`url(#${id}-soft-edge)`} />
          <ellipse cx="719" cy="302" rx="72" ry="82" fill={`url(#${id}-soft-edge)`} />
        </mask>
      </defs>
      <g mask={`url(#${id}-feathers)`}>
        <g className="metatron-idle-feathers"><ProgressiveSvgImage href={shopFrame} {...frame} /></g>
      </g>
      <g mask={`url(#${id}-head)`}>
        <g className="metatron-idle-head"><ProgressiveSvgImage href={shopFrame} {...frame} /></g>
      </g>
    </svg>
  );
}

export const MetatronShop = ({ onClose, onTestInventory }: { onClose: () => void; onTestInventory?: (items: ShopRingId[], visit: string) => void }) => {
  const [line, setLine] = useState<number | null>(null);
  const [buying, setBuying] = useState(false);
  const [waited, setWaited] = useState<number | null>(null);
  const [showWait, setShowWait] = useState(false);
  useEffect(() => {
    if (buying || waited !== null) return;
    const timer = window.setTimeout(() => {
      setWaited(Math.floor(Math.random() * WAIT_LINES.length));
      setShowWait(true);
    }, 25_000);
    return () => window.clearTimeout(timer);
  }, [buying, line, waited]);
  function greetPurchase() {
    setShowWait(false);
    const roll = Math.random();
    setLine(previous => previous === null ? Math.floor(roll * SALE_LINES.length) :
      (previous + 1 + Math.floor(roll * (SALE_LINES.length - 1))) % SALE_LINES.length);
  }
  return (
  <section
    role="dialog"
    aria-label="Shop"
    className="absolute inset-0 z-40 isolate flex flex-col justify-between overflow-hidden bg-[#211826] p-3 animate-rise motion-reduce:animate-none sm:p-4"
  >
    <ProgressiveImg
      src={shopFrame}
      alt="Metatron the Fallen Angel at a tall counter in a candlelit reliquary"
      width={1200}
      height={675}
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-contain"
    />

    <MetatronIdle key={line ?? 'hello'} />

    <img
      src={shopAmbient}
      alt=""
      aria-hidden="true"
      width={1200}
      height={675}
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-contain motion-reduce:hidden"
    />

    <div className="metatron-dialogue-layer">
      <div className="metatron-dialogue-frame">
        <p key={showWait ? 'wait' : line ?? 'hello'} className="metatron-greeting" data-purchase={line !== null || showWait || undefined}>
          {showWait && waited !== null ? WAIT_LINES[waited] : line === null ? 'Greetings.' : SALE_LINES[line]}
        </p>
      </div>
    </div>

    <header className="w-fit max-w-[90%] rounded-md bg-[#17111d]/90 px-3 py-2">
      <h2 className="font-display text-sm font-black uppercase tracking-widest text-accent">
        Shop
      </h2>
      <p className="text-xs text-ink">Metatron the Fallen Angel</p>
    </header>

    <RingCounter onSale={greetPurchase} onBuyingChange={setBuying} {...(onTestInventory && { onTestInventory })} />
    <footer className="flex items-end justify-end gap-2">
      <Button variant="menu" className="max-w-24 shrink-0" onClick={onClose} disabled={buying}>
        Back
      </Button>
    </footer>
  </section>
  );
};

