// ===================================================================
// SOUND LIBRARY
// The training menu's Sounds tab: every music loop on top, then the
// ambience beds, then every sound effect. Tapping a row plays it once
// (music at the music volume, the rest at the sound-effect volume).
// ===================================================================

import type { ReactNode } from 'react';
import { Glyph } from '../../ui/Glyph';
import { AMBIENCE_TRACKS, MUSIC_TRACKS, type AudioTrack } from '../../../lib/mapAudio';
import { SOUND_EFFECTS, type AudioChannel } from '../../../lib/gameAudio';
import { useSoundPreview, type SoundPreviewControls } from '../../../hooks/useSoundPreview';

// --- CONSTANTS ---
/** The tab's sections, in display order (music first, as asked). */
const SECTIONS: readonly { label: string; channel: AudioChannel; tracks: readonly AudioTrack[] }[] = [
  { label: 'Music', channel: 'music', tracks: MUSIC_TRACKS },
  { label: 'Ambience', channel: 'sfx', tracks: AMBIENCE_TRACKS },
  { label: 'Sound effects', channel: 'sfx', tracks: SOUND_EFFECTS },
];

// --- SUBCOMPONENTS ---
/** One playable row; lit while its file is playing. */
const SoundRow = ({ track, channel, preview }: { track: AudioTrack; channel: AudioChannel; preview: SoundPreviewControls }) => {
  const isPlaying = preview.playingUrl === track.url;
  return (
    <button
      type="button"
      className="training-sound"
      data-own-sound
      aria-pressed={isPlaying}
      aria-label={(isPlaying ? 'Stop ' : 'Play ') + track.name}
      onClick={() => preview.toggle(track.url, channel)}
    >
      <Glyph name="speaker" className="size-3.5 shrink-0" />
      <span>{track.name}</span>
    </button>
  );
};

// --- COMPONENT ---
/** Lists every sound by section; renderHeading draws the picker's section heading. */
export const SoundLibrary = ({ renderHeading }: { renderHeading: (label: string) => ReactNode }) => {
  const preview = useSoundPreview();
  return (
    <>
      {SECTIONS.map((section) => (
        <div key={section.label} className="contents">
          {renderHeading(section.label + ' (' + section.tracks.length + ')')}
          {section.tracks.map((track) => (
            <SoundRow key={track.url} track={track} channel={section.channel} preview={preview} />
          ))}
        </div>
      ))}
    </>
  );
};
