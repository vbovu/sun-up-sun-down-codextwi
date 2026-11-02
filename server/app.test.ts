import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createLocalApp} from './app.ts';
import {AudienceDirector} from './audience.ts';
import {acceptLiveCommand} from './liveCommand.ts';
async function fixture(config:any={}) {
 const {app,close}=createLocalApp(config);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const address=server.address() as any,base=`http://127.0.0.1:${address.port}`;
 const r=await fetch(base+'/api/session');const cookie=r.headers.get('set-cookie')!.split(';')[0];const session=await r.json();
 const post=(path:string,body:any={},extra:any={})=>fetch(base+path,{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json','X-CSRF-Token':session.csrf,...extra},body:JSON.stringify(body)});
 return {base,post,session,cookie,cookieHeader:r.headers.get('set-cookie')!,close:async()=>{close();await new Promise<void>(r=>server.close(()=>r()));}};
}
test('offline session, explicit demo vote and no browser secrets',async()=>{
 const f=await fixture({clientId:'app',clientSecret:'secret-for-test'});try {
  assert.equal(f.session.audience.source,'OFFLINE');assert.ok(f.session.csrf);assert.ok(!JSON.stringify(f.session).includes('secret-for-test'));
  assert.equal((await f.post('/api/control',{action:'source',source:'DEMO'})).status,200);
  await f.post('/api/control',{action:'open'});await f.post('/api/control',{action:'demo-vote',value:'torch',viewer:'test'});
  const state=await (await fetch(f.base+'/api/state',{headers:{Cookie:f.cookie}})).json();assert.equal(state.audience.window.tally.torch,1);
  assert.equal((await f.post('/api/control',{action:'source',source:'LIVE'})).status,400);
 }finally{await f.close();}
});
test('cross-origin, missing csrf, DNS rebinding and uninitialized streams rejected',async()=>{
 const f=await fixture();try {
  assert.equal((await f.post('/api/control',{action:'open'},{Origin:'https://evil.example'})).status,403);
  assert.equal((await f.post('/api/control',{action:'open'},{'X-CSRF-Token':''})).status,403);
  const rebound=await new Promise<number>(resolve=>{http.get(f.base+'/api/session',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode!);});});
  assert.equal(rebound,403);
  assert.equal((await fetch(f.base+'/api/events')).status,401);
 }finally{await f.close();}
});
test('OAuth setup unavailable without credentials; callback state is mandatory',async()=>{
 const f=await fixture();try {
  assert.equal((await f.post('/api/oauth/start')).status,503);
  assert.equal((await fetch(f.base+'/auth/twitch/callback?code=bogus&state=wrong',{headers:{Cookie:f.cookie}})).status,400);
 }finally{await f.close();}
});
test('OAuth start uses read-only scope, fixed localhost redirect and per-session state',async()=>{
 const f=await fixture({clientId:'registered-app',clientSecret:'private',redirectUri:'http://localhost:3000/auth/twitch/callback'});try {
  const data=await (await f.post('/api/oauth/start')).json(),url=new URL(data.url);
  assert.match(f.cookieHeader,/SameSite=Lax/i,'OAuth cross-site top-level GET must retain the session cookie');
  assert.equal(url.origin,'https://id.twitch.tv');assert.equal(url.searchParams.get('response_type'),'code');
  assert.equal(url.searchParams.get('scope'),'user:read:chat');assert.equal(url.searchParams.get('redirect_uri'),'http://localhost:3000/auth/twitch/callback');
  assert.ok(url.searchParams.get('state')!.length>=32);assert.ok(!data.url.includes('private'));
 }finally{await f.close();}
});
test('delayed unseen Twitch message from an earlier window never enters current vote',()=>{
 const d=new AudienceDirector(()=>1000);d.setSource('LIVE');d.open();
 const e={eventId:'old',broadcasterId:'123',viewerIdHash:'hashed',value:'torch' as const,occurredAt:9000};
 assert.equal(acceptLiveCommand(d,e,10000,1000),false);
 assert.equal(acceptLiveCommand(d,{...e,eventId:'new',occurredAt:10001},10000,1000),true);
 assert.deepEqual(d.snapshot().window!.tally,{shield:0,torch:1});
});
test('controller SSE disconnect cancels window and pauses votes before reconnection',async()=>{
 const f=await fixture();try {
  const abort=new AbortController();const stream=await fetch(f.base+'/api/events',{headers:{Cookie:f.cookie},signal:abort.signal});
  await f.post('/api/control',{action:'source',source:'DEMO'});await f.post('/api/control',{action:'open'});
  abort.abort();await new Promise(r=>setTimeout(r,40));
  const s=await(await fetch(f.base+'/api/state',{headers:{Cookie:f.cookie}})).json();
  assert.equal(s.audience.window,null);assert.equal(s.audience.paused,true);assert.equal(s.audience.result,null);
 }finally{await f.close();}
});
test('resuming a live vote rejects delayed paused-period notifications without resetting tally or time',async()=>{
 class Socket extends EventTarget {
  static latest:Socket;readyState=1;
  constructor(_url:string){super();Socket.latest=this;}
  close(){if(this.readyState===3)return;this.readyState=3;this.dispatchEvent(new Event('close'));}
  receive(data:unknown){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(data)}));}
 }
 const nativeSocket=globalThis.WebSocket;globalThis.WebSocket=Socket as any;
 let f:Awaited<ReturnType<typeof fixture>>|undefined;
 try {
  f=await fixture({clientId:'app',clientSecret:'synthetic-secret',fetcher:async(url:any)=>{
   if(String(url).includes('/token'))return Response.json({access_token:'synthetic-token'});
   if(String(url).includes('/validate'))return Response.json({client_id:'app',user_id:'123',login:'vbovu',scopes:['user:read:chat']});
   return Response.json({data:[{id:'sub',status:'enabled'}]},{status:202});
  }});
  const oauth=await(await f.post('/api/oauth/start')).json(),state=new URL(oauth.url).searchParams.get('state');
  const callback=await fetch(f.base+'/auth/twitch/callback?code=synthetic-code&state='+state,{headers:{Cookie:f.cookie},redirect:'manual'});
  assert.equal(callback.status,303);
  Socket.latest.receive({metadata:{message_type:'session_welcome'},payload:{session:{id:'session',keepalive_timeout_seconds:10}}});
  await new Promise(r=>setTimeout(r,20));await f.post('/api/control',{action:'start'});
  const notify=(id:string,stamp:number,viewer:string)=>Socket.latest.receive({metadata:{message_type:'notification',message_timestamp:new Date(stamp).toISOString()},payload:{subscription:{id:'sub',type:'channel.chat.message',condition:{broadcaster_user_id:'123',user_id:'123'}},event:{message_id:id,broadcaster_user_id:'123',chatter_user_id:viewer,message:{text:'!torch'}}}});
  notify('before-pause',Date.now(),'456');
  const paused=await(await f.post('/api/control',{action:'pause',paused:true})).json();
  assert.equal(paused.audience.window.tally.torch,1);
  const pausedStamp=Date.now();await new Promise(r=>setTimeout(r,20));
  const resumed=await(await f.post('/api/control',{action:'pause',paused:false})).json();
  assert.equal(resumed.audience.window.id,paused.audience.window.id);
  assert.equal(resumed.audience.window.remainingMs,paused.audience.window.remainingMs);
  notify('during-pause',pausedStamp,'789');notify('after-resume',Date.now(),'999');
  const result=await(await fetch(f.base+'/api/state',{headers:{Cookie:f.cookie}})).json();
  assert.deepEqual(result.audience.window.tally,{shield:0,torch:2},'Only pre-pause and post-resume notifications count');
 }finally{if(f)await f.close();globalThis.WebSocket=nativeSocket;}
});
