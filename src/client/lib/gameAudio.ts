import drawUrl from '../assets/audio/card-draw.ogg';

import menuUrl from '../assets/audio/menu.ogg';
import levelUpUrl from '../assets/audio/level-up.ogg';
import runeClickUrl from '../assets/audio/rune-click.ogg';
import equipUrl from '../assets/audio/equip.ogg';
import bluntUrl from '../assets/audio/blunt.ogg';
import bladeUrl from '../assets/audio/blade.ogg';
import arrowUrl from '../assets/audio/arrow.ogg';
import swiftArrowUrl from '../assets/audio/arrow-swift.ogg';
import cardClickUrl from '../assets/audio/card-click.ogg';
import arcaneUrl from '../assets/audio/arcane.ogg';
import curseUrl from '../assets/audio/curse.ogg';
import hexTriggerUrl from '../assets/audio/hex-trigger.ogg';
import guardUrl from '../assets/audio/guard.ogg';
import moveUrl from '../assets/audio/move.ogg';
import potionUrl from '../assets/audio/potion.ogg';
import imbueUrl from '../assets/audio/imbue.ogg';
import shuffleUrl from '../assets/audio/shuffle.ogg';
import removeUrl from '../assets/audio/remove.ogg';
import rewardUrl from '../assets/audio/reward.ogg';
import bossUrl from '../assets/audio/boss-march.ogg';
import bladeHitUrl from '../assets/audio/blade-hit.ogg';
import arrowHitUrl from '../assets/audio/arrow-hit.ogg';
import magicFireUrl from '../assets/audio/magic-fire.ogg';
import magicFireHitUrl from '../assets/audio/magic-fire-hit.ogg';
import magicIceUrl from '../assets/audio/magic-ice.ogg';
import magicIceHitUrl from '../assets/audio/magic-ice-hit.ogg';
import magicLightningUrl from '../assets/audio/magic-lightning.ogg';
import magicLightningHitUrl from '../assets/audio/magic-lightning-hit.ogg';
import magicArcaneHitUrl from '../assets/audio/magic-arcane-hit.ogg';
import chargeUrl from '../assets/audio/charge.ogg';
import backstepUrl from '../assets/audio/backstep.ogg';
import type { CardType, MagicElement, MeleeEdge } from '../../shared/game/types';
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
const sounds = { draw: drawUrl, menu: menuUrl, levelUp: levelUpUrl, runeClick: runeClickUrl, equip: equipUrl, blunt: bluntUrl, blade: bladeUrl, arrow: arrowUrl, swiftArrow: swiftArrowUrl, cardClick: cardClickUrl, arcane: arcaneUrl, curse: curseUrl, hexTrigger: hexTriggerUrl, guard: guardUrl, move: moveUrl, potion: potionUrl, imbue: imbueUrl, shuffle: shuffleUrl, remove: removeUrl, reward: rewardUrl, bladeHit: bladeHitUrl, arrowHit: arrowHitUrl, magicFire: magicFireUrl, magicFireHit: magicFireHitUrl, magicIce: magicIceUrl, magicIceHit: magicIceHitUrl, magicLightning: magicLightningUrl, magicLightningHit: magicLightningHitUrl, magicArcaneHit: magicArcaneHitUrl, charge: chargeUrl, backstep: backstepUrl };
type Sound = keyof typeof sounds;
const voices = new Map<HTMLAudioElement, number>();
const preloaded = new Map<Sound, HTMLAudioElement>();
const lastCue = new Map<Sound, number>();
let bossTrack: HTMLAudioElement | undefined;
let bossActive = false;
let unlocked = false;
const subscribers = new Set<() => void>();

export const getVolume = (channel: AudioChannel) => volumes[channel];
export const subscribeVolume = (listener: () => void) => {
  subscribers.add(listener);
  return () => { subscribers.delete(listener); };
};

/** Start the boss score only after a gesture and stop it in hidden tabs. */
function syncMusic() {
  if (!bossActive || !volumes.music || !unlocked || document.hidden) {
    bossTrack?.pause();
    return;
  }
  bossTrack ??= new Audio(bossUrl);
  bossTrack.loop = true;
  bossTrack.volume = (volumes.music / 100) ** 2;
  if (bossTrack.paused) void bossTrack.play().catch(() => {});
}

/** Bind once at app startup, outside React's replayable render lifecycle. */
export function installGameAudio(root: HTMLElement) {
  for (const name of ['blade', 'bladeHit', 'arrow', 'swiftArrow', 'arcane', 'magicFire', 'magicIce', 'magicLightning', 'cardClick', 'shuffle', 'blunt', 'guard', 'charge', 'backstep', 'curse', 'hexTrigger', 'arrowHit', 'magicFireHit', 'magicIceHit', 'magicLightningHit', 'runeClick', 'levelUp', 'equip', 'imbue'] as const) {
    if (preloaded.has(name)) continue;
    const cue = new Audio();
    cue.preload = 'auto';
    cue.src = sounds[name];
    preloaded.set(name, cue);
  }
  const unlock = () => { unlocked = true; if (volumes.music) syncMusic(); };
  root.addEventListener('pointerup', unlock);
  root.addEventListener('keydown', unlock);
  root.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button || button.disabled || button.closest('[inert]')) return;
    if (button.hasAttribute('data-card-size')) {
      playSound('cardClick', 1, 0.56);
      return;
    }
    if (button.matches('[data-move], [data-hero-uid], .table-end, [data-own-sound]')) return;
    if (button.closest('.trait-spiral, .cs-skill-tree, .cs-pages')) {
      playSound('runeClick', 1, .68);
      return;
    }
    playSound('menu', 1, 0.65);
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
  const cached = preloaded.get(name);
  const voice = cached && !voices.has(cached) ? cached : new Audio(sounds[name]);
  if (voice.currentTime > 0) voice.currentTime = 0;
  voices.set(voice, gain);
  voice.volume = (volumes.sfx / 100) ** 2 * gain;
  voice.playbackRate = rate;
  voice.preservesPitch = false;
  voice.onended = () => { voices.delete(voice); };
  void voice.play().catch(() => { voices.delete(voice); });
}

export const playDraw = () => playSound('draw');

/** Play a short contact cue when the animation registers damage. */
export function playCombatImpact(type?: CardType, element?: MagicElement, edge?: MeleeEdge, gain = .76) {
  if (type === 'melee' && edge === 'sharp') return playSound('bladeHit', 1, gain);
  if (type === 'range') return playSound('arrowHit', 1, gain);
  if (type === 'magic') {
    const hit = element === 'fire' ? 'magicFireHit' : element === 'ice' ? 'magicIceHit' : element === 'lightning' ? 'magicLightningHit' : 'magicArcaneHit';
    return playSound(hit, 1, gain);
  }
  if (type === 'curse') return playSound('hexTrigger', 1, gain);
  return playSound('blunt', 1.1, gain);
}

/** Use the card's material and element, with individual accents for signature effects. */
export function playCardSound(id: CardId) {
  const card = getCard(id);
  switch (id) {
    case 'decimate': return playSound('blade', 1, .62);
    case 'siegeBlast': return;
    case 'reap': return playSound('curse', 1.08);
    case 'arrowShot': case 'venomDart': return playSound('swiftArrow');
    case 'killingSpree': return playSound('reward', 1.23);
    case 'healingPotion': case 'rushPotion': case 'swiftTonic': case 'antidote': return playSound('potion');
  }
  switch (card.type) {
    case 'melee': if (card.edge === 'sharp') playSound('blade', 1, .52); return;
    case 'range': return playSound('arrow');
    case 'magic':
      if (card.element === 'healing') return playSound('imbue', 1.16);
      return playSound(card.element === 'fire' ? 'magicFire' : card.element === 'ice' ? 'magicIce' : card.element === 'lightning' ? 'magicLightning' : 'arcane');
    case 'curse': return playSound('curse');
    case 'defend': return playSound('guard');
    case 'imbue': return playSound('imbue');
    case 'movement': return playSound('move');
    case 'buff': return playSound('imbue', .84);
    case 'utility': return playSound('shuffle', 1.22, .7);
  }
}
