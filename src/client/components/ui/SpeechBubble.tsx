import type { ComponentPropsWithoutRef } from 'react';
import './speechBubble.css';

type SpeechBubbleProps = ComponentPropsWithoutRef<'p'> & { tail?: 'left' | 'right' | 'up-left' | 'up-right' };

/** The game's existing dialogue treatment, shared by the shop and Sin encounters. */
export function SpeechBubble({ className = '', tail = 'left', ...props }: SpeechBubbleProps) {
  return <p {...props} className={`game-speech-bubble ${className}`} data-tail={tail} />;
}
