// ===================================================================
// IMAGE PLACEHOLDERS
// The one place that knows how full-size images load. Components show
// a tiny generated placeholder first, then swap in the full image once
// the browser has fetched and decoded it.
// ===================================================================

import { assetStemCandidates } from '../../shared/utils/imageAssetStem';
import { IMAGE_PLACEHOLDERS, type ImagePlaceholder } from './imagePlaceholders.generated';

// --- LOADED IMAGE STORE ---
// URLs whose full image is decoded and ready. Module-level, so an image
// loaded once never flashes its placeholder again on later screens.
const loadedUrls = new Set<string>();
const pendingLoads = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

/** Placeholder data for an image URL, if one was generated. */
export const placeholderFor = (url: string): ImagePlaceholder | undefined => {
  if (url.startsWith('data:')) return undefined; // Vite inlined it: already instant.
  for (const stem of assetStemCandidates(url)) {
    const placeholder = IMAGE_PLACEHOLDERS[stem];
    if (placeholder) return placeholder;
  }
  return undefined;
};

/** True once the full image at `url` is ready to paint. */
export const isImageLoaded = (url: string): boolean => loadedUrls.has(url);

/** Subscribe to "some image finished loading" (for useSyncExternalStore). */
export const subscribeToImageLoads = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Mark a URL ready and wake every subscribed component. */
const markLoaded = (url: string): void => {
  loadedUrls.add(url);
  pendingLoads.delete(url);
  listeners.forEach((listener) => listener());
};

/**
 * Fetch and decode the full image once, however many components ask.
 * A failed load still counts as "done" so the real URL is shown, which
 * behaves exactly like a plain <img> would.
 */
export const loadFullImage = (url: string): Promise<void> => {
  if (loadedUrls.has(url)) return Promise.resolve();
  const pending = pendingLoads.get(url);
  if (pending) return pending;
  const image = new Image();
  image.src = url;
  const load = image.decode().then(
    () => markLoaded(url),
    () => markLoaded(url)
  );
  pendingLoads.set(url, load);
  return load;
};
