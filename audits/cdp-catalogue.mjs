#!/usr/bin/env node
import http from 'node:http';
const PORT=9333, APP='http://localhost:3001/';
const get=(p,m='GET')=>new Promise((res,rej)=>{const q=http.request({host:'127.0.0.1',port:PORT,path:p,method:m},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{res(JSON.parse(d))}catch(e){rej(e)}})});q.on('error',rej);q.end()});
class C{constructor(u){this.w=new WebSocket(u);this.n=0;this.p=new Map()}async open(){await new Promise((r,j)=>{this.w.addEventListener('open',r,{once:true});this.w.addEventListener('error',j,{once:true})});this.w.addEventListener('message',e=>{const m=JSON.parse(e.data),p=this.p.get(m.id);if(!p)return;this.p.delete(m.id);m.error?p[1](m.error):p[0](m.result)})}call(method,params={}){const id=++this.n;this.w.send(JSON.stringify({id,method,params}));return new Promise((...p)=>this.p.set(id,p))}async e(expression){const r=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}}
const t=await get('/json/new?'+encodeURIComponent(APP),'PUT'),c=new C(t.webSocketDebuggerUrl);await c.open();await c.call('Runtime.enable');
const out=await c.e(`(async()=>{const r=await fetch('/api/gallery');const body=await r.json();return {status:r.status,isArray:Array.isArray(body),keys:Object.keys(body),body};})()`);
console.log(JSON.stringify(out,null,2));await c.call('Page.close');
