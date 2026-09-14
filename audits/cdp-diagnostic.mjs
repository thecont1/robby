#!/usr/bin/env node
import http from 'node:http';
const PORT=Number(process.env.CDP_PORT||9333);
// Default to the production bundle on :3002 — dev-server captures are not
// release evidence. Override with APP_URL for ad-hoc dev inspection.
const APP=process.env.APP_URL||'http://localhost:3002/';
const j=(p,m='GET')=>new Promise((res,rej)=>{const q=http.request({host:'127.0.0.1',port:PORT,path:p,method:m},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{res(JSON.parse(d))}catch(e){rej(e)}})});q.on('error',rej);q.end()});
class C{constructor(u){this.w=new WebSocket(u);this.n=0;this.p=new Map()}async open(){await new Promise((r,x)=>{this.w.addEventListener('open',r,{once:true});this.w.addEventListener('error',x,{once:true})});this.w.addEventListener('message',e=>{const m=JSON.parse(e.data),p=this.p.get(m.id);if(!p)return;this.p.delete(m.id);m.error?p[1](m.error):p[0](m.result)})}call(method,params={}){const id=++this.n;this.w.send(JSON.stringify({id,method,params}));return new Promise((...p)=>this.p.set(id,p))}async e(expression){const r=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});return r.result.value}}
const t=await j('/json/new?'+encodeURIComponent(APP),'PUT'),c=new C(t.webSocketDebuggerUrl);await c.open();await c.call('Runtime.enable');
for(let i=0;i<80;i++){if(await c.e(`!!document.querySelector('.object-stage')`))break;await new Promise(r=>setTimeout(r,250))}
const out=await c.e(`(() => {
 const describe=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {outer:e.outerHTML.slice(0,500),class:e.className,fg:s.color,bg:s.backgroundColor,height:s.height,minHeight:s.minHeight,padding:s.padding,rect:[r.width,r.height],parent:e.parentElement?.outerHTML.slice(0,300)}};
 const texts=[...document.querySelectorAll('*')].filter(e=>e.children.length===0&&(e.textContent||'').trim()==='C2PA ABSENT');
 const turn=document.querySelector('.flip-control');
 const status=document.querySelector('.compile-status');
 const nav=document.querySelector('.navigation-current');
 const range=document.querySelector('#palette-k-slider');
 return {c2pa:texts.map(describe),turn:describe(turn),turnSpan:describe(turn.querySelector('span')),turnSmall:describe(turn.querySelector('small')),status:describe(status),nav:describe(nav),range:describe(range),rangeLabel:document.querySelector('label[for="palette-k-slider"]')?.outerHTML,dark:document.documentElement.className};
})()`);
console.log(JSON.stringify(out,null,2));
await c.call('Page.close');
