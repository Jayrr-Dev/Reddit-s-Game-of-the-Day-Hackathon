import { useEffect, useId, useState } from 'react';
import { REALM_APPLE, type ShopApple } from '../../../../shared/game/items';
import type { CarryCard } from '../../../../shared/game/carryCards';
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

/** Fade each letter without letting a word break across lines. Then dismiss the bubble. */
function ShopSpeech({ text, isReply }: { text: string; isReply: boolean }) {
  const [leaving, setLeaving] = useState(false);
  const [hidden, setHidden] = useState(false);
  let index = 0;
  useEffect(() => {
    const readMs = 4200 + text.length * 24;
    const fade = window.setTimeout(() => setLeaving(true), readMs);
    const remove = window.setTimeout(() => setHidden(true), readMs + 360);
    return () => { window.clearTimeout(fade); window.clearTimeout(remove); };
  }, [text]);
  if (hidden) return null;
  return <p className="metatron-greeting" data-purchase={isReply || undefined} data-leaving={leaving || undefined} aria-label={text} aria-hidden={leaving || undefined}>
    <span aria-hidden="true">{text.split(/(\s+)/).map((word, position) => /^\s+$/.test(word) ? word : <span key={position} className="metatron-word">
      {Array.from(word, (letter, local) => <span key={local} className="metatron-letter" style={{ animationDelay: 200 + index++ * 22 + 'ms' }}>{letter}</span>)}
    </span>)}</span>
  </p>;
}

export const MetatronShop = ({ onClose, onTestInventory }: { onClose: () => void; onTestInventory?: (items: ShopRingId[], visit: string, carry: CarryCard[]) => void }) => {
  const [line, setLine] = useState<number | null>(null);
  const [reaction, setReaction] = useState<{ serial: number; apple?: ShopApple }>({ serial: 0 });
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
  }, [buying, reaction.serial, waited]);
  function greetPurchase() {
    setReaction(previous => ({ serial: previous.serial + 1 }));
    setShowWait(false);
    const roll = Math.random();
    setLine(previous => previous === null ? Math.floor(roll * SALE_LINES.length) :
      (previous + 1 + Math.floor(roll * (SALE_LINES.length - 1))) % SALE_LINES.length);
  }
  function greetReroll(apple: ShopApple) {
    setShowWait(false);
    setReaction(previous => ({ serial: previous.serial + 1, apple }));
  }
  const speech = showWait && waited !== null ? WAIT_LINES[waited] :
    reaction.apple === REALM_APPLE ? 'Dry as grave sand. I’d forgotten the taste. Come, see what I’ve kept under the cloth.' :
    reaction.apple ? 'An apple. You remembered. Let me see what else I have.' :
    line === null ? 'Greetings.' : SALE_LINES[line];
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

    <MetatronIdle key={reaction.serial} />

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
        <ShopSpeech key={showWait ? 'wait' : reaction.serial} isReply={reaction.serial > 0 || showWait} text={speech ?? ''} />
      </div>
    </div>

    <header className="w-fit max-w-[90%] rounded-md bg-[#17111d]/90 px-3 py-2">
      <h2 className="font-display text-sm font-black uppercase tracking-widest text-accent">
        Shop
      </h2>
      <p className="text-xs text-ink">Metatron the Fallen Angel</p>
    </header>

    <RingCounter onSale={greetPurchase} onReroll={greetReroll} onBuyingChange={setBuying} {...(onTestInventory && { onTestInventory })} />
    <footer className="flex items-end justify-end gap-2">
      <Button variant="menu" className="max-w-24 shrink-0" onClick={onClose} disabled={buying}>
        Back
      </Button>
    </footer>
  </section>
  );
};

