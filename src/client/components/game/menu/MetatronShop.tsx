import shopAmbient from '../../../assets/npcs/metatron-shop-ambient.webp';
import shopFrame from '../../../assets/npcs/metatron-shop-frame.webp';
import { Button } from '../../ui/Button';
import { ProgressiveImg } from '../../ui/ProgressiveImage';

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

