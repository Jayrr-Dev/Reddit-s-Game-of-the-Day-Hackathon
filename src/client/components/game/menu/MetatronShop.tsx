import metatronPortrait from '../../../assets/npcs/metatron-the-fallen-angel.png';
import { MenuPanel } from './MenuPanel';

export const MetatronShop = ({ onClose }: { onClose: () => void }) => (
  <MenuPanel title="Shop" onClose={onClose}>
    <div className="w-full text-center">
      <div className="relative isolate mx-auto w-[min(100%,15rem)] border-b border-accent/35">
        <div aria-hidden="true" className="absolute inset-4 -z-10 rounded-full bg-[#6e416e]/45 blur-xl" />
        <img
          src={metatronPortrait}
          alt="Metatron in a purple feathered mantle and an ivory antlered mask"
          className="mx-auto block h-auto w-full object-contain"
          width={1254}
          height={1254}
        />
      </div>
      <p className="mb-1 mt-3 text-[10px] font-bold uppercase tracking-[0.22em] text-accent">Shopkeeper</p>
      <h3 className="text-balance font-display text-xl font-black leading-tight text-ink">
        Metatron the Fallen Angel
      </h3>
      <p className="mt-2 text-xs text-ink-muted">The shop isn’t stocked yet.</p>
    </div>
  </MenuPanel>
);

