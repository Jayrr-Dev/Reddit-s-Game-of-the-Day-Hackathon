// ===================================================================
// USE PROGRESSIVE IMAGE
// Returns the URL to paint right now: the tiny placeholder while the
// full image loads, then the full image. Works for <img>, SVG <image>
// and inline background-image styles alike.
// ===================================================================

import { useEffect, useSyncExternalStore } from 'react';
import { isImageLoaded, loadFullImage, placeholderFor, subscribeToImageLoads } from '../lib/imagePlaceholders';

/** Placeholder URL until the full `src` is decoded, then `src` itself. */
export const useProgressiveImage = (src: string): string => {
  const placeholder = placeholderFor(src);
  const isLoaded = useSyncExternalStore(subscribeToImageLoads, () => isImageLoaded(src));

  // --- START THE FULL LOAD ---
  useEffect(() => {
    if (placeholder) void loadFullImage(src);
  }, [src, placeholder]);

  return isLoaded || !placeholder ? src : placeholder.src;
};
