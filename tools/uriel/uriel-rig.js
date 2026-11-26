
const svg = document.querySelector('svg'), byId=(id)=>document.getElementById(id);
const NS='http://www.w3.org/2000/svg';
const el=(name,attrs={},parent)=>{const o=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))o.setAttribute(k,v);parent?.append(o);return o;};
const TAU=Math.PI*2, PERIOD=9, sin=Math.sin, cos=Math.cos, clamp=(n)=>Math.max(0,Math.min(1,n));
const ease=(a,b,x)=>{const u=clamp((x-a)/(b-a));return u*u*(3-2*u);};
const ribbons=[
 {id:'gold-left-high',colors:['#d99349','#f9cc88'], nodes:[[487,241,15],[451,253,13],[384,276,10],[302,316,10],[281,360,0]], amp:18},
 {id:'ivory-left-high',colors:['#e3b879','#ffe0a6'],nodes:[[499,254,13],[461,293,12],[410,312,10],[343,321,8],[287,370,11],[289,399,5],[311,419,0]],amp:15},
 {id:'gold-right-high',colors:['#d89149','#fac97f'],nodes:[[558,253,15],[589,309,12],[654,335,13],[694,376,13],[689,423,6],[657,460,0]],amp:18},
 {id:'cream-right',colors:['#e3b47c','#ffddab'],nodes:[[547,252,19],[565,314,19],[585,365,25],[594,401,17],[575,434,0]],amp:13},
 {id:'burgundy-right',colors:['#812428','#b43d35'],nodes:[[551,271,19],[576,318,13],[606,370,11],[625,427,16],[598,465,8],[556,487,0]],amp:19},
 {id:'gold-left-low',colors:['#d99754','#f6c783'],nodes:[[505,269,18],[471,315,20],[430,359,17],[383,397,14],[376,427,9],[386,454,0]],amp:13},
 {id:'cream-left',colors:['#e3b780','#ffdb9e'],nodes:[[500,254,16],[465,306,13],[414,352,14],[391,383,10],[380,426,7],[394,451,0]],amp:16},
 {id:'burgundy-left',colors:['#87282b','#bd3e34'],nodes:[[497,267,19],[469,320,16],[427,363,14],[352,389,17],[331,423,16],[342,459,9],[370,497,0]],amp:19},
 {id:'gold-center-left',colors:['#c68743','#f9c788'],nodes:[[506,271,15],[471,349,20],[430,392,18],[417,439,16],[420,475,7],[438,495,0]],amp:13},
 {id:'ivory-center',colors:['#d0a172','#f7cc98'],nodes:[[522,272,18],[491,359,18],[464,413,19],[455,455,13],[453,487,7],[475,514,0]],amp:11},
 {id:'gold-center-right',colors:['#b97d50','#eaba80'],nodes:[[545,271,19],[555,345,14],[550,391,16],[525,440,15],[498,475,0]],amp:12},
 {id:'burgundy-center',colors:['#81232b','#a43736'],nodes:[[529,264,25],[532,325,33],[529,389,28],[516,451,26],[503,512,0]],amp:14},
];
for(const r of ribbons){const g=el('g',{id:r.id},byId('ribbon-rig'));r.base=el('path',{fill:r.colors[0]},g);r.facet=el('path',{fill:r.colors[1]},g);}
function paintRibbon(r,i,t,motion){
 const pts=r.nodes.map(([x,y,w],j)=>{const u=j/(r.nodes.length-1);return [x+u**1.35*(r.amp*sin(TAU*t/2.25-i*.63-u*2.3)+motion*(x<525?-9:9)),y+u**1.6*(5*cos(TAU*t/2.25-i*.58)+motion*-11),w];});
 const edges=pts.map(([x,y,w],j)=>{const a=pts[Math.max(0,j-1)],b=pts[Math.min(j+1,pts.length-1)];const dx=b[0]-a[0],dy=b[1]-a[1],n=Math.hypot(dx,dy)||1;return [[x-dy*w/n/2,y+dx*w/n/2],[x+dy*w/n/2,y-dx*w/n/2],[x-dy*w/n*.08,y+dx*w/n*.08]];});
 const fmt=(p)=>p.map(x=>x.toFixed(2)).join(' ');
 const poly=(a,b)=>'M '+a.map(fmt).join(' L ')+' L '+b.reverse().map(fmt).join(' L ')+' Z';
 r.base.setAttribute('d',poly(edges.map(e=>e[0]),edges.map(e=>e[1])));
 r.facet.setAttribute('d',poly(edges.map(e=>e[0]),edges.map(e=>e[2])));
}
function armPath(a,b,l,r){
 const dx=b[0]-a[0],dy=b[1]-a[1],h=Math.hypot(dx,dy)||1,nx=-dy/h,ny=dx/h;
 return [[a[0]+nx*l,a[1]+ny*l],[b[0]+nx*r,b[1]+ny*r],[b[0]-nx*r,b[1]-ny*r],[a[0]-nx*l,a[1]-ny*l]].map(p=>p.join(',')).join(' ');
}
function upperArm(a,b,side,facet=false){
 const dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy)||1;
 const nx=-dy/d,ny=dx/d;
 const form=facet?[[.13,side*5],[.25,side*11],[.43,side*15],[.65,side*11],[.93,side*5],[.68,0],[.35,-side*2]]:[[0,12],[.26,side===1?17:12],[.52,side===1?17:13],[.80,13],[1,9],[1,-9],[.74,-11],[.40,side===1?-13:-17],[.18,-13],[0,-12]];
 return form.map(([t,w])=>[a[0]+dx*t+nx*w,a[1]+dy*t+ny*w].map(n=>n.toFixed(2)).join(',')).join(' ');
}
function setArm(elbow,wrist,angle,up,t,armLift=up){
 const pulse=sin(TAU*t/1.8-.85);
 const shiftX=8*up;
 const shiftY=2*pulse-18*up;
 const shoulder=[570+shiftX,153+shiftY];
 const guardShift=2*sin(TAU*t/1.8-.85)-2*up;
 const gShoulder=[480,153+guardShift],gElbow=[458,187+guardShift*.45],gWrist=[445,215];
 byId('shield-pauldron').setAttribute('transform','translate(495 '+(125+guardShift)+') rotate('+(-3*pulse+4*up)+') scale(-1 1)');
 byId('guard-connection').setAttribute('d','M 499 139 L '+gShoulder.join(' ')+' L '+gElbow.join(' ')+' L '+gWrist.join(' '));
 const ux=wrist[0]-elbow[0],uy=wrist[1]-elbow[1],len=Math.hypot(ux,uy)||1;
 const overlap=[wrist[0]+4*ux/len,wrist[1]+4*uy/len];
 byId('arm-connection').setAttribute('d','M 551 139 L '+shoulder.join(' ')+' L '+elbow.join(' ')+' L '+overlap.join(' '));
 const pauldronAngle=3*pulse-38*armLift;
 byId('sword-pauldron').setAttribute('transform','translate(546 112) rotate('+pauldronAngle+') translate(9 13)');
 const artLink=(id,srcA,srcB,A,B,mirror=false)=>{
  const sx=srcB[0]-srcA[0],sy=srcB[1]-srcA[1],x=B[0]-A[0],y=B[1]-A[1];
  const length=Math.max(.6,Math.hypot(x,y)/Math.hypot(sx,sy));
  const wide=mirror?-1:1;
  const d=Math.atan2(y,x)*180/Math.PI, ds=Math.atan2(sy,sx)*180/Math.PI;
  byId(id).setAttribute('transform','translate('+A.join(' ')+') rotate('+d+') scale('+length+' '+wide+') rotate('+(-ds)+') translate('+(-srcA[0])+' '+(-srcA[1])+')');
 };
 artLink('sword-upper-trace',[570,151],[591,190],shoulder,elbow);
 artLink('sword-fore-trace',[591,190],[623,229],elbow,wrist);
 artLink('shield-upper-trace',[570,151],[591,190],gShoulder,gElbow,true);
 artLink('shield-fore-trace',[591,190],[623,229],gElbow,gWrist,true);
  byId('grip-group').setAttribute('transform','translate('+wrist.join(' ')+') rotate('+angle+')');
}
function swordPose(t,forced){
 const cut=forced?0:ease(3.58,3.93,t);
 const recover=forced?0:ease(4.22,5.20,t);
 const amount=cut*(1-recover);
 const up=forced==='raise'?1:forced==='idle'?0:ease(1.65,2.88,t)*(1-cut);
 const sweep=Math.sin(Math.PI*cut)*(1-recover);
 const elbow=[598-5*up+21*sweep+9*amount,191-94*up-17*sweep-6*amount];
 const wrist=[632-32*up+66*sweep-32*amount,248-204*up-55*sweep-23*amount];
 return {up,amount,cut,elbow,wrist,angle:46-138*up+82*amount};
}
function trail(t,forced){
 const f=forced?0:ease(3.63,3.76,t)*(1-ease(3.94,4.10,t));
 const outer=[],inner=[];
 for(let i=0;i<10;i++){
  const q=swordPose(Math.max(3.58,t-(9-i)*.017),forced),phase=q.angle*Math.PI/180;
  for(const [arr,len] of [[outer,197],[inner,197-(4+18*Math.sin(i*Math.PI/9))]]){
   arr.push([(q.wrist[0]+len*cos(phase)).toFixed(1),(q.wrist[1]+len*sin(phase)).toFixed(1)].join(' '));
  }
 }
 byId('slash-trail').setAttribute('d','M '+outer.join(' L ')+' L '+inner.reverse().join(' L ')+' Z');
 byId('slash-edge').setAttribute('d','M '+outer.join(' L '));
 byId('slash-trail').setAttribute('opacity',(.43*f).toFixed(3));
 byId('slash-edge').setAttribute('opacity',(.83*f).toFixed(3));
}
const blurSamples=Array.from({length:19},(_,i)=>el('path',{id:'blade-ghost-'+i,fill:i<8?'#d18457':'#ffe6bc',opacity:0},byId('side-blur')));
function sidePose(t){
 // Elbow leads, wrist catches up, then the blade travels high right to low left.
 const elbowLead=ease(1.35,1.98,t);
 const wristLoad=ease(1.71,2.34,t);
 const hit=ease(2.58,2.91,t);
 const rest=1-ease(3.21,4.60,t);
 const armLift=elbowLead*(1-hit)*rest, fired=hit*rest;
 const elbow=[598+(7*elbowLead-36*hit)*rest,191+(-77*elbowLead+77*hit)*rest];
 const wrist=[632+(23*wristLoad-140*hit)*rest,248+(-62*elbowLead-39*wristLoad+97*hit)*rest];
 const angle=46+(-74*wristLoad-174*hit)*rest;
 const reach=1-.54*Math.pow(sin(Math.PI*hit),1.25)*rest;
 return {up:0,armLift,amount:fired,cut:hit,elbow,wrist,angle,reach,lean:(7*elbowLead-17*hit)*rest};
}
function sideBlur(t,show){
 const envelope=show?ease(2.60,2.67,t)*(1-ease(2.87,3.02,t)):0;
 blurSamples.forEach((ghost,i)=>{
   let age=(19-i)*.008,alpha=envelope*(.022+.17*(i/18)**1.8);
   const q=sidePose(Math.max(2.57,t-age)),a=q.angle*Math.PI/180,xx=cos(a),yy=sin(a),x=q.wrist[0],y=q.wrist[1];
   const qpt=(d,p)=>[x+xx*d-yy*p,y+yy*d+xx*p].map(n=>n.toFixed(1)).join(' ');
   ghost.setAttribute('d','M '+qpt(47*q.reach,10)+' L '+qpt(196*q.reach,0)+' L '+qpt(55*q.reach,-9)+' Z');
   ghost.setAttribute('opacity',alpha.toFixed(3));
 });
}

function paint(t,forced){
 t=((t%PERIOD)+PERIOD)%PERIOD;
 const side=!forced; const overhead=forced==='overhead'; const {up,amount,elbow,wrist,angle,reach=1,armLift=up,lean=3*(side?0:swordPose(t,overhead?null:forced).up)-12*(side?0:swordPose(t,overhead?null:forced).amount)}=side?sidePose(t):swordPose(t,overhead?null:forced);
 const motion=Math.max(up,amount);
 const bodyPose='rotate('+lean+ ' 525 238)'; byId('body-lean').setAttribute('transform',bodyPose); byId('halo-anchor').setAttribute('transform',bodyPose);
 const beat=TAU*t/1.8, rise=sin(beat-.62);
 const dx=5*sin(TAU*t/4.5)+(-up*3+16*amount),dy=8*rise-up*8+8*amount;
 const cameraUp=window.battleAtlas?0:overhead?ease(1.65,2.88,t)*(1-ease(4.00,5.20,t)):up; const framing=1-.26*cameraUp; byId('float').setAttribute('transform','translate('+(dx+525*(1-framing)).toFixed(2)+' '+(dy+134*cameraUp).toFixed(2)+') scale('+framing.toFixed(4)+')');
 byId('shadow').setAttribute('rx',(119-5*rise).toFixed(2));byId('shadow').setAttribute('opacity',(0.44-.08*rise).toFixed(2));
 const wf=(pivot,sgn,phase)=>{const wave=sin(beat+phase),bias=1-.095*(1-wave)-.035*motion;return 'translate('+pivot+' 145) rotate('+(((7-3*up)*wave+32*up-8*amount)*sgn).toFixed(2)+') scale('+bias.toFixed(3)+' '+(1+.055*wave).toFixed(3)+') translate('+(-pivot)+' -145)';};
 byId('wing-left').setAttribute('transform',wf(462,1,.06));
 byId('wing-right').setAttribute('transform',wf(586,-1,-.15));
 byId('halo-highlight').setAttribute('transform','rotate('+(360*t/(window.battleAtlas&&forced==='idle'?1.8:9))+')');
 ribbons.forEach((r,i)=>paintRibbon(r,i,t,motion));
 setArm(elbow,wrist,angle,up,t,armLift); byId('blade-depth').setAttribute('transform','scale('+reach+' 1)'); trail(t,overhead?null:'off'); sideBlur(t,side);
 let label=side&&t>=2.58&&t<3.03?'DIAGONAL SWING':side&&t>=1.50&&t<2.58?'ELBOW LIFT':overhead&&t>=3.58&&t<4.11?'OVERHEAD SLASH':up>.4?'SWORD RAISED':amount>.08?'RECOVERY':'HOVER';
 byId('pose-label').textContent=label;
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String((forced||'loop')===b.dataset.mode)));
}
let mode='loop',play=true,offset=0,last=performance.now();
const seek=document.querySelector('#seek'),toggle=document.querySelector('#toggle');
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;if(mode==='loop'||mode==='overhead'){offset=1.28;play=true;toggle.textContent='Pause';}paint(offset, mode==='loop'?null:mode);});
toggle.onclick=()=>{play=!play;toggle.textContent=play?'Pause':'Play';};
seek.oninput=()=>{mode='loop';offset=Number(seek.value);paint(offset);};
window.renderUriel=(t,mode)=>{play=false;paint(t,mode);};
function tick(now){const dt=(now-last)/1000;last=now;if(play){offset=(offset+Math.min(dt,.08))%PERIOD;seek.value=offset;paint(offset,mode==='loop'?null:mode);}requestAnimationFrame(tick);}
paint(0);requestAnimationFrame(tick);
