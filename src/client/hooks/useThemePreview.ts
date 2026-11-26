// ===================================================================
// USE THEME PREVIEW
// Lets the training menu play a boss arena's theme on demand. It goes
// through useMapAudio with the same options a boss fight uses, so the
// preview is the exact music the fight plays (no second track map).
// ===================================================================

import { useCallback, useState, useSyncExternalStore } from 'react';
import { useMapAudio } from '../lib/mapAudio';
import { getVolume, subscribeVolume } from '../lib/gameAudio';
import type { BossArena } from '../content/bossArenas';

// --- TYPES ---
/** One previewable theme: a stable key and the arena whose ambience plays. */
export type ThemePreview = { key: string; arena?: BossArena | undefined };

export type ThemePreviewControls = {
  playingKey: string | undefined;
  /** Starts this theme, or stops it when it is already playing. */
  toggle: (preview: ThemePreview) => void;
  /** Starts this theme (stable, so a dialog can start it on open). */
  play: (preview: ThemePreview) => void;
  stop: () => void;
};

// --- HOOK ---
/** Plays one boss theme at a time over the current region map. */
export function useThemePreview(mapId: string): ThemePreviewControls & { isPreviewing: boolean } {
  const [preview, setPreview] = useState<ThemePreview | null>(null);
  const musicVolume = useSyncExternalStore(subscribeVolume, () => getVolume('music'));
  const sfxVolume = useSyncExternalStore(subscribeVolume, () => getVolume('sfx'));
  useMapAudio({
    mapId,
    active: preview !== null,
    bossActive: true,
    bossAmbience: preview?.arena?.ambience,
    musicVolume: musicVolume / 100,
    sfxVolume: sfxVolume / 100,
  });
  // Stable so the menu can stop the preview when it closes.
  const stop = useCallback(() => setPreview(null), []);
  const play = useCallback((next: ThemePreview) => setPreview(next), []);
  return {
    playingKey: preview?.key,
    isPreviewing: preview !== null,
    toggle: (next) => setPreview((current) => (current?.key === next.key ? null : next)),
    play,
    stop,
  };
}
