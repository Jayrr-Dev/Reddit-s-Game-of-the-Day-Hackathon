// ===================================================================
// TOOLTIP (ATOM)
// A small label that names what you're pointing at, styled like a
// shadcn tooltip: dark, rounded, thin border, soft shadow, with an
// arrow. It shows after a short hover with a mouse, or on a long press
// with a finger, and hides when the pointer leaves or lifts. Rendered
// in a portal with fixed positioning so the battlefield's clipping
// can't cut it off; it sits above the trigger (below when there's no
// room) and is kept inside the screen.
// ===================================================================

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Glyph } from './Glyph';
import { RichText } from './RichText';
import { lookOfTerm } from '../../content/glossaryLooks';
import type { Look } from '../../content/visuals';
import {
  placeFloating,
  type FloatingPlacement,
} from '../../lib/floatingPlacement';

// --- TYPES ---
export type TooltipContent = {
  title: string;
  /** Glossary markup: a line per bullet, **bold** words (RichText). */
  description?: string;
  /** The title's icon and colour; a glossary word finds its own. */
  look?: Look;
};

type Placement = FloatingPlacement;

// --- CONSTANTS ---
/** Hover delay before showing with a mouse (ms). */
const HOVER_DELAY_MS = 150;
/** How long a finger must rest on the trigger to show it (ms). */
const LONG_PRESS_MS = 400;
/** Most the label may be wide (px); it is placed before it renders. */
const MAX_WIDTH = 200;
/** Below this much room above the trigger, show it underneath. */
const MIN_ROOM_ABOVE = 70;

// --- SUBCOMPONENTS ---
/** The bold title, in its term's colour with its icon when it has one. */
const TooltipTitle = ({
  title,
  look,
}: {
  title: string;
  look: Look | undefined;
}) => (
  <p
    className={`flex items-center gap-1 text-xs font-bold ${look?.toneClass ?? 'text-ink'}`}
  >
    {look && <Glyph name={look.glyph} className="size-3.5 shrink-0" />}
    {title}
  </p>
);

/**
 * The label and its arrow. It spans MAX_WIDTH but centres its content,
 * so a short label stays small and sits over its trigger.
 */
const TooltipLabel = ({
  content,
  placement,
}: {
  content: TooltipContent;
  placement: Placement;
}) => (
  <div
    role="tooltip"
    className={`pointer-events-none fixed z-[100] flex justify-center animate-tooltip-in ${placement.isAbove ? '-translate-y-full' : ''}`}
    style={{ left: placement.left, top: placement.top, width: MAX_WIDTH }}
  >
    <div className="relative rounded-md border border-edge bg-surface-raised px-2.5 py-1.5 text-left shadow-[0_6px_18px_rgb(0_0_0/0.5)]">
      <TooltipTitle
        title={content.title}
        look={content.look ?? lookOfTerm(content.title)}
      />
      {content.description && (
        <div className="mt-0.5 text-[11px] leading-snug text-ink-muted">
          <RichText text={content.description} />
        </div>
      )}
    </div>
    {/* ARROW: a rotated square sharing the label's border */}
    <span
      className={`absolute size-2 rotate-45 border-edge bg-surface-raised ${placement.isAbove ? '-bottom-[3px] border-b border-r' : '-top-[3px] border-l border-t'}`}
      style={{ left: placement.arrowLeft - 4 }}
    />
  </div>
);

// --- COMPONENT ---
/** Wraps `children` so hovering or long-pressing shows `content`. */
export const Tooltip = ({
  content,
  children,
  isInline = false,
}: {
  content: TooltipContent;
  children: ReactNode;
  /**
   * True for a word in running text: the trigger flows as text, so the
   * line never breaks between it and the full stop after it.
   */
  isInline?: boolean;
}) => {
  const [placement, setPlacement] = useState<Placement | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  // True after a long press showed the label, so the finger lifting
  // doesn't also count as a tap on whatever is behind (a hero).
  const wasPressShownRef = useRef(false);

  // NEVER LEAVE A PENDING TIMER BEHIND
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  /** Shows the label after `delayMs`, unless the pointer leaves first. */
  const showAfter = (delayMs: number) => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setPlacement(placeFloating(rect, MAX_WIDTH, MIN_ROOM_ABOVE));
    }, delayMs);
  };

  /** Hides the label (and cancels one that was about to show). */
  const hide = () => {
    window.clearTimeout(timerRef.current);
    setPlacement(null);
  };

  /** A mouse hovers; a finger has to press and hold. */
  const onPointerDown = (event: PointerEvent) => {
    wasPressShownRef.current = false;
    if (event.pointerType === 'mouse') return;
    showAfter(LONG_PRESS_MS);
    window.setTimeout(() => {
      wasPressShownRef.current = true;
    }, LONG_PRESS_MS);
  };
  /** Swallows the tap that ends a long press. */
  const onClickCapture = (event: MouseEvent) => {
    if (!wasPressShownRef.current) return;
    event.stopPropagation();
    wasPressShownRef.current = false;
  };
  /** A mouse hovering with no button held (not one dragging a card). */
  const onPointerEnter = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.buttons === 0)
      showAfter(HOVER_DELAY_MS);
  };

  return (
    <>
      <span
        ref={triggerRef}
        aria-label={
          content.description
            ? `${content.title}: ${content.description}`
            : content.title
        }
        onPointerEnter={onPointerEnter}
        onPointerDown={onPointerDown}
        onPointerLeave={hide}
        onPointerUp={hide}
        onPointerCancel={hide}
        onClickCapture={onClickCapture}
        onContextMenu={(event) => event.preventDefault()}
        className={`pointer-events-auto ${isInline ? 'inline' : 'inline-flex'}`}
      >
        {children}
      </span>
      {placement &&
        createPortal(
          <TooltipLabel content={content} placement={placement} />,
          document.body
        )}
    </>
  );
};
