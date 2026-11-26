// ===================================================================
// GENERATE IMAGE PLACEHOLDERS
// Writes a tiny blurred copy of every raster image under
// src/client/assets into src/client/lib/imagePlaceholders.generated.ts.
// The game shows that copy on first render while the full file loads.
// Run `npm run images:placeholders` after adding or changing art.
// ===================================================================

import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// --- SETTINGS ---
const ASSETS_DIR = 'src/client/assets';
const OUTPUT_FILE = 'src/client/lib/imagePlaceholders.generated.ts';
const RASTER_EXTENSIONS = new Set(['.webp', '.png', '.jpg', '.jpeg']);
/** Longest side of a placeholder; ~20 px keeps each one under ~0.5 KB. */
const PLACEHOLDER_SIZE = 20;
/** WebP wins over PNG when both exist, since the game imports the WebP. */
const EXTENSION_RANK = ['.webp', '.png', '.jpg', '.jpeg'];

/** Every raster file under a folder, recursively. */
const listRasterFiles = async (dir) => {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && RASTER_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort();
};

/** One file per stem, preferring the format the game actually imports. */
const pickOnePerStem = (files) => {
  const byStem = new Map();
  for (const file of files) {
    const stem = path.basename(file, path.extname(file));
    const current = byStem.get(stem);
    const rank = (f) => EXTENSION_RANK.indexOf(path.extname(f).toLowerCase());
    if (!current || rank(file) < rank(current)) byStem.set(stem, file);
  }
  return [...byStem.entries()].sort(([a], [b]) => a.localeCompare(b));
};

/** Tiny WebP data URI plus the original size (used for width/height attributes). */
const makePlaceholder = async (file) => {
  const image = sharp(file);
  const { width, height } = await image.metadata();
  const tiny = await image
    .resize(PLACEHOLDER_SIZE, PLACEHOLDER_SIZE, { fit: 'inside' })
    .webp({ quality: 40, alphaQuality: 40 })
    .toBuffer();
  return { src: `data:image/webp;base64,${tiny.toString('base64')}`, width, height };
};

// --- MAIN ---
const entries = [];
for (const [stem, file] of pickOnePerStem(await listRasterFiles(ASSETS_DIR))) {
  const { src, width, height } = await makePlaceholder(file);
  entries.push(`  '${stem}': { src: '${src}', width: ${width}, height: ${height} },`);
}

const source = `// ===================================================================
// IMAGE PLACEHOLDERS (GENERATED, DO NOT EDIT)
// Made by scripts/generate-image-placeholders.mjs from src/client/assets.
// Keyed by file stem; see src/client/lib/imagePlaceholders.ts.
// ===================================================================

export type ImagePlaceholder = { src: string; width: number; height: number };

export const IMAGE_PLACEHOLDERS: Readonly<Record<string, ImagePlaceholder>> = {
${entries.join('\n')}
};
`;
await writeFile(OUTPUT_FILE, source);
console.log(`Wrote ${entries.length} placeholders to ${OUTPUT_FILE}`);
