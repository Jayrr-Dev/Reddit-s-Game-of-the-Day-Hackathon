// --- CHARACTER SHEET ---
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { playSound } from '../../lib/gameAudio';
import { useNewItems } from '../../hooks/useNewItems';
import { useEquipSounds } from '../../hooks/useEquipSounds';
import {
  characterBonuses,
  ringSlotAccepts,
  ringSlotUnlocked,
  TRAITS,
  TRAIT_LABELS,
  traitPointsAvailable,
  TRAIT_CAP,
  xpToNextLevel,
  type CharacterState,
  type EquipmentSlot,
  type TraitId,
} from '../../../shared/game/character';
import { Glyph, type GlyphName } from '../ui/Glyph';
import { IconButton } from '../ui/IconButton';
import { Tooltip } from '../ui/Tooltip';
import { skillPointsLeft, type SkillPick } from '../../../shared/game/skills';
import { SkillTree } from './SkillTree';
import { TraitSpiral } from './TraitSpiral';
import { TutorialSpotlight } from './combat/TutorialSpotlight';
import { ItemEffect, JewelryIcon } from './jewelry';
import { itemBonusSummary, itemFlavor, itemInk } from './jewelryCopy';
import { RespecDialog, type RespecItem } from './RespecDialog';
import './characterSheet.css';

// --- TYPES AND PRESENTATION ---
export type SheetVitals = { hp: number; maxHp: number; guard?: number; energy?: number };
type SheetProps = {
  levelGuide?: "spend" | "close" | undefined;
  onSkill: (pick: SkillPick, rankUp?: boolean) => void;
  character: CharacterState;
  vitals?: SheetVitals | undefined;
  onSetTraitNode: (trait: TraitId, node: number, owned: boolean) => void;
  /** When given, the trait canvas shows Save traits, which locks spent nodes in. */
  onSaveTraits?: (() => void) | undefined;
  onRespec?: (() => void) | undefined;
  onEquip: (slot: EquipmentSlot, id: string | null, ringIndex?: number) => void;
  onClose: () => void;
  /** When given, a Profile tab comes first and the sheet opens on it. */
  profile?: ReactNode;
  /** When given with a profile, an Inventory tab follows the Profile tab. */
  inventory?: ReactNode;
  /** When given, Respec asks first and shows the item it spends. */
  respecItem?: RespecItem | undefined;
};
type SheetPage = 'profile' | 'inventory' | 'traits' | 'equipment' | 'skills';
/** The tab order. Profile and Inventory show only when the sheet is given them. */
const SHEET_TABS: ReadonlyArray<{ page: SheetPage; label: string }> = [
  { page: 'profile', label: 'Profile' },
  { page: 'skills', label: 'Skill tree' },
  { page: 'traits', label: 'Traits' },
  { page: 'equipment', label: 'Equipment' },
  { page: 'inventory', label: 'Inventory' },
];
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

function PlayerStats({ character, vitals, previewRef, onRespec, respecItem }: Pick<SheetProps, 'character' | 'vitals' | 'onRespec' | 'respecItem'> & {
  previewRef: (element: HTMLDivElement | null) => void;
}) {
  const stats = characterBonuses(character.traits, character.equipment, character.traitNodes);
  const [isAskingRespec, setIsAskingRespec] = useState(false);
  /** Refunds every trait point with the paper sound. */
  const respec = () => { playSound('respec', 1, .72); onRespec?.(); };
  const flatAndPercent = (flat: number, percent: number) => '+' + flat + ' / +' + percent + '%';
  const rows: { label: string; description: string; ink: string; icon: GlyphName; value: string }[] = [
    { label: vitals ? 'HP' : 'Max HP', description: vitals ? 'Your current health and its maximum. At 0 HP the run ends.' : 'The most health you can have. At 0 HP the run ends.', icon: 'heart', ink: 'hp', value: vitals ? vitals.hp + ' / ' + vitals.maxHp : String(stats.maxHp) },
    { label: 'Healing bonus', description: 'Extra healing from every heal.', icon: 'heartbeat', ink: 'heal', value: '+' + stats.healingPercent + '%' },
    { label: 'Shield bonus', description: 'Extra **Guard** from shield cards: a flat amount, then a percent.', icon: 'shield', ink: 'guard', value: flatAndPercent(stats.shieldFlat, stats.shieldPercent) },
    { label: 'Melee', description: 'Extra **Melee** damage: a flat amount, then a percent.', icon: 'sword', ink: 'melee', value: flatAndPercent(stats.meleeFlat, stats.meleePercent) },
    { label: 'Ranged', description: 'Extra **Ranged** damage: a flat amount, then a percent.', icon: 'bow', ink: 'range', value: flatAndPercent(stats.rangeFlat, stats.rangePercent) },
    { label: 'Magic', description: 'Extra **Magic** damage: a flat amount, then a percent.', icon: 'swirl', ink: 'magic', value: flatAndPercent(stats.magicFlat, stats.magicPercent) },
    { label: 'Accuracy', description: 'Raises the chance each shot lands.', icon: 'eye', ink: 'range', value: '+' + stats.accuracyPercent + '%' },
    { label: 'Affliction damage', description: 'Extra damage from the afflictions you apply.', icon: 'skull', ink: 'status', value: '+' + stats.afflictionDamagePercent + '%' },
    { label: 'Affliction stacks', description: 'Extra stacks each time you apply an affliction.', icon: 'skull', ink: 'status', value: '+' + stats.afflictionFlat },
    { label: vitals?.energy === undefined ? 'Max energy' : 'Energy', description: 'The most energy you can hold to play cards.', icon: 'flask', ink: 'energy', value: vitals?.energy === undefined ? String(stats.maxEnergy) : vitals.energy + ' / ' + stats.maxEnergy },
    { label: 'Cards per turn', description: 'Cards you draw at the start of each turn.', icon: 'cards', ink: 'draw', value: String(stats.cardsPerTurn) },
    { label: 'Starting energy', description: 'Energy you get at the start of each turn.', icon: 'bolt', ink: 'energy', value: String(stats.startingEnergy) },
    { label: 'Retained energy', description: 'Unspent energy you can carry into your next turn.', icon: 'hourglass', ink: 'energy', value: String(stats.retainEnergy) },
  ];
  if (vitals?.guard !== undefined) rows.push({ label: 'Guard', description: 'Blocks damage before it reaches your HP.', icon: 'shield', ink: 'guard', value: String(vitals.guard) });
  return (
    <section className="cs-player-stats" aria-label="Player stats">
      <div className="cs-player-stats-head">
        <h3>Player stats</h3>
        {/* RESPEC: refunds every trait point; sits beside the stats it resets. */}
        {onRespec && <button type="button" className="cs-respec" data-own-sound onClick={() => respecItem ? setIsAskingRespec(true) : respec()}
          disabled={!TRAITS.some(id => character.traits[id] > 0)}>Respec all</button>}
        {isAskingRespec && respecItem && <RespecDialog item={respecItem}
          onCancel={() => setIsAskingRespec(false)}
          onConfirm={() => { setIsAskingRespec(false); respec(); }} />}
      </div>
      <div className="cs-trait-preview-slot" ref={previewRef} />
      <div className="cs-player-stats-list" role="region" aria-label="Stat values" tabIndex={0}>
        <dl>{rows.map(({ label, description, ink, icon, value }) => (
          <div className="stat-ink" data-stat={ink} key={label}>
            <dt><Glyph name={icon} /><Tooltip content={{ title: label, description }}><span>{label}</span></Tooltip></dt><dd title={value.replace(' / +', ' flat, +')}>{value}</dd>
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
  onSaveTraits,
  onRespec,
  respecItem,
  trait,
  onSelectTrait,
}: Pick<SheetProps, 'character' | 'vitals' | 'onSetTraitNode' | 'onSaveTraits' | 'onRespec' | 'respecItem'> & {
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
            aria-label={`${TRAIT_LABELS[id]}, ${character.traits[id]} of ${TRAIT_CAP} nodes`}
            onClick={() => onSelectTrait(id)}
          >
            <Glyph name={TRAIT_ICONS[id]} />
            <span className="cs-name">{TRAIT_LABELS[id]}</span>
            <strong>{character.traits[id]}</strong>
          </button>
        ))}
      </div>
      <div className="cs-rank-panel">
        <TraitSpiral key={trait} character={character} trait={trait} stats={STATS} previewHost={previewHost}
          onSetNode={(node, owned) => onSetTraitNode(trait, node, owned)} onSaveTraits={onSaveTraits} />
      </div>
      <PlayerStats character={character} vitals={vitals} previewRef={setPreviewHost} onRespec={onRespec} respecItem={respecItem} />
    </>
  );
};


/** Describes the campaign milestone or post-run drop for a locked ring slot. */
const ringRequirement = (character: CharacterState, index: number) => {
  const number = index + 1;
  return `Defeat ${number} story region ${number === 1 ? 'champion' : 'champions'} (${character.ringProgress.bossWins}/${number}).`;
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
  useEquipSounds(character.equipment);
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
/** A small count beside a tab name; hidden at zero. */
const TabCount = ({ badge }: { badge: { count: number; label: string } | undefined }) =>
  badge && badge.count > 0 ? (
    <span className="cs-tab-points" aria-label={`${badge.count} ${badge.label}`}>{badge.count}</span>
  ) : null;

/** Opens the character sheet as a focus-trapped dialog within the game viewport. */
export const CharacterSheet = ({
  onSkill,
  levelGuide,
  character,
  vitals,
  onSetTraitNode,
  onSaveTraits,
  onRespec,
  onEquip,
  onClose,
  profile,
  inventory,
  respecItem,
}: SheetProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState<SheetPage>(profile ? 'profile' : 'traits');
  const [trait, setTrait] = useState<TraitId>('vigor');
  const needed = xpToNextLevel(character.level);
  const { newCount, markSeen } = useNewItems(character.inventory.map((item) => item.id));
  /** Counts beside the tab names: unspent points, and new items on Equipment. */
  const tabCounts: Partial<Record<SheetPage, { count: number; label: string }>> = {
    traits: { count: traitPointsAvailable(character), label: 'points to spend' },
    skills: { count: skillPointsLeft(character), label: 'points to spend' },
    ...(newCount > 0 && { equipment: { count: newCount, label: newCount === 1 ? 'new item' : 'new items' } }),
  };
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
    node.querySelector<HTMLButtonElement>('.cs-back')?.focus();
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
      <IconButton icon="back" label="Back" className="cs-back" onClick={onClose} />
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
          <h3><span className="cs-name">{TRAIT_LABELS[trait]}</span> {character.traits[trait]}/{TRAIT_CAP}</h3>
        </div>
      )}
      </header>
      <div className="cs-pages" aria-label="Character views">
        {SHEET_TABS.filter(({ page: tab }) => (tab === 'profile' ? profile : tab === 'inventory' ? inventory : true)).map(({ page: tab, label }) => (
          <button
            key={tab}
            type="button"
            data-tab={tab}
            aria-pressed={page === tab}
            onClick={() => {
              if (tab === 'traits' && page !== 'traits') setTrait('vigor');
              if (tab === 'equipment') markSeen();
              setPage(tab);
            }}
          >
            {label}
            <TabCount badge={tabCounts[tab]} />
          </button>
        ))}
      </div>
      <div className="cs-body" key={page} data-page={page}>
        {page === 'profile' ? (
          <div className="cs-profile">{profile}</div>
        ) : page === 'inventory' ? (
          inventory
        ) : page === 'traits' ? (
          <Traits
            character={character}
            vitals={vitals}
            trait={trait}
            onRespec={onRespec}
            respecItem={respecItem}
            onSelectTrait={setTrait}
            onSetTraitNode={onSetTraitNode}
            onSaveTraits={onSaveTraits}
          />
        ) : page === 'skills' ? (
          <SkillTree character={character} onSkill={onSkill} />
        ) : (
          <Equipment character={character} onEquip={onEquip} />
        )}
      </div>
      </div>
      {levelGuide && <TutorialSpotlight
        selector={levelGuide === 'close' ? '.cs-back' : page === 'traits' ? '.trait-spiral-node[data-arm="junction"]' : '.cs-pages [data-tab="traits"]'}
        label={levelGuide === 'close' ? 'Back' : page === 'traits' ? 'Tap the star' : 'Open Traits'}
      />}
    </dialog>
  );
};

