#!/usr/bin/env node
// Identify the unlabelled INPUT appearing in tab order.
import http from 'node:http';
const PORT=Number(process.env.CDP_PORT||9333), APP=process.env.APP_URL||'http://localhost:3002/';
const get=(p,m='GET')=>new Promise((res,rej)=>{const q=http.request({host:'127.0.0.1',port:PORT,path:p,method:m},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{res(JSON.parse(d))}catch(e){rej(e)}})});q.on('error',rej);q.end()});
class C{constructor(u){this.w=new WebSocket(u);this.n=0;this.p=new Map()}
 async open(){await new Promise((r,j)=>{this.w.addEventListener('open',r,{once:true});this.w.addEventListener('error',j,{once:true})});this.w.addEventListener('message',e=>{const m=JSON.parse(e.data);if(!m.id)return;const p=this.p.get(m.id);if(!p)return;this.p.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result)})}
 call(method,params={}){const id=++this.n;this.w.send(JSON.stringify({id,method,params}));return new Promise((res,rej)=>this.p.set(id,{resolve:res,reject:rej}))}
 async e(x){const r=await this.call('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}}
const t=await get('/json/new?'+encodeURIComponent(APP),'PUT'),c=new C(t.webSocketDebuggerUrl);
await c.open();await c.call('Runtime.enable');await c.call('Page.enable');
for(let i=0;i<80;i++){if(await c.e(`!!document.querySelector('.object-stage')`))break;await new Promise(r=>setTimeout(r,250))}
console.log(JSON.stringify(await c.e(`(() => {
  const label = el => el.getAttribute('aria-label') || (el.labels&&el.labels[0]&&el.labels[0].textContent.trim()) || (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent.trim()) || el.title || '';
  return [...document.querySelectorAll('input')].map(el => {
    const r = el.getBoundingClientRect();
    return { type: el.type, id: el.id, cls: el.className, name: label(el),
             hasLabelFor: !!(el.id && document.querySelector('label[for="'+el.id+'"]')),
             box: Math.round(r.width)+'x'+Math.round(r.height),
             tabbable: el.tabIndex >= 0 && !el.disabled,
             parent: el.parentElement?.className || '' };
  });
})()`), null, 2));
process.exit(0);
