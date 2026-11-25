import { useEffect, useRef } from 'react';
import { readAudioAsset } from './apiClient';

import wild from '../assets/audio/ambience-wild.ogg';
import civic from '../assets/audio/ambience-civic.ogg';
import stone from '../assets/audio/ambience-stone.ogg';
import water from '../assets/audio/ambience-water.ogg';
import highland from '../assets/audio/ambience-highland.ogg';
import fire from '../assets/audio/ambience-fire.ogg';
import wander from '../assets/audio/score-wander.ogg';
import home from '../assets/audio/score-home.ogg';
import court from '../assets/audio/score-court.ogg';
import verdant from '../assets/audio/score-verdant.ogg';
import ruins from '../assets/audio/score-ruins.ogg';
import arid from '../assets/audio/score-arid.ogg';
import depth from '../assets/audio/score-depth.ogg';
import ascent from '../assets/audio/score-ascent.ogg';

export type MapAudioOptions = {
  mapId: string;
  active: boolean;
  bossActive: boolean;
  musicVolume: number;
  sfxVolume: number;
};

const scenes: Record<string, readonly [ambience: string, score: string]> = {
  Home: [wild, home],
  'Village Green': [wild, wander],
  "King's Road": [highland, wander],
  Monastery: [stone, court],
  'Castle Gates': [highland, court],
  'Royal Court': [civic, court],
  'Throne Hall': [stone, court],
  Marsh: [water, depth],
  'Deep Forest': [wild, verdant],
  'Mountain Pass': [highland, ascent],
  'Old Aqueduct': [water, ruins],
  'Birch Grove': [wild, wander],
  'Volcanic Pass': [fire, ascent],
  'Elven Forest': [wild, verdant],
  'City Square': [civic, wander],
  'Fallen City': [highland, ruins],
  'Ancient Ruins': [stone, ruins],
  'Dune Sea': [highland, arid],
  'Wayside Road': [wild, arid],
  'River Bridge': [water, wander],
  Mines: [stone, depth],
  Cave: [water, depth],
  Dungeon: [stone, depth],
};

type Playing = { url: string; source: AudioBufferSourceNode; gain: GainNode };
type Layer = { playing?: Playing | undefined; pending?: { url: string } | undefined };
const buffers = new Map<string, Promise<AudioBuffer>>();
const gestureListeners = new Set<() => void>();
let context: AudioContext | undefined;

// Capture the click/key that enters a battle even before React mounts its view.
function unlock(event: Event) {
  if (!event.isTrusted || document.hidden) return;
  if (!context && window.AudioContext) context = new AudioContext();
  if (context && context.state !== 'running') void context.resume().catch(() => {});
  gestureListeners.forEach((sync) => sync());
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerup', unlock, true);
  document.addEventListener('keydown', unlock, true);
  document.addEventListener('click', unlock, true);
}

function decode(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const existing = buffers.get(url);
  if (existing) return existing;
  const promise = readAudioAsset(url).then((bytes) => ctx.decodeAudioData(bytes)).catch((error: unknown) => {
    buffers.delete(url);
    throw error;
  });
  buffers.set(url, promise);
  return promise;
}

function stop(layer: Layer) {
  layer.pending = undefined;
  const track = layer.playing;
  layer.playing = undefined;
  if (!track) return;
  track.source.stop();
  track.source.disconnect();
  track.gain.disconnect();
}

function setLevel(track: Playing, level: number, ctx: AudioContext) {
  track.gain.gain.setTargetAtTime(level, ctx.currentTime, 0.12);
}

function syncLayer(layer: Layer, url: string, level: number, currentLevel: () => number) {
  const ctx = context;
  if (!level || !ctx) {
    stop(layer);
    return;
  }
  if (layer.playing?.url === url) {
    setLevel(layer.playing, level, ctx);
    return;
  }
  if (layer.pending?.url === url) return;
  stop(layer);
  const pending = { url };
  layer.pending = pending;
  void decode(ctx, url).then((buffer) => {
    if (layer.pending !== pending) return;
    layer.pending = undefined;
    const latest = currentLevel();
    if (!latest || document.hidden) return;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = 0;
    source.connect(gain).connect(ctx.destination);
    const track = { url, source, gain };
    layer.playing = track;
    source.start();
    setLevel(track, latest, ctx);
  }).catch(() => {
    if (layer.pending === pending) layer.pending = undefined;
  });
}

const volume = (value: number) => Math.max(0, Math.min(1, value)) ** 2;

export function useMapAudio(options: MapAudioOptions) {
  const { mapId, active, bossActive, musicVolume, sfxVolume } = options;
  const latest = useRef(options);
  const layers = useRef({ ambience: {} as Layer, music: {} as Layer });
  const syncRef = useRef<() => void>(() => {});

  useEffect(() => {
    const { ambience, music } = layers.current;
    const level = (channel: 'ambience' | 'music') => {
      const opts = latest.current;
      if (!opts.active || document.hidden) return 0;
      return channel === 'music'
        ? (opts.bossActive ? 0 : volume(opts.musicVolume) * 0.65)
        : volume(opts.sfxVolume) * (opts.bossActive ? 0.34 : 0.5);
    };
    const sync = () => {
      const [ambienceUrl, musicUrl] = scenes[latest.current.mapId] ?? [wild, wander];
      syncLayer(ambience, ambienceUrl, level('ambience'), () => level('ambience'));
      syncLayer(music, musicUrl, level('music'), () => level('music'));
    };
    syncRef.current = sync;
    gestureListeners.add(sync);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      document.removeEventListener('visibilitychange', sync);
      gestureListeners.delete(sync);
      syncRef.current = () => {};
      stop(ambience);
      stop(music);
    };
  }, []);

  useEffect(() => {
    latest.current = { mapId, active, bossActive, musicVolume, sfxVolume };
    syncRef.current();
  }, [mapId, active, bossActive, musicVolume, sfxVolume]);
}
