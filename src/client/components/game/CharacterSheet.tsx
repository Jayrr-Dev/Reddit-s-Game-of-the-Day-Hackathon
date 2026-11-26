import { TRAINING_JEWELRY } from '../../../shared/game/trainingJewelry';
// --- CHARACTER SHEET ---
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { playSound } from '../../lib/gameAudio';
import {
  characterBonuses,
  IRON_RING_RESERVE,
  TRAVELERS_AMULET_DRAW,
  ringSlotAccepts,
  ringSlotUnlocked,
  TRAITS,
  TRAIT_CAP,
  traitPointsAvailable,
  xpToNextLevel,
  type CharacterState,
  type EquipmentSlot,
  type TraitId,
} from '../../../shared/game/character';
import { Glyph, type GlyphName } from '../ui/Glyph';
import type { SkillPick } from '../../../shared/game/skills';
import { SkillTree } from './SkillTree';
import { TraitSpiral } from './TraitSpiral';
import { TutorialSpotlight } from './combat/TutorialSpotlight';
import './characterSheet.css';

// --- TYPES AND PRESENTATION ---
export type SheetVitals = { hp: number; maxHp: number; guard?: number; energy?: number };
type SheetProps = {
  levelGuide?: "spend" | "close" | undefined;
  onSkill: (pick: SkillPick, rankUp?: boolean) => void;
  character: CharacterState;
  vitals?: SheetVitals | undefined;
  onSetTraitNode: (trait: TraitId, node: number, owned: boolean) => void;
  onRespec?: (() => void) | undefined;
  onEquip: (slot: EquipmentSlot, id: string | null, ringIndex?: number) => void;
  onClose: () => void;
};
type Stat = keyof ReturnType<typeof characterBonuses>;
const TRAIT_ICONS: Record<TraitId, GlyphName> = {
  vigor: 'heart',
  strength: 'fist',
  dexterity: 'bow',
  intelligence: 'swirl',
  scorn: 'skull',
  endurance: 'bolt',
};
const STATS: ReadonlyArray<{ key: Stat; label: string; percent?: boolean }> = [
  { key: 'maxHp', label: 'Max HP' },
  { key: 'shieldPercent', label: 'Shield bonus', percent: true },
  { key: 'healingPercent', label: 'Healing bonus', percent: true },
  { key: 'shieldFlat', label: 'Flat shield' },
  { key: 'meleePercent', label: 'Melee bonus', percent: true },
  { key: 'meleeFlat', label: 'Flat melee damage' },
  { key: 'rangePercent', label: 'Ranged bonus', percent: true },
  { key: 'rangeFlat', label: 'Flat ranged damage' },
  { key: 'accuracyPercent', label: 'Accuracy bonus', percent: true },
  { key: 'magicPercent', label: 'Magic bonus', percent: true },
  { key: 'magicFlat', label: 'Flat magic damage' },
  { key: 'afflictionDamagePercent', label: 'Affliction damage', percent: true },
  { key: 'afflictionFlat', label: 'Affliction stacks' },
  { key: 'startingEnergy', label: 'Starting energy' },
  { key: 'retainEnergy', label: 'Retained energy' },
  { key: 'maxEnergy', label: 'Max energy' },
];

function PlayerStats({ character, vitals, previewRef }: Pick<SheetProps, 'character' | 'vitals'> & {
  previewRef: (element: HTMLDivElement | null) => void;
}) {
  const stats = characterBonuses(character.traits, character.equipment, character.traitNodes);
  const flatAndPercent = (flat: number, percent: number) => '+' + flat + ' / +' + percent + '%';
  const rows: { label: string; ink: string; icon: GlyphName; value: string }[] = [
    { label: vitals ? 'HP' : 'Max HP', icon: 'heart', ink: 'hp', value: vitals ? vitals.hp + ' / ' + vitals.maxHp : String(stats.maxHp) },
    { label: 'Healing bonus', icon: 'heartbeat', ink: 'heal', value: '+' + stats.healingPercent + '%' },
    { label: 'Shield bonus', icon: 'shield', ink: 'guard', value: flatAndPercent(stats.shieldFlat, stats.shieldPercent) },
    { label: 'Melee', icon: 'sword', ink: 'melee', value: flatAndPercent(stats.meleeFlat, stats.meleePercent) },
    { label: 'Ranged', icon: 'bow', ink: 'range', value: flatAndPercent(stats.rangeFlat, stats.rangePercent) },
    { label: 'Magic', icon: 'swirl', ink: 'magic', value: flatAndPercent(stats.magicFlat, stats.magicPercent) },
    { label: 'Accuracy', icon: 'eye', ink: 'range', value: '+' + stats.accuracyPercent + '%' },
    { label: 'Affliction damage', icon: 'skull', ink: 'status', value: '+' + stats.afflictionDamagePercent + '%' },
    { label: 'Affliction stacks', icon: 'skull', ink: 'status', value: '+' + stats.afflictionFlat },
    { label: vitals?.energy === undefined ? 'Max energy' : 'Energy', icon: 'flask', ink: 'energy', value: vitals?.energy === undefined ? String(stats.maxEnergy) : vitals.energy + ' / ' + stats.maxEnergy },
    { label: 'Cards per turn', icon: 'cards', ink: 'draw', value: String(stats.cardsPerTurn) },
    { label: 'Starting energy', icon: 'bolt', ink: 'energy', value: String(stats.startingEnergy) },
    { label: 'Retained energy', icon: 'hourglass', ink: 'energy', value: String(stats.retainEnergy) },
  ];
  if (vitals?.guard !== undefined) rows.push({ label: 'Guard', icon: 'shield', ink: 'guard', value: String(vitals.guard) });
  return (
    <section className="cs-player-stats" aria-label="Player stats">
      <h3>Player stats</h3>
      <div className="cs-trait-preview-slot" ref={previewRef} />
      <div className="cs-player-stats-list" role="region" aria-label="Stat values" tabIndex={0}>
        <dl>{rows.map(({ label, ink, icon, value }) => (
          <div className="stat-ink" data-stat={ink} key={label}>
            <dt><Glyph name={icon} /><span title={label}>{label}</span></dt><dd title={value.replace(' / +', ' flat, +')}>{value}</dd>
          </div>
        ))}</dl>
      </div>
    </section>
  );
}

/** Choose a trait, then select how far to train or refund it. */
const Traits = ({
  character,
  vitals,
  onSetTraitNode,
  trait,
  onSelectTrait,
}: Pick<SheetProps, 'character' | 'vitals' | 'onSetTraitNode'> & {
  trait: TraitId;
  onSelectTrait: (trait: TraitId) => void;
}) => {
  const [previewHost, setPreviewHost] = useState<HTMLDivElement | null>(null);
  return (
    <>
      <div className="cs-trait-grid" aria-label="Choose a trait">
        {TRAITS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={trait === id}
            aria-label={`${id}, ${character.traits[id]} of ${TRAIT_CAP} nodes`}
            onClick={() => onSelectTrait(id)}
          >
            <Glyph name={TRAIT_ICONS[id]} />
            <span className="cs-name">{id}</span>
            <strong>{character.traits[id]}</strong>
          </button>
        ))}
      </div>
      <div className="cs-rank-panel">
        <TraitSpiral key={trait} character={character} trait={trait} stats={STATS} previewHost={previewHost}
          onSetNode={(node, owned) => onSetTraitNode(trait, node, owned)} />
      </div>
      <PlayerStats character={character} vitals={vitals} previewRef={setPreviewHost} />
    </>
  );
};

/** Ink silhouettes distinguish a band and a pendant at slot size. */
const JewelryIcon = ({ slot }: { slot: EquipmentSlot }) => (
  <svg
    className="cs-jewelry"
    viewBox="0 0 40 40"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {slot === 'ring' ? (
      <>
        <path d="M13.4 13.6C7 17.2 5.2 25.3 9.2 31.1c4 6 12.8 6.2 18.3 1.3 5.9-5.2 6-13.5-.1-18.1" />
        <path d="M15.2 16.3c-5 3.4-5.8 9-3 13 3.1 4.6 9.2 4.5 13.3.9 4.3-3.7 4.2-9.7.3-13.4" />
        <path d="m12.2 10.2 3.6-4.4h8.4l3.6 4.4-7.8 8.4zM12.2 10.2h15.6m-7.8 8.4-3.4-8.4L20 5.8l3.4 4.4z" />
      </>
    ) : (
      <>
        <path d="M4.8 4.2c2.8 7.9 6.9 12.4 14.1 15.2m16.3-15.2c-2.9 8-7.1 12.5-14.1 15.2M6.6 4.4c3.1 6.6 6.9 10.8 12.5 13.3m14.3-13.3c-3.1 6.6-6.9 10.8-12.5 13.3" />
        <circle cx="20" cy="18.8" r="2" />
        <path d="m20 20.9 6.3 6.5-6.3 8.9-6.3-8.9zM20 23.6l3.5 4-3.5 5.2-3.5-5.2z" />
      </>
    )}
  </svg>
);

/** Describes the campaign milestone or post-run drop for a locked ring slot. */
const ringRequirement = (character: CharacterState, index: number) => {
  const number = index + 1;
  return `Defeat ${number} story region ${number === 1 ? 'champion' : 'champions'} (${character.ringProgress.bossWins}/${number}).`;
};

const itemFlavor: Record<string, string> = {
  ...Object.fromEntries(TRAINING_JEWELRY.map(item => [item.id, item.flavor])),
  'iron-ring': 'The smith left a single hammer mark inside the band.',
  'travelers-amulet': 'The clasp is worn smooth where a traveler rubbed it at every crossroads.',
};

/** Short ledger copy uses the same item values as the detailed effect. */
const itemBonusSummary = (id: string) => {
  if (id === 'iron-ring') return '+' + IRON_RING_RESERVE + ' reserve energy';
  if (id === 'travelers-amulet') return '+' + TRAVELERS_AMULET_DRAW + ' card per turn';
  return 'Cosmetic';
};

/** Display the same effect icon and ink in the inventory and item details. */
const itemInk = (id: string) => id === 'travelers-amulet' ? 'draw' : id === 'iron-ring' ? 'energy' : undefined;
/** Displays the same quantities applied by the combat engine. */
const ItemEffect = ({ id }: { id: string }) => {
  if (id === 'iron-ring') return (
    <p className="cs-real-effect stat-ink" data-stat="energy"><Glyph name="bolt" /><strong>+{IRON_RING_RESERVE} Reserve Energy capacity.</strong></p>
  );
  if (id === 'travelers-amulet') return (
    <p className="cs-real-effect stat-ink" data-stat="draw"><Glyph name="cards" /><strong>Draw {TRAVELERS_AMULET_DRAW} extra {TRAVELERS_AMULET_DRAW === 1 ? 'card' : 'cards'} at the start of your turn.</strong></p>
  );
  if (TRAINING_JEWELRY.some(item => item.id === id)) return <p className="cs-real-effect"><strong>Training replica. Cosmetic only.</strong></p>;
  return null;
};

/** Keeps worn jewelry and unworn inventory in separate compartments. */
const Equipment = ({
  character,
  onEquip,
}: Pick<SheetProps, 'character' | 'onEquip'>) => {
  const [selected, setSelected] = useState<number | 'amulet'>(0);
  const [inspected, setInspected] = useState<string | undefined>(character.inventory[0]?.id);
  const detailId = useId();
  const detailRef = useRef<HTMLElement>(null);
  const inspectedItem = character.inventory.find(item => item.id === inspected);
  /** Reveal the details below the inventory without changing the equipped item. */
  const inspect = (id: string) => {
    setInspected(id);
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'nearest' }));
  };
  const { rings, amulet } = character.equipment;
  const previousEquipment = useRef({ rings, amulet });
  useEffect(() => {
    const before = previousEquipment.current;
    previousEquipment.current = { rings, amulet };
    if ((amulet && amulet !== before.amulet) || rings.some((id, i) => id && id !== before.rings[i])) {
      playSound('equip', 1, .84);
    } else if ((before.amulet && !amulet) || before.rings.some((id, i) => id && !rings[i])) {
      playSound('unequip', 1, .88);
    }
  }, [rings, amulet]);
  const nearestRingSlot = (id: string) => {
    const origin = typeof selected === 'number' ? selected : 0;
    const eligible = rings.map((_, index) => index)
      .filter(index => ringSlotAccepts(character, index, id))
      .sort((a, b) => Math.abs(a - origin) - Math.abs(b - origin));
    return eligible.find(index => !rings[index]) ?? eligible[0];
  };
  const slot = selected === 'amulet' ? 'amulet' : 'ring';
  const ringIndex = typeof selected === 'number' ? selected : undefined;
  const locked =
    ringIndex !== undefined && !ringSlotUnlocked(character, ringIndex);
  const unlockedCount = rings.filter((_, index) =>
    ringSlotUnlocked(character, index)
  ).length;
    const starterOnly = locked && ringIndex === 0;
  const selectedId = typeof selected === 'number' ? rings[selected] : amulet;
  const selectedItem = character.inventory.find(
    (item) => item.id === selectedId
  );
  const target =
    typeof selected === 'number' ? `Ring slot ${selected + 1}` : 'Amulet slot';
  const unworn = character.inventory.filter(
    (item) => item.id !== amulet && !rings.includes(item.id)
  );
  return (
    <div className="cs-equipment">
      <section className="cs-paper" aria-label="Equipment slots">
        <h3>Equipment</h3>
        <div className="cs-compartment">
          <div className="cs-caption">
            <span>Rings</span>
            <span>
              {rings.filter(Boolean).length} equipped · {unlockedCount}/
              {rings.length} unlocked
            </span>
          </div>
          <div className="cs-rings">
            {rings.map((id, index) => {
              const unlocked = ringSlotUnlocked(character, index);
              const name =
                character.inventory.find((item) => item.id === id)?.name ??
                'Empty';
                const reserved = !unlocked && index === 0;
                const label = `Ring slot ${index + 1}, ${reserved ? name + ', Iron Ring only' : unlocked ? name : 'Locked'}`;
              return (
                <button
                  key={index}
                  type="button"
                  title={label}
                  aria-label={label}
                  className="cs-slot"
                  data-occupied={Boolean(id)}
                  data-locked={!unlocked && !reserved}
                  data-reserved={reserved}
                  aria-pressed={selected === index}
                  onClick={() => { setSelected(index); if (id) setInspected(id); }}
                >
                  {unlocked || reserved ? (
                    <JewelryIcon slot="ring" />
                  ) : (
                    <Glyph name="padlock" className="cs-lock" />
                  )}
                  <span>{index + 1}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="cs-slot cs-amulet"
            data-occupied={Boolean(amulet)}
            aria-label="Select amulet slot"
            aria-pressed={selected === 'amulet'}
            onClick={() => { setSelected('amulet'); if (amulet) setInspected(amulet); }}
          >
            <JewelryIcon slot="amulet" />
            <span>Amulet</span>
            <small>
              {character.inventory.find((item) => item.id === amulet)?.name ??
                'Empty'}
            </small>
          </button>
          <div className="cs-selected" aria-live="polite">
            <span>
              <b>{target}</b>
              <small>
                {selectedItem ? <button type="button" className="cs-inspect-name" aria-label={`Inspect equipped ${selectedItem.name}`}
                  aria-controls={detailId} onClick={() => inspect(selectedItem.id)}>{selectedItem.name}</button> : locked && ringIndex !== undefined
                  ? (starterOnly ? 'Empty' : ringRequirement(character, ringIndex))
                  : 'Empty'}
              </small>
              {starterOnly && <small>Iron Ring only until you defeat the first story region champion.</small>}
            </span>
            {selectedItem && (
              <button
                type="button"
                data-own-sound
                aria-label={'Unequip ' + selectedItem.name}
                onClick={() => onEquip(slot, null, ringIndex)}
              >
                Unequip
              </button>
            )}
          </div>
        </div>
      </section>
      <section className="cs-paper cs-inventory" aria-label="Unequipped inventory">
        <h3>Inventory <span className="cs-inventory-count">{unworn.length} {unworn.length === 1 ? 'item' : 'items'}</span></h3>
        <div className="cs-compartment">
          {!unworn.length && (
            <p className="cs-bag-empty">All items equipped.</p>
          )}
          {unworn.length > 0 && <div className="cs-inventory-list" tabIndex={0} role="region" aria-label="Inventory items">
          {unworn.map((item) => {
            const destination = item.slot === 'ring' ? nearestRingSlot(item.id) : undefined;
            const unavailable = item.slot === 'ring' && destination === undefined;
            const slotName = destination === undefined ? 'amulet slot' : `ring slot ${destination + 1}`;
            return (
            <div className="cs-bag-item" key={item.id}>
                <button type="button" className="cs-inspect-bag" aria-pressed={item.id === inspected}
                  aria-controls={detailId} aria-label={`Inspect ${item.name}`} aria-description={`${item.slot}. ${itemBonusSummary(item.id)}`} onClick={() => inspect(item.id)}>
                  <JewelryIcon slot={item.slot} />
                  <span>
                <b>{item.name}</b>
                <small><span className="cs-inline-bonus stat-ink" data-stat={itemInk(item.id)}>{itemInk(item.id) && <Glyph name={item.slot === 'amulet' ? 'cards' : 'bolt'} />}{itemBonusSummary(item.id)}</span></small>
                  </span>
                </button>
              <button
                type="button"
                disabled={unavailable}
                data-own-sound
                aria-label={unavailable ? `No unlocked slot for ${item.name}` : `Equip ${item.name} in ${slotName}`}
                onClick={() => {
                  setSelected(destination ?? 'amulet');
                  setInspected(item.id);
                  onEquip(item.slot, item.id, destination);
                }}
              >
                Equip
              </button>
            </div>
          );})}
          </div>}
        </div>
      </section>
      {inspectedItem && <section ref={detailRef} id={detailId} className="cs-paper cs-item-inspection" aria-label="Item details" aria-live="polite">
        <h3>{inspectedItem.name}</h3>
        <div className="cs-compartment">
          <p className="cs-item-lore">{itemFlavor[inspectedItem.id]}</p>
          <ItemEffect id={inspectedItem.id} />
        </div>
      </section>}
    </div>
  );
};
/** Opens the character sheet as a focus-trapped dialog within the game viewport. */
export const CharacterSheet = ({
  onSkill,
  levelGuide,
  character,
  vitals,
  onSetTraitNode,
  onRespec,
  onEquip,
  onClose,
}: SheetProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState<'traits' | 'equipment' | 'skills'>('traits');
  const [trait, setTrait] = useState<TraitId>('vigor');
  const points = traitPointsAvailable(character);
  const needed = xpToNextLevel(character.level);
  useLayoutEffect(() => {
    const node = dialog.current;
    const frame = node?.closest('.dueling-table, #root') ?? node?.parentElement;
    if (!node || !frame) return;
    // Native modal dialogs enter the top layer. Keep its scrim inside the game.
    const fitFrame = () => {
      const bounds = frame.getBoundingClientRect();
      const left = Math.max(0, bounds.left);
      const top = Math.max(0, bounds.top);
      node.style.left = left + 'px';
      node.style.top = top + 'px';
      node.style.width = Math.max(0, Math.min(bounds.right, window.innerWidth) - left) + 'px';
      node.style.height = Math.max(0, Math.min(bounds.bottom, window.innerHeight) - top) + 'px';
    };
    fitFrame();
    node.showModal();
    node.querySelector<HTMLButtonElement>('.cs-close')?.focus();
    const observer = new ResizeObserver(fitFrame);
    observer.observe(frame);
    window.addEventListener('resize', fitFrame);
    window.addEventListener('scroll', fitFrame, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fitFrame);
      window.removeEventListener('scroll', fitFrame, true);
      node.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="character-boundary"
      aria-label="Character"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="character-sheet">
      <header className="cs-topline">
      <h2>Character</h2>
      <div className="cs-level">
        <strong>Level {character.level}</strong>
        {needed > 0 ? (
          <>
            <span>
              {character.xp} / {needed} XP
            </span>
            <progress
              max={needed}
              value={character.xp}
              aria-label="Experience toward next level"
            />
          </>
        ) : (
          <span>Max level</span>
        )}
      </div>
      {page === 'traits' && (
        <div className="cs-trait-summary">
          <h3><span className="cs-name">{trait}</span> {character.traits[trait]}/{TRAIT_CAP}</h3>
          {onRespec && <button type="button" className="cs-action" data-own-sound onClick={() => { playSound('respec', 1, .72); onRespec(); }}
            disabled={!TRAITS.some(id => character.traits[id] > 0)}>Respec all</button>}
          <strong className="cs-trait-points" role="status">{points} {points === 1 ? 'point' : 'points'} available</strong>
        </div>
      )}
        <button
          type="button"
          className="cs-close"
          onClick={onClose}
          aria-label="Close character sheet"
        >
          Close
        </button>
      </header>
      <div className="cs-pages" aria-label="Character views">
        <button
          type="button"
          aria-pressed={page === 'traits'}
          onClick={() => { if (page !== 'traits') setTrait('vigor'); setPage('traits'); }}
        >
          Traits
        </button>
        <button
          type="button"
          aria-pressed={page === 'equipment'}
          onClick={() => setPage('equipment')}
        >
          Equipment
        </button>
        <button
          type="button"
          aria-pressed={page === 'skills'}
          onClick={() => setPage('skills')}
        >
          Skill tree
        </button>
      </div>
      <div className="cs-body" key={page} data-page={page}>
        {page === 'traits' ? (
          <Traits
            character={character}
            vitals={vitals}
            trait={trait}
            onSelectTrait={setTrait}
            onSetTraitNode={onSetTraitNode}
          />
        ) : page === 'skills' ? (
          <SkillTree character={character} onSkill={onSkill} />
        ) : (
          <Equipment character={character} onEquip={onEquip} />
        )}
      </div>
      </div>
      {levelGuide && <TutorialSpotlight
        selector={levelGuide === 'close' ? '.cs-close' : page === 'traits' ? '.trait-spiral-node[data-arm="junction"]' : '.cs-pages button:first-child'}
        label={levelGuide === 'close' ? 'Close' : page === 'traits' ? 'Tap the star' : 'Open Traits'}
      />}
    </dialog>
  );
};

