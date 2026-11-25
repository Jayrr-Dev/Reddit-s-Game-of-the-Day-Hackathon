import { useLayoutEffect, useRef } from 'react';

/** Follow the actual target while cards settle or the battlefield resizes. */
export function TutorialSpotlight({ selector, label }: { selector: string; label: string }) {
  const overlay = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const layer = overlay.current;
    const board = layer?.parentElement;
    if (!layer || !board) return;
    let frame = 0;
    let target: HTMLElement | null = null;
    let last = '';
    const position = () => {
      if (!target?.isConnected) {
        target = board.querySelector<HTMLElement>(selector);
        if (target && board.matches('dialog[open]')) target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      const rect = target?.getBoundingClientRect();
      layer.hidden = !rect?.width;
      if (rect?.width) {
        const bounds = layer.getBoundingClientRect();
        const x = rect.left - bounds.left - 3;
        const y = rect.top - bounds.top - 3;
        const w = rect.width + 6;
        const h = rect.height + 6;
        const key = [x,y,w,h,bounds.width].map(Math.round).join(',');
        if (key !== last) {
          last = key;
          const center = x + w / 2;
          const labelX = Math.min(Math.max(center, 65), bounds.width - 65);
          layer.style.cssText = `--x:${x}px;--y:${y}px;--w:${w}px;--h:${h}px;--label-x:${labelX}px;--tip-x:${center-labelX}px`;
          layer.dataset.side = y >= 62 ? 'above' : 'below';
        }
      }
      frame = requestAnimationFrame(position);
    };
    position();
    return () => cancelAnimationFrame(frame);
  }, [selector]);
  return <div ref={overlay} className="tutorial-spotlight" aria-hidden="true">
    <i /><svg className="tutorial-hand" viewBox="0 0 32 36" focusable="false">
      <path d="M9 18V5a3 3 0 0 1 6 0v10-2a2.5 2.5 0 0 1 5 0v2a2.5 2.5 0 0 1 5 0v2a2.5 2.5 0 0 1 5 0v6c0 4-2 7-4 10H13L3 22c-3-4 1-7 4-4l2 2z" fill="#fff0bb" stroke="#352117" strokeWidth="2" strokeLinejoin="round"/>
    </svg><span>{label}</span>
  </div>;
}
