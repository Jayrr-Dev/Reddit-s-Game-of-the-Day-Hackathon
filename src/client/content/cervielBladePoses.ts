/* Presentation-only pose helper. The combat engine owns all gameplay timing and damage. */
export const ATTACK_MS = 1610;
export const SWORD_STAGGER_MS = 105;
export const SWORD_FIRST_IMPACT_MS = 470;
const bladeSlots = [
  {x:252,y:142,a:-.66}, {x:516,y:142,a:.66},
  {x:216,y:228,a:-1.11}, {x:552,y:228,a:1.11},
  {x:245,y:337,a:-2.36}, {x:523,y:337,a:2.36},
];
const clamp = (x: number)=>Math.min(1,Math.max(0,x));
const smooth = (x: number)=>{const t=clamp(x);return t*t*(3-2*t)};
const mix = (a: number,b: number,k: number)=>a+(b-a)*k;
function turn(a: number,b: number,k: number){return a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*k}
export function swordPose(i: number, clock: number, attackMs=Infinity, reduced=false) {
  const s=bladeSlots[i]!;
  const side=i%2===0?-1:1;
  const bob=reduced?0:5*Math.sin(clock*.0034+i*.85);
  const b={x:s.x,y:s.y+bob,a:s.a,flare:0};
  const t=attackMs-i*SWORD_STAGGER_MS;
  if(t<0||t>=1078)return b;
  const toward={x:384+side*35,y:414+(i%3)*7};
  const strikeAngle=Math.atan2(toward.x-b.x,b.y-toward.y);
  if(reduced)return {...b,flare:t>=420&&t<500?.6:0};
  const back={x:b.x+side*25,y:b.y-30,a:turn(b.a,strikeAngle,.92)};
  if(t<285){
    const k=smooth(t/285);
    return {x:mix(b.x,back.x,k),y:mix(b.y,back.y,k),a:turn(b.a,back.a,k),flare:.45*k};
  }
  if(t<470){
    const k=clamp((t-285)/185)**2;
    return {x:mix(back.x,toward.x,k),y:mix(back.y,toward.y,k),a:turn(back.a,strikeAngle,k),flare:k};
  }
  const k=smooth((t-470)/608);
  return {x:mix(toward.x,b.x,k),y:mix(toward.y,b.y,k),a:turn(strikeAngle,b.a,k),flare:Math.max(0,1-(t-470)/105)};
}
// Original holy-magic animation. No third-party source or runtime shipped.
const LIGHT_LAYERS = [
  {r:129, speed:.00028, offset:.1, span:.83, delay:0},
  {r:149, speed:-.00018, offset:.64, span:1.09, delay:85},
  {r:181, speed:.00013, offset:1.12, span:.64, delay:170},
];
export function holyRingPose(i: number, clock: number, attackMs=Infinity, reduced=false){
  const ring=LIGHT_LAYERS[i]!;
  const d=attackMs-ring.delay;
  const rise=clamp(d/270);
  const fall=1-clamp((d-270)/330);
  const charge=Number.isFinite(d)?smooth(rise)*fall:0;
  const start=ring.offset+(reduced?0:clock*ring.speed);
  const radius=ring.r+(reduced?0:charge*(9+4*i));
  return {start, radius, span:ring.span+(reduced?0:charge*.17), alpha:.27+charge*.42};
}
export function paintHolyRings(g: CanvasRenderingContext2D,x: number,y: number,clock: number,attackMs: number,reduced: boolean){
  g.save();
  g.translate(x,y);
  g.lineCap='round';
  for(let i=0;i<LIGHT_LAYERS.length;i++){
    const p=holyRingPose(i,clock,attackMs,reduced);
    g.globalAlpha=p.alpha;
    g.strokeStyle=i===1?'#ffe6a4':'#fff4d3';
    g.lineWidth=i===1?1.8:1.3;
    g.shadowColor='#ffd270';
    g.shadowBlur=8;
    g.beginPath();
    for(let sector=0;sector<3;sector++){
      const a=p.start+sector*Math.PI*2/3;
      g.moveTo(p.radius*Math.cos(a),p.radius*Math.sin(a));
      g.arc(0,0,p.radius,a,a+p.span);
    }
    g.stroke();
  }
  g.restore();
}

export const TRANSFORMATION_MS = 2750;
export const ARM_BREAK_MS = 85;
export const SEAL_RISE_MS = 390;
export const ARRIVAL_TIMES = [865, 1100, 1335, 1570, 1805, 2040] as const;
const IN_FLIGHT_MS = 610;

/** Each blade is assigned a different entry angle from a per-intro visual seed. */
export function introSwordPose(
  i: number, ms: number, seed: number, frame: { left: number; top: number; right: number; bottom: number }
) {
  const elapsed = ms - ARRIVAL_TIMES[i]!;
  const goal = swordPose(i, 0);
  if (elapsed < 0) return { ...goal, alpha: 0 };
  if (elapsed >= IN_FLIGHT_MS) return { ...goal, alpha: 1 };
  const offset = (seed >>> 0) / 4294967296;
  const theta = Math.PI * 2 * (offset + i / 6 + Math.sin(seed + i * 73) * .04);
  const dx = Math.cos(theta), dy = Math.sin(theta);
  const width = dx > 0 ? frame.right - goal.x : goal.x - frame.left;
  const height = dy > 0 ? frame.bottom - goal.y : goal.y - frame.top;
  const edge = Math.min(width / Math.max(.001, Math.abs(dx)), height / Math.max(.001, Math.abs(dy))) + 92;
  const x0 = goal.x + dx * edge, y0 = goal.y + dy * edge;
  const travel = 1 - (1 - clamp(elapsed / IN_FLIGHT_MS)) ** 3;
  return {
    x: mix(x0, goal.x, travel), y: mix(y0, goal.y, travel),
    a: turn(Math.atan2(-dx, dy), goal.a, smooth((travel - .3) / .7)),
    alpha: clamp(elapsed / 130), flare: .5 * (1 - travel),
  };
}
