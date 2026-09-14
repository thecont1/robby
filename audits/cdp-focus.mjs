#!/usr/bin/env node
// Focused follow-up: tab/panel wiring, composited contrast, scroll-container overflow.
import http from 'node:http';
const PORT = Number(process.env.CDP_PORT || 9333);
const APP = process.env.APP_URL || 'http://localhost:3002/';
function httpJson(p, m='GET'){return new Promise((res,rej)=>{const r=http.request({host:'127.0.0.1',port:PORT,path:p,method:m},x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>{try{res(JSON.parse(d))}catch(e){rej(e)}})});r.on('error',rej);r.end();});}
class Cdp{constructor(u){this.ws=new WebSocket(u);this.id=0;this.p=new Map();}
 async open(){await new Promise((r,j)=>{this.ws.addEventListener('open',r,{once:true});this.ws.addEventListener('error',j,{once:true});});
  this.ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(!m.id)return;const p=this.p.get(m.id);if(!p)return;this.p.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);});}
 call(method,params={}){const id=++this.id;this.ws.send(JSON.stringify({id,method,params}));return new Promise((res,rej)=>this.p.set(id,{resolve:res,reject:rej}));}
 async eval(e){const r=await this.call('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;}}

const t = await httpJson('/json/new?'+encodeURIComponent(APP),'PUT');
const cdp = new Cdp(t.webSocketDebuggerUrl); await cdp.open();
await cdp.call('Page.enable'); await cdp.call('Runtime.enable');
for(let i=0;;i++){ if(await cdp.eval(`Boolean(document.querySelector('.object-stage'))`))break; if(i===79)throw new Error('no stage'); await new Promise(r=>setTimeout(r,250)); }

console.log(JSON.stringify(await cdp.eval(`(() => {
  // Composite translucent layers down to an opaque base, then measure.
  const parse = s => { const m=(s||'').match(/[\\d.]+/g); if(!m) return null;
    return { r:+m[0], g:+m[1], b:+m[2], a: m[3]!==undefined ? +m[3] : 1 }; };
  const over = (fg,bg) => ({ r: fg.r*fg.a + bg.r*(1-fg.a), g: fg.g*fg.a + bg.g*(1-fg.a), b: fg.b*fg.a + bg.b*(1-fg.a), a:1 });
  const compositeBg = el => {
    const stack=[]; let c=el;
    while(c){ const p=parse(getComputedStyle(c).backgroundColor); if(p&&p.a>0){ stack.push(p); if(p.a===1) break; } c=c.parentElement; }
    if(!stack.length) return {r:255,g:255,b:255,a:1};
    let base = stack[stack.length-1];
    for(let i=stack.length-2;i>=0;i--) base = over(stack[i], base);
    return base;
  };
  const lum = c => { const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};
    return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b); };
  const ratio = (a,b) => { const l1=Math.max(lum(a),lum(b)), l2=Math.min(lum(a),lum(b)); return +((l1+0.05)/(l2+0.05)).toFixed(2); };
  const vis = e => { const r=e.getBoundingClientRect(), s=getComputedStyle(e); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'; };

  const failures=[];
  for(const el of [...document.querySelectorAll('p,span,label,button,a,h1,h2,h3,h4,li,small,summary,strong,em,div,code')].filter(vis)){
    const text=(el.textContent||'').trim();
    if(!text||el.children.length>0) continue;
    const cs=getComputedStyle(el); const size=parseFloat(cs.fontSize);
    const bold=parseInt(cs.fontWeight,10)>=700;
    const large = size>=24 || (size>=18.66 && bold);
    const fgRaw=parse(cs.color); if(!fgRaw) continue;
    const bg=compositeBg(el);
    const fg = fgRaw.a<1 ? over(fgRaw,bg) : fgRaw;
    const r=ratio(fg,bg); const need = large?3:4.5;
    if(r<need) failures.push({ text:text.slice(0,40), cls:(el.className||'').toString().split(' ')[0], size, ratio:r, need,
      fg:'rgb('+[fg.r,fg.g,fg.b].map(Math.round)+')', bg:'rgb('+[bg.r,bg.g,bg.b].map(Math.round)+')' });
  }

  const tabs=[...document.querySelectorAll('[role="tab"]')].map(e=>({
    label:(e.textContent||'').trim().slice(0,30), controls:e.getAttribute('aria-controls'),
    controlsExists: !!document.getElementById(e.getAttribute('aria-controls')||''),
    selected:e.getAttribute('aria-selected'), tabIndex:e.tabIndex, inTablist: !!e.closest('[role="tablist"]') }));

  const scrollers=[...document.querySelectorAll('*')].filter(e=>vis(e)&&e.scrollWidth>e.clientWidth+1).map(e=>({
    cls:(e.className||'').toString().slice(0,40), overflowX:getComputedStyle(e).overflowX,
    scrollW:e.scrollWidth, clientW:e.clientWidth, keyboardFocusable: e.tabIndex>=0 }));

  return { compositedContrastFailures: failures, tabs, tablists: document.querySelectorAll('[role="tablist"]').length,
           panels: [...document.querySelectorAll('[role="tabpanel"]')].map(e=>({id:e.id, labelledBy:e.getAttribute('aria-labelledby'), hidden:e.hidden})),
           scrollers };
})()`, null, 2)));
await cdp.call('Page.close');
