import { useEffect, useRef } from 'react';
import { readAudioAsset } from './apiClient';
import type { MAP_NAMES } from '../components/game/combat/Backdrop';
import type { BossArenaAmbience } from '../content/bossArenas';

import wild from '../assets/audio/ambience-wild.ogg';
import civic from '../assets/audio/ambience-civic.ogg';
import stone from '../assets/audio/ambience-stone.ogg';
import shopHearth from '../assets/audio/ambience-metatron-shop.ogg';
import water from '../assets/audio/ambience-water.ogg';
import highland from '../assets/audio/ambience-highland.ogg';
import fire from '../assets/audio/ambience-fire.ogg';
import wander from '../assets/audio/score-wander.ogg';
import home from '../assets/audio/score-home.ogg';
import gatewayOfSouls from '../assets/audio/score-gateway-of-souls.ogg';
import undertow from '../assets/audio/score-undertow.ogg';
import battleOrchestral from '../assets/audio/score-battle-orchestral.ogg';
import boss from '../assets/audio/boss-army-of-minotaur.ogg';
import villageGreenScore from '../assets/audio/score-map-village-green.ogg';
import kingsRoadScore from '../assets/audio/score-map-kings-road.ogg';
import monasteryScore from '../assets/audio/score-map-monastery.ogg';
import castleGatesScore from '../assets/audio/score-map-castle-gates.ogg';
import royalCourtScore from '../assets/audio/score-map-royal-court.ogg';
import throneHallScore from '../assets/audio/score-map-throne-hall.ogg';
import marshScore from '../assets/audio/score-map-marsh.ogg';
import deepForestScore from '../assets/audio/score-map-deep-forest.ogg';
import mountainPassScore from '../assets/audio/score-map-mountain-pass.ogg';
import oldAqueductScore from '../assets/audio/score-map-old-aqueduct.ogg';
import birchGroveScore from '../assets/audio/score-map-birch-grove.ogg';
import volcanicPassScore from '../assets/audio/score-map-volcanic-pass.ogg';
import elvenForestScore from '../assets/audio/score-map-elven-forest.ogg';
import citySquareScore from '../assets/audio/score-map-city-square.ogg';
import ancientRuinsScore from '../assets/audio/score-map-ancient-ruins.ogg';
import duneSeaScore from '../assets/audio/score-map-dune-sea.ogg';
import waysideRoadScore from '../assets/audio/score-map-wayside-road.ogg';
import riverBridgeScore from '../assets/audio/score-map-river-bridge.ogg';
import minesScore from '../assets/audio/score-map-mines.ogg';
import caveScore from '../assets/audio/score-map-cave.ogg';
import dungeonScore from '../assets/audio/score-map-dungeon.ogg';

export type MapAudioOptions = {
  mapId: string;
  active: boolean;
  bossActive: boolean;
  bossAmbience?: BossArenaAmbience | undefined;
  alternateBattle?: boolean;
  musicVolume: number;
  sfxVolume: number;
};

const bossAmbiences: Record<BossArenaAmbience, string> = { stone, highland, civic };

const scenes: Record<string, readonly [ambience: string, score: string]> = {
  Home: [wild, home],
  'Gateway of Souls': [shopHearth, gatewayOfSouls],
  'Village Green': [wild, villageGreenScore],
  "King’s Road": [highland, kingsRoadScore],
  Monastery: [stone, monasteryScore],
  'Castle Gates': [highland, castleGatesScore],
  'Royal Court': [civic, royalCourtScore],
  'Throne Hall': [stone, throneHallScore],
  Marsh: [water, marshScore],
  'Deep Forest': [wild, deepForestScore],
  'Mountain Pass': [highland, mountainPassScore],
  'Old Aqueduct': [water, oldAqueductScore],
  'Birch Grove': [wild, birchGroveScore],
  'Volcanic Pass': [fire, volcanicPassScore],
  'Elven Forest': [wild, elvenForestScore],
  'City Square': [civic, citySquareScore],
  'Fallen City': [highland, undertow],
  'Ancient Ruins': [stone, ancientRuinsScore],
  'Dune Sea': [highland, duneSeaScore],
  'Wayside Road': [wild, waysideRoadScore],
  'River Bridge': [water, riverBridgeScore],
  Mines: [stone, minesScore],
  Cave: [water, caveScore],
  Dungeon: [stone, dungeonScore],
} satisfies Record<(typeof MAP_NAMES)[number] | "Home" | "Gateway of Souls", readonly [ambience: string, score: string]>;

// --- SOUND LIBRARY: MUSIC AND AMBIENCE ---
/** One named loop the Sounds tab can preview. */
export type AudioTrack = { name: string; url: string };

/** Every music loop the game plays, scene themes first, battle and boss last. */
export const MUSIC_TRACKS: readonly AudioTrack[] = [
  ...Object.entries(scenes).map(([name, [, url]]) => ({ name, url })),
  { name: 'Wandering', url: wander },
  { name: 'Battle (orchestral)', url: battleOrchestral },
  { name: 'Boss: Army of Minotaur', url: boss },
];

/** Every ambience bed, one row per sound file. */
export const AMBIENCE_TRACKS: readonly AudioTrack[] = Object.entries({ wild, civic, stone, water, highland, fire, 'shop hearth': shopHearth })
  .map(([name, url]) => ({ name: name[0]?.toUpperCase() + name.slice(1), url }));

type Playing = { url: string; source: AudioBufferSourceNode; gain: GainNode; targetLevel: number };
type Layer = { fading: Set<Playing>; playing?: Playing | undefined; pending?: { url: string } | undefined };
// Decoded music is much larger than its .ogg. Keep only recent scenes in memory.
const MAX_CACHED_AUDIO_BUFFERS = 8;
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
  if (existing) {
    buffers.delete(url);
    buffers.set(url, existing);
    return existing;
  }
  const promise = readAudioAsset(url).then((bytes) => ctx.decodeAudioData(bytes)).catch((error: unknown) => {
    if (buffers.get(url) === promise) buffers.delete(url);
    throw error;
  });
  buffers.set(url, promise);
  if (buffers.size > MAX_CACHED_AUDIO_BUFFERS) {
    const oldest = buffers.keys().next().value;
    if (oldest !== undefined) buffers.delete(oldest);
  }
  return promise;
}

const CROSSFADE_SECONDS = 0.9;

function dispose(track: Playing) {
  track.source.disconnect();
  track.gain.disconnect();
}

function stop(layer: Layer) {
  layer.pending = undefined;
  if (layer.playing) {
    layer.playing.source.stop();
    dispose(layer.playing);
    layer.playing = undefined;
  }
  for (const track of layer.fading) {
    track.source.stop();
    dispose(track);
  }
  layer.fading.clear();
}

function setLevel(track: Playing, level: number, ctx: AudioContext, fade = 0.09) {
  if (track.targetLevel === level) return;
  track.targetLevel = level;
  const gain = track.gain.gain;
  gain.setTargetAtTime(level, ctx.currentTime, fade);
}

function syncLayer(layer: Layer, url: string, level: number, currentLevel: () => number) {
  const ctx = context;
  if (!level || !ctx) {
    stop(layer);
    return;
  }
  if (layer.playing?.url === url) {
    layer.pending = undefined;
    setLevel(layer.playing, level, ctx);
    return;
  }
  if (layer.pending?.url === url) return;
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
    const track = { url, source, gain, targetLevel: 0 };
    source.start();
    const previous = layer.playing;
    layer.playing = track;
    if (previous) {
      // Keep the old loop playing until the replacement has decoded.
      const fade = CROSSFADE_SECONDS / 4;
      layer.fading.add(previous);
      previous.source.onended = () => {
        layer.fading.delete(previous);
        dispose(previous);
      };
      setLevel(previous, 0, ctx, fade);
      previous.source.stop(ctx.currentTime + CROSSFADE_SECONDS + 0.25);
      setLevel(track, latest, ctx, fade);
    } else {
      setLevel(track, latest, ctx);
    }
  }).catch(() => {
    if (layer.pending === pending) layer.pending = undefined;
  });
}

const volume = (value: number) => Math.max(0, Math.min(1, value)) ** 2;

export function useMapAudio(options: MapAudioOptions) {
  const { mapId, active, bossActive, bossAmbience, alternateBattle = false, musicVolume, sfxVolume } = options;
  const latest = useRef(options);
  const layers = useRef<{ ambience: Layer; music: Layer }>({ ambience: { fading: new Set() }, music: { fading: new Set() } });
  const syncRef = useRef<() => void>(() => {});

  useEffect(() => {
    const { ambience, music } = layers.current;
    const level = (channel: 'ambience' | 'music') => {
      const opts = latest.current;
      if (!opts.active || document.hidden) return 0;
      return channel === 'music'
        ? volume(opts.musicVolume) * (opts.bossActive ? 1 : 0.65)
        : volume(opts.sfxVolume) * (opts.bossActive ? 0.34 : 0.5);
    };
    const sync = () => {
      const opts = latest.current;
      const [mapAmbience, mapScore] = scenes[opts.mapId] ?? [wild, wander];
      const ambienceUrl = opts.bossAmbience ? bossAmbiences[opts.bossAmbience] : mapAmbience;
      syncLayer(ambience, ambienceUrl, level('ambience'), () => level('ambience'));
      // Every boss shares the original boss theme (Army of Minotaur).
      const score = opts.bossActive ? boss : opts.alternateBattle ? battleOrchestral : mapScore;
      syncLayer(music, score, level('music'), () => level('music'));
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
    latest.current = { mapId, active, bossActive, bossAmbience, alternateBattle, musicVolume, sfxVolume };
    syncRef.current();
  }, [mapId, active, bossActive, bossAmbience, alternateBattle, musicVolume, sfxVolume]);
}
