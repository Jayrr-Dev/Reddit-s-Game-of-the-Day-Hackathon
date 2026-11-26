// ===================================================================
// USE SOUND PREVIEW
// Plays one file from the Sounds tab at a time, at the player's music or
// sound-effect volume. A plain audio element is enough here: previews do
// not loop or crossfade like the in-game music layers.
// ===================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { getVolume, type AudioChannel } from '../lib/gameAudio';

// --- TYPES ---
export type SoundPreviewControls = {
  playingUrl: string | undefined;
  /** Starts this file, or stops it when it is already playing. */
  toggle: (url: string, channel: AudioChannel) => void;
};

// --- HOOK ---
/** Owns the single preview voice and stops it when the tab closes. */
export function useSoundPreview(): SoundPreviewControls {
  const voice = useRef<HTMLAudioElement | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | undefined>();

  /** Silences the current preview, if any. */
  const stop = useCallback(() => {
    voice.current?.pause();
    voice.current = null;
    setPlayingUrl(undefined);
  }, []);

  useEffect(() => stop, [stop]);

  /** Swaps the current preview for this file (or stops it on a second tap). */
  const toggle = (url: string, channel: AudioChannel) => {
    const isSame = playingUrl === url;
    stop();
    if (isSame) return;
    const next = new Audio(url);
    next.volume = (getVolume(channel) / 100) ** 2;
    next.onended = () => { if (voice.current === next) stop(); };
    voice.current = next;
    setPlayingUrl(url);
    void next.play().catch(() => { if (voice.current === next) stop(); });
  };

  return { playingUrl, toggle };
}
