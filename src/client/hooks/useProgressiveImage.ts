// ===================================================================
// USE PROGRESSIVE IMAGE
// Says what to paint right now: the tiny placeholder while the full
// image loads, then the full image. Works for <img>, SVG <image> and
// inline background-image styles alike. The reveal itself (blur to
// sharp, or a cross-fade) is styled in index.css under PROGRESSIVE
// IMAGES.
// ===================================================================

import { useEffect, useState, useSyncExternalStore } from 'react';
import { isImageLoaded, loadFullImage, placeholderFor, subscribeToImageLoads } from '../lib/imagePlaceholders';

// --- TYPES ---
export type ProgressiveImage = {
  /** URL to paint now. */
  src: string;
  /** True while `src` is still the low-res placeholder. */
  isPlaceholder: boolean;
};

/** Placeholder URL until the full `src` is decoded, then `src` itself. */
export const useProgressiveImage = (src: string): ProgressiveImage => {
  const placeholder = placeholderFor(src);
  const isLoaded = useSyncExternalStore(subscribeToImageLoads, () => isImageLoaded(src));

  // --- START THE FULL LOAD ---
  useEffect(() => {
    if (placeholder) void loadFullImage(src);
  }, [src, placeholder]);

  const isPlaceholder = !isLoaded && placeholder !== undefined;
  return { src: isPlaceholder ? placeholder.src : src, isPlaceholder };
};

/**
 * True for the short cross-fade right after `src` swaps from its
 * placeholder to the full image; call `endFade` when the fade finishes.
 * An image that was already loaded on first render never fades.
 */
export const usePlaceholderFade = (src: string, isPlaceholder: boolean): { isFading: boolean; endFade: () => void } => {
  const [placeholderShownFor, setPlaceholderShownFor] = useState<string | null>(isPlaceholder ? src : null);
  // Derived state, updated during render: remember which src showed a placeholder.
  if (isPlaceholder && placeholderShownFor !== src) setPlaceholderShownFor(src);
  return {
    isFading: !isPlaceholder && placeholderShownFor === src,
    endFade: () => setPlaceholderShownFor(null),
  };
};
