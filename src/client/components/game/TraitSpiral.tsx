import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { nameTraitNodes } from '../../content/traitNodeNames';
import { createPortal } from 'react-dom';
import { characterBonuses, TRAIT_CAP, TRAIT_LABELS, traitNodeIds, traitNodeWeight, traitNodeGains, traitNodeArms, traitPointsAvailable, isTraitNodeSaved, unsavedTraitNodeCount, type CharacterState, type TraitId } from '../../../shared/game/character';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Glyph, type GlyphName } from '../ui/Glyph';
import '../../semanticStats.css';
import './TraitSpiral.css';

type Stat = { key: keyof ReturnType<typeof characterBonuses>; label: string; percent?: boolean };
type Props = {
  trait: TraitId;
  character: CharacterState;
  stats: readonly Stat[];
  previewHost: HTMLDivElement | null;
  onSetNode: (node: number, owned: boolean) => void;
  /** Locks spent nodes in; hidden when not given (e.g. the first-fight tutorial). */
  onSaveTraits?: (() => void) | undefined;
};
const INKS: Record<Stat['key'], string> = {
  healingPercent: 'heal', cardsPerTurn: 'draw', maxHp: 'hp', shieldPercent: 'guard', shieldFlat: 'guard', meleePercent: 'melee', meleeFlat: 'melee',
  rangePercent: 'range', rangeFlat: 'range', accuracyPercent: 'range', magicPercent: 'magic', magicFlat: 'magic',
  afflictionDamagePercent: 'status', afflictionFlat: 'status', startingEnergy: 'energy', retainEnergy: 'energy', maxEnergy: 'energy',
};
const ICONS: Record<Stat['key'], GlyphName | 'spark'> = {
  healingPercent: 'heartbeat', cardsPerTurn: 'cards', maxHp: 'heart', shieldPercent: 'aegis', shieldFlat: 'shield', meleePercent: 'battleAxe', meleeFlat: 'sword',
  rangePercent: 'bow', rangeFlat: 'arrowhead', accuracyPercent: 'targeting', magicPercent: 'swirl', magicFlat: 'spark',
  afflictionDamagePercent: 'skull', afflictionFlat: 'drop', startingEnergy: 'bolt', retainEnergy: 'hourglass', maxEnergy: 'flask',
};

function StatIcon({ stat }: { stat: Stat['key'] }) {
  const icon = ICONS[stat];
  if (icon === 'spark') return <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 0l3 8.8L24 12l-9 3.2L12 24l-3-8.8L0 12l9-3.2z" /></svg>;
  return <Glyph name={icon} />;
}

type Point = { x: number; y: number };
const CENTER = 180;
type Arm = 'left' | 'right' | 'mixed';
const JUNCTION = { x: CENTER, y: CENTER - 13 };
const upperLeft = { x: 89, y: 94 };
const armReach = Math.hypot(JUNCTION.x - upperLeft.x, JUNCTION.y - upperLeft.y);
const ARM_CENTERS: Record<Arm, Point> = {
  left: upperLeft,
  right: { x: 2 * CENTER - upperLeft.x, y: upperLeft.y },
  mixed: { x: CENTER, y: JUNCTION.y + armReach },
};

/** Run a spoke from the junction to each curl, then space its rewards by traveled distance. */
function armLayout(arm: Arm, sizes: number[]) {
  const center = ARM_CENTERS[arm];
  const radius = 86;
  const angle = Math.atan2(JUNCTION.y - center.y, JUNCTION.x - center.x);
  const turns = 1.6;
  const winding = arm === 'right' ? -1 : 1;
  const curve: Point[] = [];
  const lengths: number[] = [];
  let length = 0;
  for (let step = 0; step <= 300; step++) {
    const t = step / 300;
    const theta = angle + t * winding * turns * 2 * Math.PI;
    const r = radius - (radius - 14) * t;
    const point = { x: center.x + r * Math.cos(theta), y: center.y + r * Math.sin(theta) };
    const last = curve.at(-1);
    if (last) length += Math.hypot(point.x - last.x, point.y - last.y);
    curve.push(point);
    lengths.push(length);
  }
  let used = 0;
  const offsets = sizes.map((size, i) => {
    if (i) used += (sizes[i - 1]! + size) / 2 + 4;
    return used;
  });
  const points = offsets.map(offset => {
    const distance = offset / used * length;
    return curve[lengths.findIndex(d => d >= distance)] ?? center;
  });
  return { points, path: [JUNCTION, ...curve].map(p => p.x.toFixed(3) + ',' + p.y.toFixed(3)).join(' ') };
}

type Reward = { id: number; changes: (Stat & { delta: number })[] };

function arrangeRewards(rewards: Reward[], trait: TraitId, diameters: number[]) {
  const arms = traitNodeArms(trait);
  const armsInOrder: Arm[] = ['left', 'right', 'mixed'];
  // Give matching steps the same space on both sides, even when their bonuses differ.
  const sideSizes = arms.left.map((id, i) => Math.max(diameters[id - 1]!, diameters[arms.right[i]! - 1]!));
  const curves = armsInOrder.map(arm => ({
    arm, ...armLayout(arm, arm === 'mixed' ? arms.mixed.map(id => diameters[id - 1]!) : sideSizes),
  }));
  const positioned = [
    { ...rewards[0]!, arm: 'junction' as const, point: JUNCTION, tip: false },
    ...curves.flatMap(({ arm, points }) => arms[arm].map((id, i) => ({
      ...rewards[id - 1]!, arm, point: points[i]!, tip: i === arms[arm].length - 1,
    }))),
  ];
  return { positioned, curves };
}

// --- HYBRID HALVES ---
/** Each half shows its own stat's icon and style: e.g. half heart (HP), half shield (Shield %). */
const HybridHalves = ({ stats, showIcon }: { stats: readonly [Stat, Stat]; showIcon: boolean }) => (
  <>
    {stats.map((stat, side) => (
      <span key={stat.key} className="trait-hybrid-half stat-ink" data-stat={INKS[stat.key]}
        data-kind={stat.percent ? 'percent' : 'flat'} data-side={side === 0 ? 'left' : 'right'} aria-hidden="true">
        {showIcon && <StatIcon stat={stat.key} />}
      </span>
    ))}
  </>
);

// --- SAVE TRAITS BUTTON ---
/** Top-right of the canvas: asks first, then locks every spent node in; shows Saved once nothing is new. */
const SaveTraitsButton = ({ unsaved, onSave }: { unsaved: number; onSave: () => void }) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const isAllSaved = unsaved === 0;
  const points = unsaved + (unsaved === 1 ? ' point' : ' points');
  return (
    <>
      <button type="button" className="cs-respec trait-save" disabled={isAllSaved} onClick={() => setIsConfirming(true)}>
        {isAllSaved ? 'Saved' : 'Save'}
      </button>
      {isConfirming && (
        <ConfirmDialog title="Save traits?" confirmLabel="Save" cancelLabel="Cancel"
          onConfirm={() => { setIsConfirming(false); onSave(); }} onCancel={() => setIsConfirming(false)}>
          This locks in {points}. You can only change saved traits with a respec.
        </ConfirmDialog>
      )}
    </>
  );
};

// --- CIRCLE SIZES ---
/** Diameter by pattern weight (1 small, 5 step, 10 tip); the junction star is its own size. */
const CIRCLE_DIAMETER: Record<number, number> = { 1: 15, 5: 26, 10: 36 };
const JUNCTION_DIAMETER = 28;

export const TraitSpiral = ({ trait, character, stats, onSetNode, onSaveTraits, previewHost }: Props) => {
  const owned = new Set(traitNodeIds(character.traits, character.traitNodes, trait));

  const totals = characterBonuses(character.traits, character.equipment, character.traitNodes);
  const [selected, setSelected] = useState(0);
  const [preview, setPreview] = useState<number | null>(null);
  const [receipt, setReceipt] = useState('');
  const spiral = useRef<HTMLElement>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const detailsId = useId();
  const { nodes, curves } = useMemo(() => {
    const rewards = Array.from({ length: TRAIT_CAP }, (_, i) => {
      const gains = traitNodeGains(trait, i + 1);
      return { id: i + 1, changes: stats.flatMap(stat => {
        const delta = gains[stat.key] ?? 0;
        return delta > 0 ? [{ ...stat, delta }] : [];
      }) };
    });
    // Circle size follows the arm reward pattern: small, 5x step, 10x tip.
    const diameters = rewards.map(node => CIRCLE_DIAMETER[traitNodeWeight(trait, node.id) ?? 0] ?? JUNCTION_DIAMETER);
    const { positioned: arranged, curves } = arrangeRewards(rewards, trait, diameters);
    // Fit the board uniformly so crowding cannot flatten the reward-size hierarchy.
    let scale = 1;
    const nodes = arranged.map((node, i) => {
      const point = node.point;
      let nearest = Infinity;
      arranged.forEach(({point: neighbor, id}, j) => {
        if (i === j) return;
        const distance = Math.hypot(point.x - neighbor.x, point.y - neighbor.y);
        nearest = Math.min(nearest, distance);
        scale = Math.min(scale, 2 * (distance - 1) / (diameters[node.id - 1]! + diameters[id - 1]!));
      });
      return { ...node, hitSize: Math.min(32, nearest * 1.15) / 3.6 + 'cqw' };
    });
    return { nodes: nodes.map(node => ({ ...node, diameter: diameters[node.id - 1]! * scale / 3.6 + 'cqw' })), curves };
  }, [trait, stats]);
  const nodeNames = useMemo(() => nameTraitNodes(nodes), [nodes]);
  const active = preview === null ? undefined : nodes[preview];
  const arms = traitNodeArms(trait);
  const planFor = (id: number) => {
    const arm = Object.values(arms).find(path => path.includes(id)) ?? [];
    if (owned.has(id)) {
      const downstream = id === 1 ? Object.values(arms).flat() : arm.slice(arm.indexOf(id));
      const refund = downstream.filter(step => owned.has(step)).reverse();
      return id === 1 ? [...refund, 1] : refund;
    }
    return [1, ...arm.slice(0, arm.indexOf(id) + 1)].filter(step => !owned.has(step));
  };
  const available = traitPointsAvailable(character);
  // SAVED NODES: locked by Save traits, so they can't be refunded here.
  const isSaved = (id: number) => owned.has(id) && isTraitNodeSaved(character, trait, id);
  const action = (id: number) => {
    if (isSaved(id)) return 'Saved. Respec to change';
    const count = planFor(id).length;
    const points = count + (count === 1 ? ' point' : ' points');
    return owned.has(id) ? 'Refund ' + points : count > available ? 'Need ' + count + ' (' + available + ' free)' : 'Spend ' + points;
  };
  useEffect(() => {
    if (preview === null) return;
    const outside = (event: PointerEvent) => {
      if (!spiral.current?.contains(event.target as Node) && !previewHost?.contains(event.target as Node)) setPreview(null);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [preview, previewHost]);
  function browse(event: KeyboardEvent<HTMLButtonElement>, i: number) {
    if (event.key === 'Escape' && preview !== null) {
      event.preventDefault(); event.stopPropagation(); setPreview(null);
      return;
    }
    const direction = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? TRAIT_CAP - 1 : direction ? i + direction : null;
    if (target === null) return;
    event.preventDefault();
    setPreview(null);
    refs.current[Math.max(0, Math.min(TRAIT_CAP - 1, target))]?.focus();
  }
  return (
    <section ref={spiral} className="trait-spiral" aria-label={TRAIT_LABELS[trait] + ' rewards'}>
      {/* POINTS LEFT: the canvas title, like the skill tree's points line. */}
      <strong className="trait-spiral-title" role="status">
        {traitPointsAvailable(character)} {traitPointsAvailable(character) === 1 ? 'point' : 'points'} available
      </strong>
      {onSaveTraits && <SaveTraitsButton unsaved={unsavedTraitNodeCount(character)} onSave={() => { setPreview(null); onSaveTraits(); setReceipt('Traits saved. Respec to change them.'); }} />}
      <div className="trait-spiral-chart">
        <svg aria-hidden="true" viewBox="0 0 360 360">
          {curves.map(({ arm, path }) => <polyline key={arm} data-arm={arm} points={path} />)}
        </svg>
        {nodes.map((node, i) => {
          const point = node.point;
          const gain = node.changes[0];
          // HYBRID: any circle paying two stats (HP + Shield, flat + % damage) splits in half.
          const second = node.changes[1];
          const filled = owned.has(node.id);
          const steps = planFor(node.id);
          const saved = isSaved(node.id);
          const blocked = saved || (!filled && steps.length > available);
          const style: CSSProperties = { left: point.x / 3.6 + '%', top: point.y / 3.6 + '%', width: node.hitSize, height: node.hitSize };
          return <button key={node.id} type="button" ref={button => { refs.current[i] = button; }}
            className="trait-spiral-node" style={style} data-node-id={node.id} data-arm={node.arm} data-reward={gain?.key}
            data-blocked={blocked} data-milestone={Boolean(gain)} data-finale={node.tip} data-next={!filled && !blocked && steps.length === 1} data-earned={filled} data-saved={saved}
            data-current={preview === i} data-preview={preview === i && !blocked ? (filled ? "refund" : "spend") : undefined} aria-pressed={filled}
            aria-label={[(nodeNames.get(node.id) ?? 'Node ' + node.id) + (node.arm === 'junction' ? ', starting star' : ''), ...node.changes.map(stat => stat.label + ' +' + stat.delta + (stat.percent ? '%' : '')), action(node.id)].join('. ')}
            aria-describedby={preview === i ? detailsId : undefined}
            tabIndex={selected === i ? 0 : -1}
            onFocus={() => setSelected(i)}
            onClick={() => {
              setSelected(i);
              setReceipt('');
              if (preview !== i || blocked) {
                setPreview(i);
                return;
              }
              for (const id of steps) onSetNode(id, !filled);
              setPreview(null);
              setReceipt((filled ? 'Refunded ' : 'Spent ') + steps.length + (steps.length === 1 ? ' point' : ' points'));
            }}
            onKeyDown={event => browse(event, i)}>
            <span className={'trait-spiral-disc' + (gain ? ' stat-ink' : '')}
              data-stat={gain ? INKS[gain.key] : undefined} data-kind={gain ? gain.percent ? 'percent' : 'flat' : undefined}
              data-hybrid={second ? true : undefined}
              style={{ width: node.diameter, height: node.diameter }}>
              {gain && second && <HybridHalves stats={[gain, second]} showIcon={!filled} />}
              {node.arm === 'junction' && <svg aria-hidden="true" className="trait-start-star" viewBox="0 0 30 30"><path d="m15 1.5 4 8.3 9.4 1.3-6.8 6.6 1.7 9.4-8.3-4.5-8.3 4.5 1.7-9.4-6.8-6.6 9.4-1.3z" /></svg>}
              {filled ? <svg className="trait-owned-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg> : gain && !second && <StatIcon stat={gain.key} />}
            </span>
          </button>;
        })}
      </div>
      {active && previewHost && createPortal(<div id={detailsId} className="trait-spiral-inspect" aria-live="polite" aria-atomic="true">
        <div className="trait-spiral-preview-heading">
          <strong>{active.arm === 'junction' ? 'Starting star' : (nodeNames.get(active.id) ?? 'Node ' + active.id)}</strong>
          <span className="trait-spiral-cost">{action(active.id)}</span>
        </div>
        {active.changes.map(stat => <div className="trait-spiral-stat stat-ink" data-stat={INKS[stat.key]} key={stat.key}>
          <span className="trait-spiral-stat-name"><StatIcon stat={stat.key} />{stat.label}</span>
          <span><b>+{stat.delta}{stat.percent ? '%' : ''}</b> gain</span>
          <span><b>{totals[stat.key]}{stat.percent ? '%' : ''}</b> current</span>
        </div>)}
        {!active.changes.length && <span>No stat increase.</span>}
        {!isSaved(active.id) && (owned.has(active.id) || planFor(active.id).length <= available) && <span>Click the same node again to {owned.has(active.id) ? "refund" : "confirm"}.</span>}
      </div>, previewHost)}
      <p className="trait-arm-hint" aria-live="polite">{receipt || "Click a node to preview. Click it again to confirm."}</p>
    </section>
  );
};
