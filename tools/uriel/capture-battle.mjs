import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.join(root,'Archangel-Uriel-Demo.html'),'utf8');
const src=html.match(/<svg\b[\s\S]*?<\/svg>/)[0];
let ids=new Map();
class Element {
 constructor(tag='g'){this.tag=tag;this.attrs={};this.children=[];this.textContent=undefined;}
 setAttribute(k,v){this.attrs[k]=String(v);}
 append(o){this.children.push(o);}
 str(){return '<'+this.tag+Object.entries(this.attrs).map(([k,v])=>' '+k+'="'+v+'"').join('')+'>'+this.children.map(x=>x.str()).join('')+'</'+this.tag+'>';}
}
const document={querySelector(){return new Element()},getElementById(id){if(!ids.has(id)){if(!src.includes('id="'+id+'"'))throw Error('missing id '+id);ids.set(id,new Element());}return ids.get(id);},createElementNS(ns,name){return new Element(name);},querySelectorAll(){return []}};
const ctx=vm.createContext({document,window:{battleAtlas:process.argv[2]==='battle'},performance:{now:()=>0},requestAnimationFrame:()=>{}});
vm.runInContext(fs.readFileSync(path.join(root,'uriel-rig.js'),'utf8'),ctx);
const svgAt=(t,mode)=>{
 ctx.window.renderUriel(t,mode);
 let out=src.replace('viewBox="0 0 1160 750"','width="1160" height="750" viewBox="0 0 1160 750"');
 for(const [id,e] of ids){
  const re=new RegExp('<([\\w-]+)([^>]*\\bid="'+id+'"(?=[\\s/>])[^>]*)>');
  out=out.replace(re,(all,tag,a)=>{
   const close=a.endsWith('/');if(close)a=a.slice(0,-1);
   for(const [k,v] of Object.entries(e.attrs)){
    const p=new RegExp(' '+k+'="[^"]*"');if(p.test(a))a=a.replace(p,' '+k+'="'+v+'"');else a+=' '+k+'="'+v+'"';
   }
   return '<'+tag+a+(close?'/':'')+'>'+e.children.map(x=>x.str()).join('');
  });
  if(e.textContent!==undefined) out=out.replace(new RegExp('(id="'+id+'"[^>]*>)[^<]*(</)'),'$1'+e.textContent+'$2');
 }
 return out;
};
if(process.argv[2]==='battle'){
 const sequence=(length,clock,mode)=>{for(let i=0;i<length;i++)console.log(JSON.stringify(svgAt(clock(i/(length-1)),mode)));};
 sequence(24,u=>1.8*u,'idle');
 sequence(18,u=>u<.50?1.35+1.23*u/.50:u<.75?2.58+.33*(u-.50)/.25:2.91+1.69*(u-.75)/.25,null);
 sequence(12,u=>1.65+1.23*u,'overhead');
 sequence(18,u=>u<.45?3.58+.35*u/.45:3.93+1.27*(u-.45)/.55,'overhead');
} else if(process.argv[2]==='full'){for(let i=0;i<216;i++)console.log(JSON.stringify(svgAt(i/24)));}
else for(let i of [0,1.78,2.40,2.78,3.04])console.log(JSON.stringify(svgAt(i)));
