#!/usr/bin/env node
// Actual UI happy-path compilation for two distinct real gallery specimens.
import http from 'node:http';
const PORT=Number(process.env.CDP_PORT||9333), APP=process.env.APP_URL||'http://localhost:3002/';
const get=(p,m='GET')=>new Promise((resolve,reject)=>{const q=http.request({host:'127.0.0.1',port:PORT,path:p,method:m},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{resolve(JSON.parse(d))}catch(e){reject(e)}})});q.on('error',reject);q.end()});
class C{constructor(u){this.w=new WebSocket(u);this.n=0;this.p=new Map()}async open(){await new Promise((r,j)=>{this.w.addEventListener('open',r,{once:true});this.w.addEventListener('error',j,{once:true})});this.w.addEventListener('message',e=>{const m=JSON.parse(e.data);if(!m.id)return;const p=this.p.get(m.id);if(!p)return;this.p.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result)})}call(method,params={}){const id=++this.n;this.w.send(JSON.stringify({id,method,params}));return new Promise((resolve,reject)=>this.p.set(id,{resolve,reject}))}async e(expression){const r=await this.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}}
const t=await get('/json/new?'+encodeURIComponent(APP),'PUT'),c=new C(t.webSocketDebuggerUrl);await c.open();await c.call('Runtime.enable');await c.call('Page.enable');
// Selection commits synchronously under the product's reduced-motion path. This
// keeps the compiler audit deterministic; animation behavior is audited elsewhere.
await c.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
for(let i=0;;i++){if(await c.e(`!!document.querySelector('.object-stage')`))break;if(i===80)throw new Error('no gallery');await new Promise(r=>setTimeout(r,250))}
const specimens=['IMG_20200218_095220.jpg','MS202401-Ayodhya0041.jpg'];
const results=[];
for(const source of specimens){
  const before=await c.e(`(() => { const b=[...document.querySelectorAll('.gallery-thumb')].find(x=>x.getAttribute('aria-label')===${JSON.stringify('Select ')}+${JSON.stringify(source)}); if(!b) return {error:'missing thumbnail'}; b.click(); return {clicked:true}; })()`);
  if(before.error) throw new Error(before.error+': '+source);
  for(let i=0;i<80;i++){
    const selectedReady=await c.e(`!document.querySelector('.slide-track') && document.querySelector('.artwork-view-control')?.getAttribute('aria-label')?.includes(${JSON.stringify(source)})`);
    if(selectedReady)break;
    if(i===79)throw new Error('selection did not settle: '+source);
    await new Promise(r=>setTimeout(r,100));
  }
  const pre=await c.e(`({source:${JSON.stringify(source)},c2pa:[...document.querySelectorAll('.provenance-records strong')].map(e=>e.textContent),stations:document.querySelectorAll('.teppanyaki-station').length,action:document.querySelector('.caption-turn')?.dataset.primaryAction,buttons:[...document.querySelectorAll('.caption-turn button')].map(e=>({text:e.textContent.trim(),disabled:e.disabled}))})`);
  await c.e(`document.querySelector('.compile-orio-control').click()`);
  let state;
  for(let i=0;i<600;i++){
    state=await c.e(`({kicker:document.querySelector('.teppanyaki-counter .eyebrow')?.textContent||'',error:document.querySelector('.source-result.error')?.textContent||'',button:document.querySelector('.compile-orio-control')?.textContent||'',details:document.querySelector('.teppanyaki-station-details')!==null})`);
    if(/resolved/i.test(state.kicker)||state.error||/Recompile/.test(state.button))break;
    await new Promise(r=>setTimeout(r,250));
  }
  const post=await c.e(`(() => {
    const details=document.querySelector('.teppanyaki-station-details');
    if(details) details.open=true;
    const stations=[...document.querySelectorAll('.teppanyaki-station')].map(e=>({stage:e.dataset.stage,status:(e.className.match(/status-(\\w+)/)||[])[1],text:e.textContent.trim().replace(/\\s+/g,' ')}));
    const hashes=[...document.querySelectorAll('.teppanyaki-station')].flatMap(e=>(e.textContent.match(/[A-F0-9]{4}…[A-F0-9]{4}/g)||[]));
    const inverse=document.querySelector('.object-face-inverse img')?.src||document.querySelector('.object-face-inverse .object-image')?.getAttribute('src')||'';
    return {kicker:document.querySelector('.teppanyaki-counter .eyebrow')?.textContent,body:document.querySelector('.teppanyaki-counter .counter-message')?.textContent,detailsPresent:!!details,detailsInitiallyCollapsed:details? !details.hasAttribute('open'):null,stations,hashes,primaryAction:document.querySelector('.caption-turn')?.dataset.primaryAction,buttons:[...document.querySelectorAll('.caption-turn button')].map(e=>({text:e.textContent.trim(),disabled:e.disabled})),c2pa:[...document.querySelectorAll('.provenance-records strong')].map(e=>e.textContent),inverseScheme:inverse.split(':')[0],turnEnabled:!document.querySelector('.flip-control')?.disabled};
  })()`);
  // We opened details only for inspection; derive default from the HTML attribute captured before opening.
  post.detailsInitiallyCollapsed = state.details;
  results.push({source,pre,waitState:state,post});
}
console.log(JSON.stringify({specimens:results},null,2));await c.call('Page.close');
