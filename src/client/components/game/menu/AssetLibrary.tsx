// ===================================================================
// ASSET LIBRARY
// The admin-only Assets tab of the training menu: every combat effect,
// then the effect and icon images. Tapping one opens it full size;
// effects replay on a loop there, since in a fight they play once.
// ===================================================================

import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../../ui/Button';
import { ModalDialog } from '../../ui/ModalDialog';
import { ImpactOverlay } from '../combat/ImpactOverlay';
import { EFFECT_ASSETS, IMAGE_ASSETS, type EffectAsset, type ImageAsset } from '../../../content/assetCatalog';

// --- CONSTANTS ---
/** How often an open effect replays (ms); the longest effects last about 1.2 s. */
const EFFECT_REPLAY_MS = 1600;

// --- TYPES ---
/** The asset open in the viewer, if any. */
type OpenAsset = { kind: 'effect'; asset: EffectAsset } | { kind: 'image'; asset: ImageAsset };

// --- HOOKS ---
/** A counter that ticks every `ms`, used to remount (replay) an effect. */
const useReplayCount = (ms: number) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setCount((value) => value + 1), ms);
    return () => window.clearInterval(timer);
  }, [ms]);
  return count;
};

// --- SUBCOMPONENTS ---
/** One effect, looping in a dark stage the size of a character's body. */
const EffectStage = ({ asset }: { asset: EffectAsset }) => {
  const replay = useReplayCount(EFFECT_REPLAY_MS);
  // A fresh id per replay also varies the seeded angle, like back-to-back hits.
  const pop = { ...asset.pop, id: asset.pop.id + replay };
  return (
    <div className="asset-stage">
      <ImpactOverlay key={replay} pops={[pop]} />
    </div>
  );
};

/** The full-size viewer for the open asset. */
const AssetViewer = ({ open, onClose }: { open: OpenAsset; onClose: () => void }) => (
  <ModalDialog
    title={open.asset.name}
    subtitle={open.kind === 'image' ? open.asset.group : 'Effect'}
    onDismiss={onClose}
    actions={<Button variant="menuPrimary" onClick={onClose} autoFocus>Close</Button>}
  >
    {open.kind === 'effect'
      ? <EffectStage asset={open.asset} />
      : <img className="asset-full" alt={open.asset.name} src={open.asset.url} />}
  </ModalDialog>
);

/** One tile in the grid; images show a thumbnail. */
const AssetTile = ({ name, thumb, onOpen }: { name: string; thumb?: string; onOpen: () => void }) => (
  <button type="button" className="asset-tile" onClick={onOpen}>
    {thumb && <img alt="" loading="lazy" src={thumb} />}
    <span>{name}</span>
  </button>
);

// --- COMPONENT ---
/** Lists effects then images; renderHeading draws the picker's section heading. */
export const AssetLibrary = ({ renderHeading }: { renderHeading: (label: string) => ReactNode }) => {
  const [open, setOpen] = useState<OpenAsset | null>(null);
  return (
    <>
      {renderHeading('Effects (' + EFFECT_ASSETS.length + ')')}
      {EFFECT_ASSETS.map((asset) => (
        <AssetTile key={asset.name} name={asset.name} onOpen={() => setOpen({ kind: 'effect', asset })} />
      ))}
      {renderHeading('Images (' + IMAGE_ASSETS.length + ')')}
      {IMAGE_ASSETS.map((asset) => (
        <AssetTile
          key={asset.url}
          name={asset.group + ': ' + asset.name}
          thumb={asset.url}
          onOpen={() => setOpen({ kind: 'image', asset })}
        />
      ))}
      {open && <AssetViewer open={open} onClose={() => setOpen(null)} />}
    </>
  );
};
