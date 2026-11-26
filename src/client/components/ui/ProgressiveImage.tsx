// ===================================================================
// PROGRESSIVE IMAGE (ATOMS)
// Drop-in <img> and SVG <image> that paint a tiny placeholder on the
// first render and swap to the full file once it has loaded.
// ===================================================================

import type { ComponentProps } from 'react';
import { useProgressiveImage } from '../../hooks/useProgressiveImage';
import { placeholderFor } from '../../lib/imagePlaceholders';

// --- TYPES ---
type ProgressiveImgProps = Omit<ComponentProps<'img'>, 'src'> & { src: string | undefined };
type ProgressiveSvgImageProps = Omit<ComponentProps<'image'>, 'href'> & { href: string };

/**
 * <img> with a placeholder. Width/height default to the art's real size
 * so the box keeps its shape while the 20 px placeholder is showing
 * (CSS sizes still win, exactly as with a plain <img>).
 */
export const ProgressiveImg = ({ src, width, height, ...rest }: ProgressiveImgProps) => {
  const shownSrc = useProgressiveImage(src ?? '');
  const natural = placeholderFor(src ?? '');
  return (
    <img {...rest} src={src === undefined ? undefined : shownSrc} width={width ?? natural?.width} height={height ?? natural?.height} />
  );
};

/** SVG <image> with a placeholder; its box is always set by x/y/width/height. */
export const ProgressiveSvgImage = ({ href, ...rest }: ProgressiveSvgImageProps) => {
  const shownHref = useProgressiveImage(href);
  return <image {...rest} href={shownHref} />;
};
