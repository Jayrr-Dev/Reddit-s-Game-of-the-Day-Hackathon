// ===================================================================
// MAGIC CIRCLE LAB
// The Dev panel's Magic Circle tab: a live preview of the generator
// with its controls (complexity, colour, seed, placement), and the
// sample presets underneath; tapping a sample loads it into the controls.
// ===================================================================

import { useState } from 'react';
import { MagicCircle, type MagicCirclePlacement } from '../fx/MagicCircle';
import { CIRCLE_ASSETS, type CircleAsset } from '../../../content/assetCatalog';
import type { MagicCircleComplexity } from '../../../../shared/fx/magicCircle';
import type { ReactNode } from 'react';

// --- CONSTANTS ---
const COMPLEXITIES: readonly MagicCircleComplexity[] = ['small', 'large', 'complex'];
const PLACEMENTS: readonly MagicCirclePlacement[] = ['flat', 'ground', 'overhead'];
/** Seeds stay small so they are easy to note down and reuse. */
const MAX_SEED = 9999;

// --- TYPES ---
type LabSettings = Omit<CircleAsset, 'name'> & { placement: MagicCirclePlacement };

// --- HELPERS ---
/** A fresh random seed for the "New seed" button. */
const randomSeed = () => 1 + Math.floor(Math.random() * MAX_SEED);

// --- SUBCOMPONENTS ---
/** A row of pill choices; the chosen one is lit. */
const ChoiceRow = <T extends string>({ label, options, value, onPick }: { label: string; options: readonly T[]; value: T; onPick: (option: T) => void }) => (
  <div className="circle-lab-row">
    <span>{label}</span>
    {options.map((option) => (
      <button key={option} type="button" aria-pressed={option === value} onClick={() => onPick(option)}>
        {option}
      </button>
    ))}
  </div>
);

// --- COMPONENT ---
/** Renders the preview, the controls and the samples. */
export const MagicCircleLab = ({ renderHeading }: { renderHeading: (label: string) => ReactNode }) => {
  const first = CIRCLE_ASSETS[0];
  const [settings, setSettings] = useState<LabSettings>({
    complexity: first?.complexity ?? 'complex',
    seed: first?.seed ?? 1,
    color: first?.color ?? '#f2c35b',
    placement: 'flat',
  });
  /** Changes one setting, keeping the rest. */
  const update = (change: Partial<LabSettings>) => setSettings((current) => ({ ...current, ...change }));
  return (
    <>
      <div className="circle-lab col-span-full">
        <div className="circle-lab-preview" data-placement={settings.placement}>
          <MagicCircle complexity={settings.complexity} seed={settings.seed} color={settings.color} placement={settings.placement} />
        </div>
        <div className="circle-lab-controls">
          <ChoiceRow label="Size" options={COMPLEXITIES} value={settings.complexity} onPick={(complexity) => update({ complexity })} />
          <ChoiceRow label="Place" options={PLACEMENTS} value={settings.placement} onPick={(placement) => update({ placement })} />
          <div className="circle-lab-row">
            <span>Colour</span>
            <input type="color" aria-label="Circle colour" value={settings.color} onChange={(event) => update({ color: event.target.value })} />
            <span>Seed</span>
            <input
              type="number" min={1} max={MAX_SEED} aria-label="Seed" value={settings.seed}
              onChange={(event) => update({ seed: Math.max(1, Math.min(MAX_SEED, Number(event.target.value) || 1)) })}
            />
            <button type="button" onClick={() => update({ seed: randomSeed() })}>New seed</button>
          </div>
        </div>
      </div>
      {renderHeading('Samples (' + CIRCLE_ASSETS.length + ')')}
      {CIRCLE_ASSETS.map(({ name, complexity, seed, color }) => (
        <button key={name} type="button" className="asset-tile" onClick={() => update({ complexity, seed, color })}>
          <span className="circle-lab-thumb"><MagicCircle complexity={complexity} seed={seed} color={color} isSpinning={false} /></span>
          <span>{name}</span>
        </button>
      ))}
    </>
  );
};
