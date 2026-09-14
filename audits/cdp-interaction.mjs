#!/usr/bin/env node
// Plan 10 §13.6 interaction audit over Chrome DevTools Protocol.
import http from 'node:http';
const PORT = Number(process.env.CDP_PORT || 9333);
const APP = process.env.APP_URL || 'http://localhost:3001/';
const httpJson = (path, method='GET') => new Promise((resolve,reject) => {
  const req=http.request({host:'127.0.0.1',port:PORT,path,method},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{resolve(JSON.parse(d))}catch(e){reject(e)}})});req.on('error',reject);req.end();
});
class Cdp {
  constructor(url){this.ws=new WebSocket(url);this.id=0;this.pending=new Map()}
  async open(){await new Promise((r,j)=>{this.ws.addEventListener('open',r,{once:true});this.ws.addEventListener('error',j,{once:true})});this.ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(!m.id)return;const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result)})}
  call(method,params={}){const id=++this.id;this.ws.send(JSON.stringify({id,method,params}));return new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}))}
  async eval(expression){const r=await this.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
  async key(key, modifiers=0){await this.call('Input.dispatchKeyEvent',{type:'keyDown',key,code:key==='Tab'?'Tab':key,windowsVirtualKeyCode:key==='Tab'?9:key==='Escape'?27:0,modifiers});await this.call('Input.dispatchKeyEvent',{type:'keyUp',key,code:key==='Tab'?'Tab':key,windowsVirtualKeyCode:key==='Tab'?9:key==='Escape'?27:0,modifiers})}
}
const target=await httpJson('/json/new?'+encodeURIComponent(APP),'PUT');
const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.call('Page.enable');await c.call('Runtime.enable');await c.call('Accessibility.enable');
for(let i=0;;i++){if(await c.eval(`!!document.querySelector('.object-stage')`))break;if(i===79)throw new Error('gallery did not render');await new Promise(r=>setTimeout(r,250))}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const active=()=>c.eval(`({tag:document.activeElement?.tagName,cls:document.activeElement?.className||'',label:document.activeElement?.getAttribute('aria-label')||document.activeElement?.textContent?.trim().replace(/\\s+/g,' ').slice(0,80)||'',href:document.activeElement?.getAttribute('href')})`);
const result={};

// Skip link is the first keyboard stop and moves focus to the compiler region.
await c.eval(`document.body.focus()`);await c.key('Tab');result.skipFocused=await active();
await c.key('Enter');await wait(100);result.skipDestination=await active();

// Gallery global arrows must not fire while the author edits source.
result.editorIsolation=await c.eval(`(() => { const ta=document.querySelector('.source-editor textarea'); ta.focus(); ta.setSelectionRange(0,0); const before=document.querySelector('.navigation-current')?.textContent; ta.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})); return {before,after:document.querySelector('.navigation-current')?.textContent,active:document.activeElement===ta}; })()`);

// Provenance tablist uses roving tabindex and ArrowRight focus/state movement.
await c.eval(`document.querySelector('#provenance-tab-provenance').focus()`);await c.key('ArrowRight');await wait(50);result.tabArrow=await c.eval(`({active:document.activeElement?.id,selected:[...document.querySelectorAll('.provenance-tablist [role="tab"]')].filter(e=>e.getAttribute('aria-selected')==='true').map(e=>e.id),panelLabel:document.querySelector('#provenance-panel')?.getAttribute('aria-labelledby')})`);

// Full-bleed dialog: focus enters; wrapping works in both directions; nested Escape closes; opener restores.
await c.eval(`document.querySelector('.artwork-view-control').click()`);await wait(100);result.modalOpen=await c.eval(`({dialog:!!document.querySelector('[role="dialog"][aria-modal="true"]'),active:document.activeElement?.getAttribute('aria-label'),backgroundInert:[...document.querySelector('main').children].filter(e=>!e.classList.contains('artwork-view')).every(e=>e.hasAttribute('inert'))})`);
const modalFocusables=await c.eval(`[...document.querySelectorAll('.artwork-view button:not([disabled]),.artwork-view [href],.artwork-view [tabindex]:not([tabindex="-1"])')].map(e=>e.getAttribute('aria-label')||e.textContent.trim())`);
result.modalFocusables=modalFocusables;
await c.key('Tab');result.modalTabWrap=await active();
await c.key('Tab',8);result.modalShiftTabWrap=await active();
await c.key('Escape');await wait(100);result.modalClosed=await c.eval(`({dialog:!!document.querySelector('[role="dialog"]'),active:document.activeElement?.getAttribute('aria-label'),anyInert:[...document.querySelector('main').children].some(e=>e.hasAttribute('inert'))})`);

// Dark mode: normalize persisted state, then use the product control and compute
// effective contrast with opaque parent backgrounds.
if (await c.eval(`document.documentElement.classList.contains('dark')`)) {
  await c.eval(`document.querySelector('button[aria-label="switch to light mode"]')?.click()`);
  await wait(100);
}
await c.eval(`document.querySelector('button[aria-label="switch to dark mode"]')?.click()`);await wait(100);
result.dark=await c.eval(`(() => {
 const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
 const parse=s=>{const m=(s||'').match(/[\\d.]+/g);return m?{r:+m[0],g:+m[1],b:+m[2],a:m[3]===undefined?1:+m[3]}:null};
 const over=(f,b)=>({r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1});
 const bg=e=>{const s=[];for(let c=e;c;c=c.parentElement){const p=parse(getComputedStyle(c).backgroundColor);if(p&&p.a>0){s.push(p);if(p.a===1)break}}let b=s.pop()||{r:0,g:0,b:0,a:1};while(s.length)b=over(s.pop(),b);return b};
 const lum=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};
 const ratio=(a,b)=>{const x=Math.max(lum(a),lum(b)),y=Math.min(lum(a),lum(b));return +((x+.05)/(y+.05)).toFixed(2)};
 const fails=[];for(const e of [...document.querySelectorAll('p,span,label,button,a,h1,h2,h3,h4,li,small,summary,strong,em,div,code')].filter(vis)){const t=(e.textContent||'').trim();if(!t||e.children.length)continue;const cs=getComputedStyle(e),f=parse(cs.color),b=bg(e);if(!f)continue;const fc=f.a<1?over(f,b):f,size=parseFloat(cs.fontSize),bold=parseInt(cs.fontWeight)>=700,need=size>=24||(size>=18.66&&bold)?3:4.5,r=ratio(fc,b);if(r<need)fails.push({text:t.slice(0,38),ratio:r,need,fg:cs.color,bg:[b.r,b.g,b.b].map(Math.round)})}
 return {htmlClass:document.documentElement.className,failures:fails,bodyBg:getComputedStyle(document.body).backgroundColor};
})()`);

// AX tree must expose the numeric slider with its label/range/value.
const ax=await c.call('Accessibility.getFullAXTree');
result.sliderAX=ax.nodes.filter(n=>n.role?.value==='slider').map(n=>({name:n.name?.value,value:n.value?.value,properties:Object.fromEntries((n.properties||[]).filter(p=>['valuemin','valuemax','valuetext','focusable'].includes(p.name)).map(p=>[p.name,p.value?.value]))}));
console.log(JSON.stringify(result,null,2));await c.call('Page.close');
