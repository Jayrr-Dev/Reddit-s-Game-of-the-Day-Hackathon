// ===================================================================
// IMAGE ASSET STEM
// Turns an image URL into the file stem that keys its placeholder.
// ===================================================================

// --- URL SHAPES ---
// Dev serves `/src/client/assets/heroes/cerviel-bow.webp`; a build emits
// `/assets/cerviel-bow-AbC1_x-9.webp` (an 8-character content hash).
const BUILD_HASH_SUFFIX = /-[\w-]{8}$/;

/** File name without folders, query string or extension. */
export const fileStemOf = (url: string): string => {
  const path = url.split(/[?#]/)[0] ?? '';
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
};

/**
 * Candidate stems for a URL, most specific first: the stem as written
 * (dev URLs), then the stem with a build hash stripped (built URLs).
 */
export const assetStemCandidates = (url: string): string[] => {
  const stem = fileStemOf(url);
  const unhashed = stem.replace(BUILD_HASH_SUFFIX, '');
  return unhashed === stem || unhashed === '' ? [stem] : [stem, unhashed];
};
