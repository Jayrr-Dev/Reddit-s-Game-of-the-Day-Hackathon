import { useState, useSyncExternalStore } from 'react';
import { getVolume, setVolume, subscribeVolume, playDraw, type AudioChannel } from '../lib/gameAudio';

function VolumeControl({channel, label}: {channel: AudioChannel; label: string}) {
  const volume = useSyncExternalStore(subscribeVolume, () => getVolume(channel));
  return <label className="grid grid-cols-[4rem_minmax(64px,1fr)_3rem] items-center gap-2 text-xs text-ink">
    {label}
    <input type="range" aria-label={label + ' volume'} min="0" max="100" step="1" value={volume}
      aria-valuetext={volume === 0 ? 'Muted' : volume + '%'}
      onChange={event => setVolume(channel, event.currentTarget.valueAsNumber)} />
    <output>{volume}%</output>
  </label>;
}

const preferences = [
  { key: 'villain-run.auto-end-turn', label: 'Auto-end turn', initial: true },
  { key: 'villain-run.boss-intros', label: 'Boss introductions', initial: true },
] as const;

const session = new Map<string, boolean>();

export function useGameSettings() {
  const [values, setValues] = useState(() => preferences.map(({ key, initial }) => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) return saved === 'true';
    } catch { /* Use the current session when storage is unavailable. */ }
    return session.get(key) ?? initial;
  }));
  const toggles = preferences.map(({ key, label }, index) => (
    <label className="flex items-center gap-2 py-1 text-xs text-ink" key={key}>
      <input type="checkbox" checked={values[index] ?? false} onChange={event => {
        const enabled = event.target.checked;
        session.set(key, enabled);
        try { localStorage.setItem(key, String(enabled)); } catch { /* Session value is retained. */ }
        setValues(previous => previous.map((value, i) => i === index ? enabled : value));
      }} />
      {label}
    </label>
  ));
  const controls = <>{toggles}<div className="grid w-full gap-2">
    <VolumeControl channel="music" label="Music" />
    <VolumeControl channel="sfx" label="SFX" />
    <button type="button" data-own-sound className="justify-self-end text-xs text-accent underline" onClick={playDraw}>Test SFX</button>
  </div></>;
  return { autoEnd: values[0], bossIntros: values[1] ?? true, controls };
}
