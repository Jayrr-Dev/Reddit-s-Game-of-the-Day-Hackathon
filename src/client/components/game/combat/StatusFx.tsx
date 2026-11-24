// ===================================================================
// STATUS FX
// Draws one status's effect over a character, from its entry in
// STATUS_FX (content/statusFx.ts): a glow in the status's colour and
// its layers of particles (bubbles, flames, shards ...). Each particle
// gets a fixed pseudo-random spot and delay from the pop id, so it never
// jumps on re-render. Sits inside ImpactOverlay, which is a size
// container, so cqw/cqh are the character's box.
// PERFORMANCE: transform and opacity only (index.css "STATUS FX");
// reduced motion swaps every motion for a plain fade in place.
// ===================================================================

import type { CSSProperties, ReactNode } from 'react';
import {
  STATUS_FX,
  type FxKind,
  type FxLayer,
  type FxMotion,
  type FxShape,
} from '../../../content/statusFx';
import { POP_LOOK, toneVarOf } from '../../../content/visuals';
import { seeded, spread } from '../../../lib/seeded';
import { Glyph, type GlyphName } from '../../ui/Glyph';
import { HexSigil } from './HexSigil';

// --- CONSTANTS ---
/** Time between particles of one layer starting (ms). */
const PARTICLE_STAGGER_MS = 70;
/** How far a burst particle flies, as a % of the box. */
const BURST_REACH = 42;

/** Each shape as SVG on a 10 x 10 box, drawn in currentColor. */
const SHAPE_PATHS: Record<Exclude<FxShape, 'icon'>, ReactNode> = {
  arrow: <path d="M5 .5 7.4 3.4H5.7V9.5H4.3V3.4H2.6Z" fill="currentColor" />,
  spark: <path d="M5 0 6 4 10 5 6 6 5 10 4 6 0 5 4 4Z" fill="currentColor" />,
  streak: (
    <path
      d="M0 5h10"
      stroke="currentColor"
      strokeWidth="0.8"
      strokeLinecap="round"
      opacity="0.7"
    />
  ),
  bubble: (
    <>
      <circle cx="5" cy="5" r="3.8" fill="currentColor" fillOpacity="0.35" />
      <circle cx="5" cy="5" r="3.8" fill="none" stroke="currentColor" />
      <circle cx="3.8" cy="3.6" r="0.9" fill="white" fillOpacity="0.8" />
    </>
  ),
  flame: (
    <path
      d="M5 .5C6.6 3 8.6 4.6 8.6 6.8a3.6 3.6 0 0 1-7.2 0C1.4 5 3 4 3.4 2.4 4 3.8 4.6 4.2 5 4.6 5.3 3 5 1.8 5 .5Z"
      fill="currentColor"
    />
  ),
  shard: <path d="M5 0 6.7 5 5 10 3.3 5Z" fill="currentColor" />,
  sigil: <HexSigil />,
  drop: (
    <path
      d="M5 .5C6.5 3 8 4.8 8 6.6a3 3 0 0 1-6 0C2 4.8 3.5 3 5 .5Z"
      fill="currentColor"
    />
  ),
  plus: (
    <path
      d="M5 1v8M1 5h8"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  ),
  chevron: (
    <path
      d="M1.5 5.5 5 2l3.5 3.5M1.5 9 5 5.5 8.5 9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  shield: (
    <path
      d="M5 .8 8.8 2.2v3c0 2.2-1.7 3.7-3.8 4.4C2.9 8.9 1.2 7.4 1.2 5.2v-3Z"
      fill="currentColor"
      fillOpacity="0.45"
      stroke="currentColor"
      strokeWidth="0.7"
    />
  ),
  ring: (
    <circle
      cx="5"
      cy="5"
      r="4.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.5"
    />
  ),
  lash: (
    <>
      <path
        d="M.2 6.6C2.4 3.4 6.4 2.4 9.8 3.4 6.9 3.9 3.7 4.9.2 6.6Z"
        fill="currentColor"
      />
      <circle cx="3.1" cy="6.3" r=".45" fill="currentColor" />
      <circle cx="5.4" cy="5.4" r=".35" fill="currentColor" />
      <circle cx="7.6" cy="4.7" r=".3" fill="currentColor" />
    </>
  ),
  splat: (
    <>
      <path
        d="M5 2.2c1 .1 1.3 1 2.1.9.9 0 1.5.9 1 1.7-.4.7.3 1.3-.1 2-.5.8-1.4.4-2 .9-.7.6-1.6.6-2.2 0-.6-.5-1.5-.2-1.9-1-.4-.7.2-1.3-.1-2-.3-.8.4-1.5 1.2-1.4.8 0 1.1-1.2 2-1.1Z"
        fill="currentColor"
        fillOpacity="0.85"
      />
      <circle cx="1.2" cy="2.4" r=".5" fill="currentColor" />
      <circle cx="9" cy="2" r=".4" fill="currentColor" />
      <circle cx="9.3" cy="8.4" r=".55" fill="currentColor" />
      <circle cx=".9" cy="8.2" r=".35" fill="currentColor" />
    </>
  ),
  eye: (
    <>
      <path
        d="M.6 5C2 2.6 3.4 1.8 5 1.8S8 2.6 9.4 5C8 7.4 6.6 8.2 5 8.2S2 7.4.6 5Z"
        fill="currentColor"
        fillOpacity="0.4"
        stroke="currentColor"
        strokeWidth="0.6"
      />
      <circle cx="5" cy="5" r="1.6" fill="currentColor" />
    </>
  ),
};

// --- HELPERS ---
/**
 * Where particle `index` of a layer starts, and how it moves, as CSS
 * (the motion reads --fx-dx/--fx-dy/--fx-turn in index.css). `salt`
 * keeps layers of one pop apart.
 */
const placeParticle = (
  motion: FxMotion,
  id: number,
  index: number,
  count: number,
  salt: number
): CSSProperties => {
  const key = salt * 20 + index;
  const delay = `${index * PARTICLE_STAGGER_MS}ms`;
  if (motion === 'burst') {
    // Evenly round the circle, each a little off its slot.
    const deg = (index / count) * 360 + spread(id, key) * 14;
    const rad = (deg * Math.PI) / 180;
    const reach = BURST_REACH * (0.75 + seeded(id, key + 9) * 0.4);
    return {
      left: '50%',
      top: '50%',
      animationDelay: `${index * 12}ms`,
      '--fx-dx': `${(Math.cos(rad) * reach).toFixed(1)}cqw`,
      '--fx-dy': `${(Math.sin(rad) * reach).toFixed(1)}cqh`,
      '--fx-turn': `${(deg + 90).toFixed(0)}deg`,
    } as CSSProperties;
  }
  if (motion === 'whip')
    // Crossing lashes: each a beat after the last, turned its own way.
    return {
      left: '50%',
      top: `${46 + index * 10}%`,
      animationDelay: `${index * 90}ms`,
      '--fx-turn': `${index % 2 === 0 ? -18 : 14}deg`,
    } as CSSProperties;
  if (motion === 'splat')
    // Lands once the lash has passed, where it struck.
    return { left: '50%', top: '52%', animationDelay: '220ms' };
  if (motion === 'dash')
    // In from the left, at its own height (speed lines stack up).
    return {
      left: '50%',
      top: `${50 + (index - (count - 1) / 2) * 14}%`,
      animationDelay: `${index * 30}ms`,
    };
  if (motion !== 'rise' && motion !== 'fall')
    return {
      left: '50%',
      top: '50%',
      animationDelay: delay,
      '--fx-turn': `${spread(id, key) > 0 ? 200 : -200}deg`,
    } as CSSProperties;
  // Rise and fall: spread across the body, starting low or high.
  return {
    left: `${50 + spread(id, key) * 30}%`,
    top: motion === 'rise' ? `${58 + spread(id, key + 3) * 10}%` : '38%',
    animationDelay: `${index * PARTICLE_STAGGER_MS + seeded(id, key + 5) * 60}ms`,
  };
};

// --- SUBCOMPONENTS ---
/** One layer of particles. */
const Layer = ({
  layer,
  id,
  salt,
  glyph,
}: {
  layer: FxLayer;
  id: number;
  salt: number;
  glyph: GlyphName;
}) => (
  <>
    {Array.from({ length: layer.count }, (_, index) => (
      <span
        key={index}
        className={`status-fx status-fx-${layer.motion} absolute aspect-square`}
        style={{
          width: `${layer.size}%`,
          ...placeParticle(layer.motion, id, index, layer.count, salt),
        }}
      >
        {layer.shape === 'icon' ? (
          <Glyph
            name={glyph}
            className="block size-full drop-shadow-[0_0_4px_currentColor]"
          />
        ) : (
          <svg
            viewBox="0 0 10 10"
            className={`block size-full overflow-visible drop-shadow-[0_0_3px_currentColor] ${layer.shape === 'flame' ? 'status-fx-flicker' : ''}`}
            aria-hidden="true"
          >
            {SHAPE_PATHS[layer.shape]}
          </svg>
        )}
      </span>
    ))}
  </>
);

/** A soft wash of the status's colour over the character. */
const Glow = ({ tone }: { tone: string }) => (
  <span
    className="absolute inset-0 animate-impact-glow rounded-full mix-blend-screen"
    style={{
      background: `radial-gradient(circle, ${tone} 0%, transparent 65%)`,
    }}
  />
);

// --- COMPONENT ---
/** Renders the effect for one status pop (applied, gained or ticking). */
export const StatusFx = ({ kind, id }: { kind: FxKind; id: number }) => {
  const spec = STATUS_FX[kind];
  const look = POP_LOOK[kind];
  const tone = toneVarOf(look);
  return (
    <span className="absolute inset-0" style={{ color: tone }}>
      {spec.hasGlow && <Glow tone={tone} />}
      {spec.layers.map((layer, salt) => (
        <Layer
          key={salt}
          layer={layer}
          id={id}
          salt={salt}
          glyph={look.glyph}
        />
      ))}
    </span>
  );
};
