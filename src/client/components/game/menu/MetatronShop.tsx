import { useId } from 'react';
import shopAmbient from '../../../assets/npcs/metatron-shop-ambient.webp';
import shopFrame from '../../../assets/npcs/metatron-shop-frame.webp';
import { Button } from '../../ui/Button';
import { ProgressiveImg, ProgressiveSvgImage } from '../../ui/ProgressiveImage';
import './metatron-shop.css';

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

export const MetatronShop = ({ onClose }: { onClose: () => void }) => (
  <section
    role="dialog"
    aria-label="Shop"
    className="absolute inset-0 z-40 isolate flex flex-col justify-between overflow-hidden bg-[#211826] p-3 animate-rise sm:p-4"
  >
    <ProgressiveImg
      src={shopFrame}
      alt="Metatron the Fallen Angel at a tall counter in a candlelit reliquary"
      width={1200}
      height={675}
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-contain"
    />

    <MetatronIdle />

    <img
      src={shopAmbient}
      alt=""
      aria-hidden="true"
      width={1200}
      height={675}
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-contain motion-reduce:hidden"
    />

    <header className="w-fit max-w-[90%] rounded-md bg-[#17111d]/90 px-3 py-2">
      <h2 className="font-display text-sm font-black uppercase tracking-widest text-accent">
        Shop
      </h2>
      <p className="text-xs text-ink">Metatron the Fallen Angel</p>
    </header>

    <footer className="flex items-end justify-between gap-2">
      <p className="rounded-md bg-[#17111d]/90 px-3 py-2 text-xs text-ink">
        The shop isn’t stocked yet.
      </p>
      <Button variant="menu" className="max-w-24 shrink-0" onClick={onClose}>
        Back
      </Button>
    </footer>
  </section>
);

