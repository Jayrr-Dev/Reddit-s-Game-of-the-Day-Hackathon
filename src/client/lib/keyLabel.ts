// ===================================================================
// KEY LABEL
// Turns a code key such as "magicFireHit" into a readable "Magic fire
// hit", for admin lists that name things by their catalog key.
// ===================================================================

/** Splits camelCase and kebab-case into words, first letter capitalised. */
export const keyLabel = (key: string): string => {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
