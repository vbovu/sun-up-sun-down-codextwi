import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TwitchBridge} from './twitch.ts';

class FakeSocket extends EventTarget {
 static all:FakeSocket[]=[]; readyState=1; url:string;
 constructor(url:string){super(); this.url=url;FakeSocket.all.push(this);}
 close(){this.readyState=3;this.dispatchEvent(new Event('close'));}
 receive(o:unknown){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(o)}));}
}
const flush=()=>new Promise(r=>setTimeout(r,20));
function fixture(overrides:any={}){
 FakeSocket.all=[];const states:string[]=[], commands:any[]=[], calls:any[]=[];
 const fetcher=async (url:any,init:any={})=>{
  calls.push({url,init});
  if(String(url).includes('/validate'))return Response.json({client_id:'app',user_id:'123',login:'vbovu',scopes:['user:read:chat'],expires_in:3600});
  return Response.json({data:[{id:'sub',status:'enabled'}]},{status:202});
 };
 const bridge=new TwitchBridge({clientId:'app',channel:'vbovu',fetcher:fetcher as any,Socket:FakeSocket as any,onState:s=>states.push(s),onCommand:e=>commands.push(e),...overrides});
 return {bridge,states,commands,calls};
}
const welcome={metadata:{message_type:'session_welcome'},payload:{session:{id:'session',keepalive_timeout_seconds:10}}};
function notification(id='message',text='!torch') {return {metadata:{message_id:'delivery-'+id,message_type:'notification',message_timestamp:new Date().toISOString(),subscription_type:'channel.chat.message'},payload:{subscription:{id:'sub',type:'channel.chat.message',version:'1',condition:{broadcaster_user_id:'123',user_id:'123'}},event:{message_id:id,broadcaster_user_id:'123',chatter_user_id:'456',message:{text}}}};}
test('LIVE only after validated token, welcome and successful subscription; ids hashed',async()=>{
 const {bridge:b,states,commands,calls}=fixture();await b.connect('never-in-browser');assert.ok(!states.includes('LIVE'));
 FakeSocket.all[0].receive(welcome);await flush();assert.equal(states.at(-1),'LIVE');
 const request=JSON.parse(calls.find(c=>c.url.includes('/helix/')).init.body);assert.equal(request.condition.user_id,'123');assert.equal(request.transport.method,'websocket');
 FakeSocket.all[0].receive(notification());FakeSocket.all[0].receive(notification());await flush();
 assert.equal(commands.length,1);assert.equal(commands[0].value,'torch');assert.notEqual(commands[0].viewerIdHash,'456');
 assert.ok(Number.isFinite(commands[0].occurredAt),'Original Twitch timestamp must reach the window boundary check');
 assert.ok(!JSON.stringify(commands).includes('never-in-browser'));b.stop();
});
test('malformed/wrong channel/stale/foreign subscription notifications ignored',async()=>{
 const {bridge:b,commands}=fixture();await b.connect('t'); const s=FakeSocket.all[0];s.receive(welcome);await flush();
 s.dispatchEvent(new MessageEvent('message',{data:'{bad json'}));s.receive(null);s.receive(notification('bad','!harm'));
 let n=notification('other');n.payload.event.broadcaster_user_id='999';s.receive(n);
 n=notification('stale');n.metadata.message_timestamp='2020-01-01T00:00:00Z';s.receive(n);
 n=notification('foreign');n.payload.subscription.id='other';s.receive(n);assert.equal(commands.length,0);b.stop();
});
test('server-directed migration transfers subscription and preserves dedupe',async()=>{
 const {bridge:b,commands,calls,states}=fixture();await b.connect('t');const old=FakeSocket.all[0];old.receive(welcome);await flush();old.receive(notification());
 old.receive({metadata:{message_type:'session_reconnect'},payload:{session:{reconnect_url:'wss://eventsub.wss.twitch.tv/ws?reconnect=test'}}});
 assert.equal(old.readyState,1);const next=FakeSocket.all[1];next.receive(welcome);await flush();assert.equal(old.readyState,3);
 next.receive(notification());assert.equal(commands.length,1);assert.equal(calls.filter(c=>c.url.includes('/helix/')).length,1);assert.equal(states.at(-1),'LIVE');b.stop();
});
test('unsafe reconnect URL rejected and revocation goes OFFLINE',async()=>{
 const {bridge:b,states}=fixture();await b.connect('t');const s=FakeSocket.all[0];s.receive(welcome);await flush();
 s.receive({metadata:{message_type:'session_reconnect'},payload:{session:{reconnect_url:'wss://evil.example/ws'}}});assert.equal(FakeSocket.all.length,1);
 s.receive({metadata:{message_type:'revocation'},payload:{}});assert.equal(states.at(-1),'OFFLINE');b.stop();
});
test('wrong OAuth account, app or missing scope cannot open live socket',async()=>{
 for(const data of [{client_id:'wrong',user_id:'123',login:'vbovu',scopes:['user:read:chat']},{client_id:'app',user_id:'123',login:'other',scopes:['user:read:chat']},{client_id:'app',user_id:'123',login:'vbovu',scopes:[]}]) {
  const {bridge:b,states}=fixture({fetcher:async()=>Response.json(data)});await assert.rejects(()=>b.connect('t'));assert.ok(!states.includes('LIVE'));assert.equal(FakeSocket.all.length,0);b.stop();
 }
});
test('stale subscription completion cannot replace the currently authenticated session',async()=>{
 let resolveOld:(r:Response)=>void=()=>{};let subscriptions=0;
 const f=fixture({fetcher:async(url:any)=>{
  if(String(url).includes('/validate'))return Response.json({client_id:'app',user_id:'123',login:'vbovu',scopes:['user:read:chat']});
  subscriptions++;if(subscriptions===1)return await new Promise<Response>(resolve=>{resolveOld=resolve;});
  return Response.json({data:[{id:'new-sub',status:'enabled'}]},{status:202});
 }});
 await f.bridge.connect('old-token');FakeSocket.all[0].receive(welcome);await flush();
 await f.bridge.connect('new-token');FakeSocket.all[1].receive(welcome);await flush();
 resolveOld(Response.json({data:[{id:'old-sub',status:'enabled'}]},{status:202}));await flush();
 const n=notification('new-message');n.payload.subscription.id='new-sub';FakeSocket.all[1].receive(n);
 assert.equal(f.commands.length,1);f.bridge.stop();
});
test('abandoned migration cannot replace a freshly subscribed retry',async()=>{
 let subscriptions=0;
 const f=fixture({fetcher:async(url:any)=>String(url).includes('/validate')
  ?Response.json({client_id:'app',user_id:'123',login:'vbovu',scopes:['user:read:chat']})
  :Response.json({data:[{id:'sub-'+(++subscriptions),status:'enabled'}]},{status:202})});
 try {
  await f.bridge.connect('synthetic-token');const old=FakeSocket.all[0];old.receive(welcome);await flush();
  old.receive({metadata:{message_type:'session_reconnect'},payload:{session:{reconnect_url:'wss://eventsub.wss.twitch.tv/ws?reconnect=test'}}});
  const migration=FakeSocket.all[1];old.close();await new Promise(r=>setTimeout(r,1550));
  const fresh=FakeSocket.all[2];assert.ok(fresh);fresh.receive(welcome);await flush();
  migration.receive(welcome);await flush();
  const n=notification('fresh-after-race');n.payload.subscription.id='sub-2';fresh.receive(n);
  assert.equal(f.commands.length,1,'Fresh subscribed connection must remain authoritative');
  assert.equal(f.states.at(-1),'LIVE');assert.equal(subscriptions,2);
 }finally{f.bridge.stop();}
});
