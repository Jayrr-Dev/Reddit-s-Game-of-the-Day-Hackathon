import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import bodyUrl from '../../../assets/cerviel/phase-two-body.webp';
import armSourceUrl from '../../../assets/cerviel/arm-break-source.webp';
import swordUrl from '../../../assets/cerviel/holy-greatsword.webp';
import sealUrl from '../../../assets/cerviel/phase-two-seal.webp';
import {
  ARM_BREAK_MS, ARRIVAL_TIMES, ATTACK_MS, introSwordPose, paintHolyRings,
  SEAL_RISE_MS, swordPose, SWORD_FIRST_IMPACT_MS, SWORD_STAGGER_MS, TRANSFORMATION_MS,
} from '../../../content/cervielBladePoses';
import type { HeroAction } from '../../../content/heroLooks';
import { playSound } from '../../../lib/gameAudio';

const loadSprite = (src: string): Promise<HTMLImageElement> => {
  const img = new Image();
  img.src = src;
  return img.decode().then(() => img);
};

// Six arm-only masks through the transparent original. The shoulder cuts
// are tucked underneath the cracked shoulders on the next body frame.
const ARMS = [
  [[265,65],[446,62],[461,237],[571,273],[517,337],[435,358],[265,317]],
  [[764,59],[952,61],[956,320],[794,358],[688,337],[643,273],[744,232]],
  [[135,330],[298,348],[399,379],[491,353],[514,443],[427,499],[134,485]],
  [[749,355],[819,379],[929,336],[1107,321],[1122,462],[847,510],[704,446]],
  [[309,461],[512,459],[559,508],[454,596],[402,842],[275,835],[286,659]],
  [[695,471],[850,469],[948,620],[949,850],[818,846],[776,612],[653,515]],
] as const;
const clamp = (n: number) => Math.max(0, Math.min(1, n));

function paintSprite(g: CanvasRenderingContext2D, image: HTMLImageElement,
  x: number, y: number, h: number, a = 0, alpha = 1) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.globalAlpha = alpha;
  const w = h * image.naturalWidth / image.naturalHeight;
  g.drawImage(image, -w / 2, -h / 2, w, h);
  g.restore();
}

function paintFallingArms(g: CanvasRenderingContext2D, art: HTMLImageElement, elapsed: number) {
  const fall = clamp((elapsed - ARM_BREAK_MS) / 570);
  if (fall >= 1) return;
  const size = 348 / art.naturalHeight;
  const left = 384 - art.naturalWidth * size / 2;
  for (const [i, outline] of ARMS.entries()) {
    const side = i % 2 ? 1 : -1;
    g.save();
    g.translate(left + side * fall * (93 + i * 4), 79 + fall ** 2 * (130 + i * 11));
    g.rotate(side * fall * .29);
    g.scale(size, size);
    g.globalAlpha = 1 - fall;
    g.beginPath();
    g.moveTo(outline[0][0], outline[0][1]);
    for (const [x, y] of outline.slice(1)) g.lineTo(x,y);
    g.closePath();
    g.clip();
    g.drawImage(art, 0, 0);
    g.restore();
  }
}

export function CervielSecondPhase({ action, uid }: { action: HeroAction | null; uid: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenRef = useRef<HTMLCanvasElement>(null);
  const startAt = useRef(-Infinity);
  const [intro, setIntro] = useState(true);
  const volleyKey = action?.cervielVolleyKey;
  useEffect(() => {
    if (volleyKey === undefined) return;
    startAt.current = performance.now();
    const timers = ARRIVAL_TIMES.map((_, i) => window.setTimeout(
      () => playSound('cervielBlade', .92 + i * .042, .49),
      SWORD_FIRST_IMPACT_MS + i * SWORD_STAGGER_MS
    ));
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [volleyKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const seed = (Math.random() * 4294967296 + uid * 16777619) >>> 0;
    let frame = 0;
    let cancelled = false;
    let startedAt: number | undefined;
    let settled = false;
    let timings: number[] = [];
    void Promise.all([loadSprite(bodyUrl), loadSprite(swordUrl), loadSprite(sealUrl), loadSprite(armSourceUrl)])
      .then(([body, sword, seal, arms]) => {
        if (cancelled) return;
        const draw = (now: number) => {
          const reduced = motion.matches;
          if (startedAt === undefined) {
            startedAt = now;
            timings = [
              window.setTimeout(() => playSound('cervielCrack', .98, .83), ARM_BREAK_MS),
              window.setTimeout(() => playSound('cervielSeal', 1, .79), SEAL_RISE_MS),
              ...ARRIVAL_TIMES.map((t, i) => window.setTimeout(
                () => playSound('cervielBlade', .87 + i * .058, .63), t
              )),
            ];
          }
          const ms = now - startedAt;
          const activeIntro = ms < TRANSFORMATION_MS;
          if (!activeIntro && !settled) { settled = true; setIntro(false); }
          const input = now - startAt.current;
          const attack = input >= 0 && input <= ATTACK_MS ? input : Infinity;
          const bodyY = 255 + (!activeIntro && !reduced ? 4 * Math.sin(now * .003) : 0);
          const rise = clamp((ms - SEAL_RISE_MS) / 1260);
          const bloom = (1 - Math.cos(Math.PI * rise)) / 2;
          g.clearRect(0, 0, canvas.width, canvas.height);
          if (activeIntro && !reduced) {
            const pivot = { x: 384, y: 239 };
            const scale = .22 + .78 * bloom;
            g.save();
            g.translate(pivot.x, pivot.y);
            g.scale(scale,scale);
            g.translate(-pivot.x,-pivot.y);
            if (rise > 0) {
              paintHolyRings(g, pivot.x, pivot.y, now, attack, false);
              paintSprite(g, seal, pivot.x, pivot.y, 390, now * .00007, .67 * bloom);
            }
            g.restore();
            paintFallingArms(g, arms, ms);
          } else {
            paintHolyRings(g, 384, 239, now, attack, reduced);
            paintSprite(g, seal, 384, 239, 390, reduced ? 0 : now * .00007, .67);
          }
          paintSprite(g, body, 384, bodyY, 367);
          if (!activeIntro || reduced) {
            for (let i = 0; i < 6; i += 1) {
              const p = swordPose(i, now, attack, reduced);
              g.save();
              if (p.flare > 0) { g.shadowColor = '#eed8ff'; g.shadowBlur = 12 * p.flare; }
              paintSprite(g, sword, p.x, p.y, 142, p.a);
              g.restore();
            }
          } else {
            const screen = screenRef.current;
            const glass = screen?.getContext('2d');
            if (screen && glass) {
              const { width: w, height: h } = screen.getBoundingClientRect();
              if (screen.width !== w || screen.height !== h) { screen.width = w; screen.height = h; }
              const box = canvas.getBoundingClientRect();
              const scaleToScreen = Math.min(box.width / 768, box.height / 512);
              if (scaleToScreen > 0) {
                const x = box.left + (box.width - 768 * scaleToScreen) / 2;
                const y = box.top + (box.height - 512 * scaleToScreen) / 2;
                const edges = { left: -x / scaleToScreen, top: -y / scaleToScreen,
                  right: (w - x) / scaleToScreen, bottom: (h - y) / scaleToScreen };
                glass.setTransform(1, 0, 0, 1, 0, 0);
                glass.clearRect(0,0,w,h);
                glass.setTransform(scaleToScreen,0,0,scaleToScreen,x,y);
                for (let i = 0; i < 6; i += 1) {
                  const p = introSwordPose(i, ms, seed, edges);
                  if (p.alpha > 0) paintSprite(glass, sword, p.x, p.y, 142, p.a, p.alpha);
                }
              }
            }
          }
          frame = requestAnimationFrame(draw);
        };
        frame = requestAnimationFrame(draw);
      }).catch(() => {
        if (cancelled) return;
        setIntro(false);
        canvas.style.display = 'none';
        canvas.parentElement?.querySelector('img')?.removeAttribute('hidden');
      });
    return () => { cancelled = true; cancelAnimationFrame(frame); timings.forEach(timer => window.clearTimeout(timer)); };
  }, [uid]);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0" data-cerviel-phase-two="">
      <img hidden src={bodyUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
      <canvas ref={canvasRef} width={768} height={512}
        className="absolute bottom-[-12%] left-1/2 h-[132%] w-[190%] max-w-none -translate-x-1/2 object-contain" />
      {intro && createPortal(<canvas ref={screenRef} aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-40 h-full w-full" data-cerviel-sword-entrance="" />, document.body)}
    </div>
  );
}
