import drawUrl from '../assets/audio/card-draw.ogg';

import menuUrl from '../assets/audio/menu.ogg';
import bluntUrl from '../assets/audio/blunt.ogg';
import bladeUrl from '../assets/audio/blade.ogg';
import arrowUrl from '../assets/audio/arrow.ogg';
import arcaneUrl from '../assets/audio/arcane.ogg';
import curseUrl from '../assets/audio/curse.ogg';
import guardUrl from '../assets/audio/guard.ogg';
import moveUrl from '../assets/audio/move.ogg';
import potionUrl from '../assets/audio/potion.ogg';
import imbueUrl from '../assets/audio/imbue.ogg';
import shuffleUrl from '../assets/audio/shuffle.ogg';
import removeUrl from '../assets/audio/remove.ogg';
import rewardUrl from '../assets/audio/reward.ogg';
import bossUrl from '../assets/audio/boss-march.ogg';
import { getCard, type CardId } from '../../shared/game/cards';

export type AudioChannel = 'music' | 'sfx';
const defaults = { music: 0, sfx: 50 };
const volumes = { ...defaults };
const storageKey = (channel: AudioChannel) => 'villain-run.volume.' + channel;
for (const channel of ['music', 'sfx'] as const) {
  try {
    const saved = localStorage.getItem(storageKey(channel));
    if (saved !== null && saved.trim() && Number.isFinite(Number(saved)))
      volumes[channel] = Math.max(0, Math.min(100, Number(saved)));
  } catch { /* Session values work without storage. */ }
}
const sounds = { draw: drawUrl, menu: menuUrl, blunt: bluntUrl, blade: bladeUrl, arrow: arrowUrl, arcane: arcaneUrl, curse: curseUrl, guard: guardUrl, move: moveUrl, potion: potionUrl, imbue: imbueUrl, shuffle: shuffleUrl, remove: removeUrl, reward: rewardUrl };
type Sound = keyof typeof sounds;
const voices = new Map<HTMLAudioElement, number>();
const lastCue = new Map<Sound, number>();
let bossTrack: HTMLAudioElement | undefined;
let bossActive = false;
let unlocked = false;
let context: AudioContext | undefined;
let musicGain: GainNode | undefined;
let timer: number | undefined;
let beat = 0;
const subscribers = new Set<() => void>();

export const getVolume = (channel: AudioChannel) => volumes[channel];
export const subscribeVolume = (listener: () => void) => {
  subscribers.add(listener);
  return () => { subscribers.delete(listener); };
};

/** Play one soft lute note from the practice score. */
function playNote() {
  if (!context || !musicGain || context.state !== 'running' || document.hidden) return;
  const phrase = [146.83, 220, 293.66, 0, 174.61, 261.63, 220, 0, 130.81, 196, 261.63, 0, 110, 164.81, 220, 0];
  const frequency = phrase[beat++ % phrase.length];
  if (!frequency) return;
  const now = context.currentTime;
  const voice = context.createOscillator();
  const envelope = context.createGain();
  voice.type = 'triangle';
  voice.frequency.value = frequency;
  envelope.gain.setValueAtTime(0.001, now);
  envelope.gain.exponentialRampToValueAtTime(0.16, now + 0.015);
  envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
  voice.connect(envelope).connect(musicGain);
  voice.onended = () => { voice.disconnect(); envelope.disconnect(); };
  voice.start(now);
  voice.stop(now + 0.86);
}

/** Start the opt-in music from a player gesture and suspend it in background tabs. */
function syncMusic() {
  if (bossTrack && (!bossActive || !volumes.music || document.hidden)) bossTrack.pause();
  if (bossActive || !volumes.music || document.hidden) {
    window.clearInterval(timer);
    timer = undefined;
    if (context?.state === 'running') void context.suspend().catch(() => {});
    if (bossActive && volumes.music && unlocked && !document.hidden) {
      bossTrack ??= new Audio(bossUrl);
      bossTrack.loop = true;
      bossTrack.volume = (volumes.music / 100) ** 2;
      if (bossTrack.paused) void bossTrack.play().catch(() => {});
    }
    return;
  }
  if (!window.AudioContext) return;
  context ??= new AudioContext();
  if (!musicGain) {
    musicGain = context.createGain();
    musicGain.connect(context.destination);
  }
  musicGain.gain.value = (volumes.music / 100) ** 2;
  void context.resume().then(() => {
    if (timer === undefined && volumes.music && !document.hidden) {
      playNote();
      timer = window.setInterval(playNote, 650);
    }
  }).catch(() => {});
}

/** Bind once at app startup, outside React's replayable render lifecycle. */
export function installGameAudio(root: HTMLElement) {
  const unlock = () => { unlocked = true; if (volumes.music) syncMusic(); };
  root.addEventListener('pointerup', unlock);
  root.addEventListener('keydown', unlock);
  root.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button || button.disabled || button.closest('[inert]') || button.matches('[data-hand-slot] button, [data-move], [data-hero-uid], .table-end, [data-own-sound]')) return;
    playSound(button.closest('[role="dialog"]') && button.hasAttribute('data-card-size') ? 'draw' : 'menu', 1, 0.65);
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { for (const sound of voices.keys()) sound.pause(); voices.clear(); }
    if (unlocked) syncMusic();
  });
}

export function setVolume(channel: AudioChannel, value: number) {
  volumes[channel] = Math.max(0, Math.min(100, value));
  try { localStorage.setItem(storageKey(channel), String(volumes[channel])); } catch { /* Session only. */ }
  if (channel === 'music') { unlocked = true; syncMusic(); }
  if (channel === 'sfx') for (const [voice, gain] of voices) voice.volume = (volumes.sfx / 100) ** 2 * gain;
  subscribers.forEach(notify => notify());
}

/** Change score only at the start or end of a boss encounter. */
export function setBossMusic(active: boolean) {
  if (bossActive === active) return;
  bossActive = active;
  if (!active && bossTrack) { bossTrack.pause(); bossTrack.currentTime = 0; }
  if (unlocked) syncMusic();
}

/** Limit overlapping voices and group repeated hits from a single animation frame. */
export function playSound(name: Sound, rate = 1, gain = 1) {
  if (!volumes.sfx || document.hidden) return;
  const now = performance.now();
  if (now - (lastCue.get(name) ?? -Infinity) < 90) return;
  lastCue.set(name, now);
  if (voices.size >= 5) {
    const oldest = voices.keys().next().value;
    if (oldest) { oldest.pause(); voices.delete(oldest); }
  }
  const voice = new Audio(sounds[name]);
  voices.set(voice, gain);
  voice.volume = (volumes.sfx / 100) ** 2 * gain;
  voice.playbackRate = rate;
  voice.preservesPitch = false;
  voice.onended = () => { voices.delete(voice); };
  void voice.play().catch(() => { voices.delete(voice); });
}

export const playDraw = () => playSound('draw');

/** Use the card's material and element, with individual accents for signature effects. */
export function playCardSound(id: CardId) {
  const card = getCard(id);
  switch (id) {
    case 'decimate': return playSound('blade', .63);
    case 'siegeBlast': return playSound('blunt', .66);
    case 'reap': return playSound('curse', .78);
    case 'venomDart': return playSound('arrow', 1.28);
    case 'killingSpree': return playSound('reward', 1.23);
    case 'healingPotion': case 'rushPotion': case 'swiftTonic': case 'antidote': return playSound('potion');
  }
  switch (card.type) {
    case 'melee': return playSound(card.edge === 'sharp' ? 'blade' : 'blunt');
    case 'range': return playSound('arrow');
    case 'magic':
      if (card.element === 'healing') return playSound('imbue', 1.16);
      return playSound('arcane', card.element === 'ice' ? 1.4 : card.element === 'fire' ? .78 : card.element === 'lightning' ? 1.62 : 1);
    case 'curse': return playSound('curse');
    case 'defend': return playSound('guard');
    case 'imbue': return playSound('imbue');
    case 'movement': return playSound('move');
    case 'buff': return playSound('imbue', .84);
    case 'utility': return playSound('shuffle', 1.22, .7);
  }
}
