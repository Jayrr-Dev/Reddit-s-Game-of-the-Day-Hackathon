// ===================================================================
// PROGRESSIVE IMAGE (ATOMS)
// Drop-in <img> and SVG <image> that paint a tiny placeholder on the
// first render and smoothly reveal the full file once it has loaded.
// ===================================================================

import type { ComponentProps } from 'react';
import { usePlaceholderFade, useProgressiveImage } from '../../hooks/useProgressiveImage';
import { placeholderFor } from '../../lib/imagePlaceholders';

// --- TYPES ---
type ProgressiveImgProps = Omit<ComponentProps<'img'>, 'src'> & { src: string | undefined };
type ProgressiveSvgImageProps = Omit<ComponentProps<'image'>, 'href'> & { href: string };

/**
 * <img> with a placeholder that sharpens from a blur into the full image.
 * Width/height default to the art's real size so the box keeps its shape
 * while the 20 px placeholder is showing (CSS sizes still win).
 */
export const ProgressiveImg = ({ src, width, height, className, ...rest }: ProgressiveImgProps) => {
  const image = useProgressiveImage(src ?? '');
  const natural = placeholderFor(src ?? '');
  return (
    <img
      {...rest}
      src={src === undefined ? undefined : image.src}
      width={width ?? natural?.width}
      height={height ?? natural?.height}
      className={className ? `progressive-image ${className}` : 'progressive-image'}
      data-placeholder={image.isPlaceholder ? '' : undefined}
    />
  );
};

/**
 * SVG <image> with a placeholder. CSS filters on SVG elements are patchy
 * across browsers, so the full image cross-fades in over the placeholder
 * instead, and the placeholder is dropped once the fade ends.
 */
export const ProgressiveSvgImage = ({ href, className, ...rest }: ProgressiveSvgImageProps) => {
  const image = useProgressiveImage(href);
  const { isFading, endFade } = usePlaceholderFade(href, image.isPlaceholder);
  const placeholder = placeholderFor(href);
  const fullImage = (
    <image
      {...rest}
      href={image.src}
      className={isFading ? `progressive-fade-in ${className ?? ''}` : className}
      onAnimationEnd={isFading ? endFade : undefined}
    />
  );
  if (!isFading || !placeholder) return fullImage;
  return (
    <>
      <image {...rest} id={undefined} href={placeholder.src} className={className} aria-hidden="true" />
      {fullImage}
    </>
  );
};
