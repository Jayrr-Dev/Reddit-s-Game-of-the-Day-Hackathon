import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { CreatureFigure } from '../../src/client/components/game/combat/CreatureFigure';
import type { CreatureId, HeroAction } from '../../src/client/content/heroLooks';
import './preview.css';

const roster = [
  ['archangelUriel', 'Archangel Uriel (reference)'],
  ['archangelZeruel', 'Archangel Zeruel'],
  ['zeruelArmored', 'Archangel Zeruel · Armored'],
  ['grandangelCherubiel', 'Grandangel Cherubiel'],
  ['grandangelCambiel', 'Grandangel Cambiel'],
  ['grandangelGeonosis', 'Grandangel Geonosis'],
  ['grandangelRaziel', 'Grandangel Raziel'],
  ['zadkielOfDominations', 'Grandangel Zadkiel'],
  ['cervielSword', 'Grandangel Cerviel · Sword'],
  ['grandangelCerviel', 'Cerviel · Staff'],
  ['cervielBow', 'Cerviel · Bow'],
  ['angelAssassin', 'Angel Assassin · Wings'],
  ['pride', 'Pride'],
  ['sloth', 'Sloth'],
  ['envy', 'Envy'],
] as const satisfies readonly (readonly [CreatureId, string])[];

type Motion = 'idle' | 'primary' | 'guard' | 'signature';
const melee = new Set<CreatureId>(['grandangelCambiel', 'archangelZeruel', 'zeruelArmored', 'archangelUriel', 'cervielSword', 'pride', 'sloth']);
function Angel({ heroId, label, motion, charging, small }: {
  heroId: CreatureId; label: string; motion: Motion; charging: boolean; small: boolean;
}) {
  const action: HeroAction | null = motion === 'idle' ? null : {
    style: motion === 'guard' || charging && motion === 'signature' ? 'support' :
      heroId === 'cervielBow' ? 'range' : motion === 'primary' && melee.has(heroId) ? 'melee' : 'magic',
    swing: 'slash',
    isSignature: motion === 'signature',
    isTwoHanded: false,
    ...(motion === 'signature' ? { isCharging: charging } : {}),
  };
  return <article>
    <div className={small ? 'silhouette small' : 'silhouette'}><CreatureFigure heroId={heroId} size={3} action={action} /></div>
    <h2>{label}</h2>
  </article>;
}

function Preview() {
  const [motion, setMotion] = useState<Motion>('idle');
  const [sequence, setSequence] = useState(0);
  const [charging, setCharging] = useState(false);
  const [small, setSmall] = useState(false);
  const [day, setDay] = useState(false);
  const [hold, setHold] = useState(false);
  const [selected, setSelected] = useState<'all' | CreatureId>('all');
  useEffect(() => {
    if (motion === 'idle') return;
    if (motion === 'signature' && charging) {
      const release = window.setTimeout(() => setCharging(false), 900);
      return () => window.clearTimeout(release);
    }
    if (hold) return;
    const reset = window.setTimeout(() => setMotion('idle'), 720);
    return () => window.clearTimeout(reset);
  }, [motion, charging, sequence, hold]);
  function play(next: Motion) {
    setSequence(s => s + 1);
    setCharging(next === 'signature');
    setMotion(next);
  }
  return <main data-day={day} data-hold={hold && motion !== 'idle' && !charging}>
    <header><h1>Boss Rig Review</h1><p>Original rig reference, idle, and combat poses. No game state changes.</p>
      <div className="controls">
        <label>Character <select value={selected} onChange={e => setSelected(roster.find(([id]) => id === e.target.value)?.[0] ?? 'all')}>
          <option value="all">All</option>{roster.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></label>
        <button onClick={() => play('idle')}>Idle</button>
        <button onClick={() => play('primary')}>Attack</button>
        <button onClick={() => play('guard')}>Guard / Cast</button>
        <button onClick={() => play('signature')}>Signature</button>
        <label><input type="checkbox" checked={small} onChange={e => setSmall(e.target.checked)} /> Combat scale</label>
        <label><input type="checkbox" checked={day} onChange={e => setDay(e.target.checked)} /> Light background</label>
        <label><input type="checkbox" checked={hold} onChange={e => setHold(e.target.checked)} /> Hold CSS pose</label>
      </div>
    </header>
    <section aria-label="Angel rigs">{roster.filter(([id]) => selected === 'all' || id === selected).map(([id, label]) =>
      <Angel key={id} heroId={id} label={label} motion={motion} charging={charging} small={small} />)}</section>
  </main>;
}

const app = document.getElementById('app');
if (app) createRoot(app).render(<Preview />);
