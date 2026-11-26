import { useEffect, useRef } from 'react';
import { getHero } from '../../../../shared/game/heroes';
import type { HeroUnit } from '../../../../shared/game/types';
import { BOSS_ENTRANCE_MS, BOSS_LANDING_MS, bossEntranceOf } from '../../../content/bossEntrances';
import { bossIntroOf } from '../../../content/bossIntros';

import { playSound } from '../../../lib/gameAudio';

const WHOOSH_LEAD_MS = 900;
const VOICE_AFTER_LANDING_MS = 320;

// --- COMPONENT ---
/** Renders the dim and the title card over the field; a tap calls onSkip. */
export const BossEntrance = ({
  boss,
  onSkip,
}: {
  boss: HeroUnit;
  onSkip: () => void;
}) => {
  const { hasFallSounds } = bossIntroOf(boss.heroId);
  const { epithet, line, voice, durationMs = BOSS_ENTRANCE_MS, landingMs = BOSS_LANDING_MS } = bossEntranceOf(boss.heroId);
  const voiceStartMs = landingMs + VOICE_AFTER_LANDING_MS;
  const introRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!voice) return;
    let stopVoice: (() => void) | undefined;
    const id = window.setTimeout(() => {
      if (introRef.current && !introRef.current.closest('[inert]')) {
        stopVoice = playSound(voice.cue, 1, 1);
      }
    }, voiceStartMs);
    return () => {
      window.clearTimeout(id);
      stopVoice?.();
    };
  }, [boss.uid, voice, voiceStartMs]);
  useEffect(() => {
    if (!hasFallSounds) return;
    const cue = (name: 'bossDescent' | 'bossTouchdown', gain: number) => {
      if (introRef.current && !introRef.current.closest('[inert]')) playSound(name, 1, gain);
    };
    const whoosh = window.setTimeout(() => cue('bossDescent', .78), Math.max(0, landingMs - WHOOSH_LEAD_MS));
    const figure = introRef.current?.closest('.dueling-table')
      ?.querySelector(`[data-hero-uid="${boss.uid}"] .boss-arrive`);
    let landed = false;
    const touchdown = () => {
      if (landed) return;
      landed = true;
      cue('bossTouchdown', .95);
    };
    const onAnimationEnd = (event: Event) => {
      if (event.target === figure) touchdown();
    };
    figure?.addEventListener('animationend', onAnimationEnd);
    // The animation event is the landing. The timer covers a style that
    // suppresses the animation without disabling the introduction.
    const fallback = window.setTimeout(touchdown, landingMs + 180);
    return () => {
      figure?.removeEventListener('animationend', onAnimationEnd);
      window.clearTimeout(whoosh);
      window.clearTimeout(fallback);
    };
  }, [hasFallSounds, boss.uid, landingMs]);
  return (
    <button
      ref={introRef}
      type="button"
      onClick={onSkip}
      aria-label={getHero(boss.heroId).name + '. ' + epithet + '. ' + line + ' Skip introduction.'}
      autoFocus
      style={{ animationDuration: durationMs + 'ms' }}
      className="boss-entrance"
      data-voiced={voice ? true : undefined}
    >
      {voice?.captions ? <>
        {voice.captions.map(caption => (
          <span key={caption.startMs} className="boss-dialogue boss-dialogue-timed" aria-hidden="true" style={{
            animationDelay: (voiceStartMs + caption.startMs) + 'ms',
            animationDuration: (caption.endMs - caption.startMs) + 'ms',
          }}>{caption.text}</span>
        ))}
        <span className="boss-dialogue boss-dialogue-static" aria-hidden="true">{line}</span>
      </> : <span className="boss-dialogue" style={voice ? {
        animationDelay: (voiceStartMs - 140) + 'ms',
        animationDuration: (voice.durationMs + 180) + 'ms',
      } : undefined}>{line}</span>}
      <span className="boss-entrance-card" style={voice ? {
        animationDelay: (voiceStartMs + voice.durationMs + 100) + 'ms',
        animationDuration: '320ms',
      } : undefined}>
        <span className="boss-epithet">{epithet}</span>
        <span className="boss-entrance-name">{getHero(boss.heroId).name}</span>
      </span>
      <span className="boss-skip-hint">Skip intro</span>
    </button>
  );
};
