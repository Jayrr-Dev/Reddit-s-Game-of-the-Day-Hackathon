import cervielCrackUrl from '../assets/audio/cerviel/arm-crack.ogg';
import cervielSealUrl from '../assets/audio/cerviel/seal-rise.ogg';
import cervielBladeUrl from '../assets/audio/cerviel/blade-arrival.ogg';
import tempestSpearUrl from '../assets/audio/tempest-spear.ogg';
import tempestWingsUrl from '../assets/audio/tempest-wings.ogg';
import tempestThunderUrl from '../assets/audio/tempest-thunder.ogg';
import tempestChargeUrl from '../assets/audio/tempest-charge.ogg';
import tempestSkyBreakerUrl from '../assets/audio/tempest-sky-breaker.ogg';
import tempestRoarUrl from '../assets/audio/tempest-roar.ogg';
import griffonDiveWhooshUrl from '../assets/audio/griffon-dive-whoosh-user.ogg';
import playerDeathUrl from '../assets/audio/player-death-user.ogg';
import deathScreenUrl from '../assets/audio/death-screen-user.ogg';
import bossUncVoiceUrl from '../assets/audio/boss-unc-voice.ogg';
import bossRioVoiceUrl from '../assets/audio/boss-rio-voice.ogg';
import griffonDiveUrl from '../assets/audio/griffon-dive-user.ogg';
import griffonTakeoffUrl from '../assets/audio/griffon-takeoff-user.ogg';
import uncUltimateUrl from '../assets/audio/unc-ultimate-user.ogg';
import bossDescentUrl from '../assets/audio/boss-descent-whoosh.ogg';
import bossTouchdownUrl from '../assets/audio/boss-touchdown-user.ogg';
import { deathVoiceCues, deathVoiceOf } from '../../shared/game/deathVoices';
import deathHumanLowA from '../assets/audio/death-human-low-a.ogg';
import deathHumanLowB from '../assets/audio/death-human-low-b.ogg';
import deathHumanMidA from '../assets/audio/death-human-mid-a.ogg';
import deathHumanMidB from '../assets/audio/death-human-mid-b.ogg';
import deathHumanGritA from '../assets/audio/death-human-grit-a.ogg';
import deathHumanGritB from '../assets/audio/death-human-grit-b.ogg';
import deathHumanBreathA from '../assets/audio/death-human-breath-a.ogg';
import deathHumanBreathB from '../assets/audio/death-human-breath-b.ogg';
import deathBossSol from '../assets/audio/death-boss-sol.ogg';
import deathBossRio from '../assets/audio/death-boss-rio.ogg';
import type { HeroId } from '../../shared/game/heroes';
import drawUrl from '../assets/audio/card-draw.ogg';
import discardUrl from '../assets/audio/paper-discard-slide.ogg';

import menuUrl from '../assets/audio/paper-menu-tap.ogg';
import levelUpUrl from '../assets/audio/level-up-user.ogg';
import victoryUrl from '../assets/audio/victory-user.ogg';
import runeClickUrl from '../assets/audio/paper-page-tick.ogg';
import equipUrl from '../assets/audio/equip.ogg';
import unequipUrl from '../assets/audio/unequip.ogg';
import bluntUrl from '../assets/audio/hit-dry-contact.ogg';
import bladeUrl from '../assets/audio/blade.ogg';
import arrowUrl from '../assets/audio/ballista-release.ogg';
import siegeArrowUrl from '../assets/audio/siege-ballista-shot.ogg';
import respecUrl from '../assets/audio/respec-paper.ogg';
import swiftArrowUrl from '../assets/audio/ballista-release.ogg';
import cardClickUrl from '../assets/audio/card-select-soft.ogg';
import hoverTickUrl from '../assets/audio/paper-hover.ogg';
import cardHoverUrl from '../assets/audio/paper-card-hover.ogg';
import arcaneUrl from '../assets/audio/magic-blast-user.ogg';
import curseUrl from '../assets/audio/hex-cast-user.ogg';
import hexTriggerUrl from '../assets/audio/hex-damage-user.ogg';
import blockThudUrl from '../assets/audio/block-thud-user.ogg';
import guardUrl from '../assets/audio/shield-block.ogg';
import moveUrl from '../assets/audio/move.ogg';
import potionUrl from '../assets/audio/potion-gulp.ogg';
import graveUrl from '../assets/audio/imbue.ogg';
import enemyKnockbackUrl from '../assets/audio/enemy-knockback-user.ogg';
import knockbackUrl from '../assets/audio/knockback-scuff.ogg';
import shuffleUrl from '../assets/audio/deck-paper-riffle.ogg';
import removeUrl from '../assets/audio/remove.ogg';
import rewardUrl from '../assets/audio/reward-card-stack.ogg';
import bladeHitUrl from '../assets/audio/blade-hit.ogg';
import shotMissUrl from '../assets/audio/shot-miss-user.ogg';
import poisonUrl from '../assets/audio/poison-user.ogg';
import conquestOpenUrl from '../assets/audio/conquest-open-user.ogg';
import conquestStartUrl from '../assets/audio/conquest-start-user.ogg';
import arrowHitUrl from '../assets/audio/arrow-impact-leather.ogg';
import bleedBiteUrl from '../assets/audio/bleed-mix-user.ogg';
import magicFireUrl from '../assets/audio/spell-fire-whoosh.ogg';
import magicFireHitUrl from '../assets/audio/spell-fire-burst.ogg';
import magicIceUrl from '../assets/audio/spell-ice-flight.ogg';
import magicIceHitUrl from '../assets/audio/spell-ice-burst.ogg';
import magicLightningUrl from '../assets/audio/spell-thunder-crack.ogg';
import shockUrl from '../assets/audio/shock-cast-chain-user.ogg';
import shockBurstUrl from '../assets/audio/shock-burst-large-user.ogg';
import magicLightningHitUrl from '../assets/audio/lightning-strike-user.ogg';
import magicArcaneHitUrl from '../assets/audio/magic-impact-user.ogg';
import rushUrl from '../assets/audio/rush-user.ogg';
import chargeUrl from '../assets/audio/charge-user.ogg';
import backstepUrl from '../assets/audio/backstep.ogg';
import type { CardType, MagicElement, MeleeEdge } from '../../shared/game/types';
import turnEndUrl from '../assets/audio/turn-end.ogg';
import bluntImpactUrl from '../assets/audio/blunt-impact-user.ogg';
import armorUpUrl from '../assets/audio/armor-up.ogg';
import healUrl from '../assets/audio/heal-user.ogg';
import buffMinorUrl from '../assets/audio/buff-minor-user.ogg';
import buffMajorUrl from '../assets/audio/buff-major-user.ogg';
import utilityCueUrl from '../assets/audio/utility-cue.ogg';
import { getCard, type CardId } from '../../shared/game/cards';

export type AudioChannel = 'music' | 'sfx';
const defaults = { music: 25, sfx: 50 };
const volumes = { ...defaults };
const storageKey = (channel: AudioChannel) => 'villain-run.volume.' + channel;
for (const channel of ['music', 'sfx'] as const) {
  try {
    const saved = localStorage.getItem(storageKey(channel));
    if (saved !== null && saved.trim() && Number.isFinite(Number(saved)))
      volumes[channel] = Math.max(0, Math.min(100, Number(saved)));
  } catch { /* Session values work without storage. */ }
}
const sounds = { cervielCrack: cervielCrackUrl, cervielSeal: cervielSealUrl, cervielBlade: cervielBladeUrl, tempestSpear: tempestSpearUrl, tempestWings: tempestWingsUrl, tempestThunder: tempestThunderUrl, tempestCharge: tempestChargeUrl, tempestSkyBreaker: tempestSkyBreakerUrl, tempestRoar: tempestRoarUrl, draw: drawUrl, discard: discardUrl, menu: menuUrl, conquestOpen: conquestOpenUrl, conquestStart: conquestStartUrl, levelUp: levelUpUrl, victory: victoryUrl, runeClick: runeClickUrl, equip: equipUrl, unequip: unequipUrl, blunt: bluntUrl, blade: bladeUrl, arrow: arrowUrl, siegeArrow: siegeArrowUrl, respec: respecUrl, swiftArrow: swiftArrowUrl, cardClick: cardClickUrl, hoverTick: hoverTickUrl, cardHover: cardHoverUrl, turnEnd: turnEndUrl, bluntImpact: bluntImpactUrl, guardSet: guardUrl, armorUp: armorUpUrl, heal: healUrl, buffMinor: buffMinorUrl, buffMajor: buffMajorUrl, utilityCue: utilityCueUrl, arcane: arcaneUrl, curse: curseUrl, hexTrigger: hexTriggerUrl, guard: blockThudUrl, move: moveUrl, potion: potionUrl, imbue: buffMinorUrl, grave: graveUrl, knockback: knockbackUrl, enemyKnockback: enemyKnockbackUrl, shuffle: shuffleUrl, remove: removeUrl, reward: rewardUrl, bladeHit: bladeHitUrl, arrowHit: arrowHitUrl, shotMiss: shotMissUrl, poison: poisonUrl, bleedBite: bleedBiteUrl, magicFire: magicFireUrl, magicFireHit: magicFireHitUrl, magicIce: magicIceUrl, magicIceHit: magicIceHitUrl, magicLightning: magicLightningUrl, magicLightningHit: magicLightningHitUrl, shock: shockUrl, shockBurst: shockBurstUrl, magicArcaneHit: magicArcaneHitUrl, charge: chargeUrl, rush: rushUrl, backstep: backstepUrl, enemyStep: backstepUrl, bossDescent: bossDescentUrl, bossTouchdown: bossTouchdownUrl, bossUncVoice: bossUncVoiceUrl, bossRioVoice: bossRioVoiceUrl, deathScreen: deathScreenUrl, playerDeath: playerDeathUrl, uncUltimate: uncUltimateUrl, griffonTakeoff: griffonTakeoffUrl, griffonDive: griffonDiveUrl, griffonDiveWhoosh: griffonDiveWhooshUrl, deathHumanLowA, deathHumanLowB, deathHumanMidA, deathHumanMidB, deathHumanGritA, deathHumanGritB, deathHumanBreathA, deathHumanBreathB, deathBossSol, deathBossRio };
export type Sound = keyof typeof sounds;
const deathCues = Object.values(deathVoiceCues).flat();
const nextDeathByVoice = new Map<keyof typeof deathVoiceCues, number>();

/** Rotates the takes within a character's voice family. */
export const playUnitDeath = (heroId: HeroId) => {
  const voice = deathVoiceOf(heroId);
  if (!voice) return;
  const cues = deathVoiceCues[voice];
  const index = nextDeathByVoice.get(voice) ?? 0;
  const cue = cues[index % cues.length];
  if (!cue) return;
  nextDeathByVoice.set(voice, index + 1);
  playSound(cue, 1, voice === 'sol' || voice === 'rio' ? .96 : .82);
};
const voices = new Map<HTMLAudioElement, number>();
const preloaded = new Map<Sound, HTMLAudioElement>();
const lastCue = new Map<Sound, number>();
let unlocked = false;
const subscribers = new Set<() => void>();

export const getVolume = (channel: AudioChannel) => volumes[channel];
export const subscribeVolume = (listener: () => void) => {
  subscribers.add(listener);
  return () => { subscribers.delete(listener); };
};

/** Bind once at app startup, outside React's replayable render lifecycle. */
export function installGameAudio(root: HTMLElement) {
  for (const name of ['cervielCrack', 'cervielSeal', 'cervielBlade', 'tempestSpear', 'tempestWings', 'tempestThunder', 'tempestCharge', 'tempestSkyBreaker', 'tempestRoar', 'blade', 'bladeHit', 'arrow', 'swiftArrow', 'siegeArrow', 'respec', 'arcane', 'magicFire', 'magicIce', 'magicLightning', 'cardClick', 'discard', 'shuffle', 'blunt', 'guard', 'charge', 'rush', 'backstep', 'enemyStep', 'bossDescent', 'bossTouchdown', 'bossUncVoice', 'bossRioVoice', 'deathScreen', 'playerDeath', 'uncUltimate', 'griffonTakeoff', 'griffonDive', 'griffonDiveWhoosh', 'curse', 'hexTrigger', 'arrowHit', 'shotMiss', 'poison', 'bleedBite', 'magicFireHit', 'magicIceHit', 'magicLightningHit', 'magicArcaneHit', 'shock', 'shockBurst', 'runeClick', 'victory', 'levelUp', 'equip', 'unequip', 'imbue', 'knockback', 'enemyKnockback', 'potion', 'hoverTick', 'cardHover', 'turnEnd', 'conquestOpen', 'conquestStart', 'bluntImpact', 'guardSet', 'armorUp', 'heal', 'buffMinor', 'buffMajor', 'utilityCue', ...deathCues] as const) {
    if (preloaded.has(name)) continue;
    const cue = new Audio();
    cue.preload = 'auto';
    cue.src = sounds[name];
    preloaded.set(name, cue);
  }
  const unlock = () => { unlocked = true; };
  root.addEventListener('pointerup', unlock);
  root.addEventListener('keydown', unlock);
  root.addEventListener('pointerover', event => {
    if (!unlocked || (event.pointerType !== 'mouse' && event.pointerType !== 'pen') || event.buttons !== 0) return;
    const selector = 'button, a[href], summary, input, select, [role="button"], [role="tab"], [role="menuitem"], [role="option"], [data-hero-uid]';
    const target = event.target instanceof Element ? event.target.closest(selector) : null;
    if (!target || !root.contains(target) || target.closest('[inert], :disabled, [aria-disabled="true"]')) return;
    if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
    const card = target.hasAttribute('data-card-size') || target.hasAttribute('data-card-id');
    playSound(card ? 'cardHover' : 'hoverTick', .96, card ? .29 : .34);
  });
  root.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('button, a[href], summary, [role="button"], [role="tab"], [role="menuitem"], [role="option"], input[type="checkbox"], input[type="radio"], select') : null;
    if (!button || !root.contains(button) || button.closest('[inert], :disabled, [aria-disabled="true"]')) return;
    if (button.hasAttribute('data-card-size')) {
      playSound('cardClick', 1, 0.48);
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
  });
}

export function setVolume(channel: AudioChannel, value: number) {
  volumes[channel] = Math.max(0, Math.min(100, value));
  try { localStorage.setItem(storageKey(channel), String(volumes[channel])); } catch { /* Session only. */ }
  if (channel === 'sfx') for (const [voice, gain] of voices) voice.volume = (volumes.sfx / 100) ** 2 * gain;
  subscribers.forEach(notify => notify());
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
  return () => {
    voice.pause();
    voices.delete(voice);
  };
}

export const playDraw = () => playSound('draw');

/** Play a short contact cue when the animation registers damage. */
export function playCombatImpact(type?: CardType, element?: MagicElement, edge?: MeleeEdge, gain = .76, heavy = false, light = false) {
  if (type === 'melee' && edge === 'sharp') return playSound('bladeHit', heavy ? .92 : 1, gain);
  if (type === 'melee') return playSound('bluntImpact', heavy ? .84 : light ? 1.31 : 1.03, gain);
  if (type === 'range') return playSound('arrowHit', 1, gain);
  if (type === 'magic') {
    const hit = element === 'fire' ? 'magicFireHit' : element === 'ice' ? 'magicIceHit' : element === 'lightning' ? 'magicLightningHit' : 'magicArcaneHit';
    return playSound(hit, 1, hit === "magicArcaneHit" ? gain * .72 : gain);
  }
  if (type === 'curse') return playSound('hexTrigger', 1, gain);
  return playSound('blunt', 1, gain);
}

type BurstEvent = { kind: string; tick?: 'hex' | 'poison' | 'burn' | undefined };

export function playAfflictionBurst({ kind, tick }: BurstEvent) {
  if (kind === 'shockBurst') return playSound('shockBurst', 1, .8);
  if (kind === 'bleedBite') return playSound('bleedBite', 1, .58);
  if (tick === 'hex') return playSound('hexTrigger', 1, .69);
  if (tick === 'burn') return playSound('magicFireHit', .98, .49);
  if (kind === 'miss') return playSound('shotMiss', 1, .8);
  if (tick === 'poison') return playSound('poison', 1, .55);
  if (kind === 'poison') return playSound('poison', 1, .73);
}

/** Shock cards share a single action cue, regardless of how they deliver it. */
export function usesShockCue(card: ReturnType<typeof getCard>) {
  return card.effects.some(effect =>
    effect.kind === 'shock' || (effect.kind === 'amplify' && effect.status === 'shock')
  );
}

/** Use the card's material and element, with individual accents for signature effects. */
export function playCardSound(id: CardId) {
  const card = getCard(id);
  if (usesShockCue(card)) return playSound('shock', 1, .74);
  // Armor plays on the actual status gain in CombatView, not on card selection.
  if (card.effects.some(effect => effect.kind === 'armor')) return;
  switch (id) {
    case 'reap': return; // Hex damage gets its cue at contact.
    case 'arrowShot': case 'venomDart': return playSound('swiftArrow', 1.12, .85);
    case 'killingSpree': return playSound('utilityCue', .91, .9);
    case 'healingPotion': case 'rushPotion': case 'swiftTonic': case 'antidote': return playSound('potion');
  }
  switch (card.type) {
    case 'melee': return card.edge === 'sharp'
      ? playSound('blade', card.effects.some(effect => effect.kind === 'damage' && effect.amount >= 12)
          ? .93 : card.cost <= 1 ? 1.16 : 1.06, .7)
      : undefined; // Blunt plays the supplied recording once, on contact.
    case 'range': return playSound('arrow');
    case 'magic':
      if (card.element === 'healing') return; // Sound follows restored HP.
      return playSound(card.element === 'fire' ? 'magicFire' : card.element === 'ice' ? 'magicIce' : card.element === 'lightning' ? 'magicLightning' : 'arcane');
    case 'curse': return playSound('curse', 1, .83);
    case 'defend':
      // The Guard gain itself is sounded in CombatView.
      if (card.effects.some(effect => effect.kind === 'guard')) return;
      return playSound('guardSet', 1, .8);
    case 'imbue': return playSound('imbue');
    case 'movement':
      if (card.effects.every(effect => effect.kind === 'rush')) return;
      return playSound('move');
    case 'buff': {
      const statGains = card.effects.filter(effect => effect.kind === 'buff' || effect.kind === 'wrath');
      const major = card.cost >= 2 || card.rarity === 'rare' || card.rarity === 'legendary' || statGains.length > 1;
      return playSound(major ? 'buffMajor' : 'buffMinor', 1, major ? .85 : .74);
    }
    case 'utility':
      if (card.effects.some(effect => effect.kind === 'heal')) return;
      if (card.effects.some(effect => effect.kind === 'draw')) return playSound('draw', 1.1, .75);
      return playSound('utilityCue');
  }
}
