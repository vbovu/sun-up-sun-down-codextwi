import {createHmac,randomBytes} from 'node:crypto';
import {parseCommand,type Aid} from './audience.ts';
type Command={eventId:string;broadcasterId:string;viewerIdHash:string;value:Aid;occurredAt:number};
interface Options {
 clientId:string;channel:string;fetcher?:typeof fetch;Socket?:typeof WebSocket;
 onState:(state:'LIVE'|'OFFLINE',detail?:string)=>void;onCommand:(event:Command)=>void;
}
/** Only this server-side adapter can promote the connection to LIVE. */
export class TwitchBridge {
 private fetcher:typeof fetch;private Socket:typeof WebSocket;
 private sockets=new Set<WebSocket>();private active:WebSocket|null=null;
 private stopped=true;private generation=0;private retry:ReturnType<typeof setTimeout>|null=null;
 private validation:ReturnType<typeof setInterval>|null=null;
 private watchdogs=new Map<WebSocket,ReturnType<typeof setTimeout>>();
 private seen=new Set<string>();private salt=randomBytes(32);private token='';private userId='';private subscriptionId='';
 constructor(private options:Options) {this.fetcher=options.fetcher??fetch;this.Socket=options.Socket??WebSocket;}
 async connect(token:string) {
  this.stop();this.stopped=false;this.token=token;const generation=this.generation;
  try {
   const userId=await this.validate(token);if(this.stopped||generation!==this.generation)return;this.userId=userId;
   this.open('wss://eventsub.wss.twitch.tv/ws');
   this.validation=setInterval(()=>{void this.validate(token).catch(()=>{if(this.stopped||generation!==this.generation)return;this.stop();this.options.onState('OFFLINE','Authorization expired; reconnect Twitch.');});},50*60*1000);
   this.validation.unref?.();
  } catch {if(this.stopped||generation!==this.generation)return;this.stop();this.options.onState('OFFLINE','Twitch authorization does not match channel/app/scope.');throw new Error('Twitch authorization could not be validated.');}
 }
 private async validate(token:string) {
  const r=await this.fetcher('https://id.twitch.tv/oauth2/validate',{headers:{Authorization:`OAuth ${token}`},signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new Error('Invalid authorization');const d=await r.json();
  if(d.client_id!==this.options.clientId||d.login?.toLowerCase()!==this.options.channel.toLowerCase()||!d.scopes?.includes('user:read:chat')||!/^\d+$/.test(d.user_id))throw new Error('Incorrect authorization');
  return d.user_id as string;
 }
 private arm(socket:WebSocket,seconds:number) {
  const old=this.watchdogs.get(socket);if(old)clearTimeout(old);
  const timer=setTimeout(()=>{socket.close();},Math.max(10,seconds)*1000+1500);timer.unref?.();this.watchdogs.set(socket,timer);
 }
 private open(url:string,previous:WebSocket|null=null) {
  if(this.stopped)return;const generation=this.generation;
  const socket=new this.Socket(url);this.sockets.add(socket);this.arm(socket,15);
  let welcomed=false,timeout=10;
  socket.addEventListener('message',event=>{void (async()=>{
   if(this.stopped||generation!==this.generation)return;
   // A migration only owns promotion while its original socket is still active.
   // After loss/retry, a late welcome must not replace a newly subscribed session.
   if(previous&&this.active!==previous&&this.active!==socket){socket.close();return;}
   let data:any;try {if(typeof event.data!=='string'||event.data.length>100000)return;data=JSON.parse(event.data);}catch{return;}
   const type=data?.metadata?.message_type;if(!type)return;
   if(type==='session_welcome') {
    if(welcomed)return;welcomed=true;
    const id=data.payload?.session?.id;if(typeof id!=='string'||id.length>200) {socket.close();return;}
    timeout=Number(data.payload.session.keepalive_timeout_seconds)||10;this.arm(socket,timeout);
    if(!previous) {
     const response=await this.fetcher('https://api.twitch.tv/helix/eventsub/subscriptions',{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'Client-Id':this.options.clientId,'Content-Type':'application/json'},body:JSON.stringify({type:'channel.chat.message',version:'1',condition:{broadcaster_user_id:this.userId,user_id:this.userId},transport:{method:'websocket',session_id:id}}),signal:AbortSignal.timeout(10000)});
     if(this.stopped||generation!==this.generation||socket.readyState!==1)return;
     if(response.status!==202){socket.close();return;}const d=await response.json();
     if(this.stopped||generation!==this.generation||socket.readyState!==1)return;
     if(d.data?.[0]?.status!=='enabled'||!d.data[0].id){socket.close();return;}this.subscriptionId=d.data[0].id;
    }
    if(this.stopped||generation!==this.generation||socket.readyState!==1)return;
    this.active=socket;if(previous)previous.close();this.options.onState('LIVE',`Listening to ${this.options.channel}`);return;
   }
   if(type==='session_keepalive'){this.arm(socket,timeout);return;}
   if(type==='session_reconnect'&&socket===this.active) {
    try {const target=new URL(data.payload?.session?.reconnect_url);if(target.protocol==='wss:'&&target.hostname==='eventsub.wss.twitch.tv'&&(!target.port||target.port==='443'))this.open(target.href,socket);}catch{}return;
   }
   if(type==='revocation') {this.stop();this.options.onState('OFFLINE','Twitch permission revoked.');return;}
   if(type!=='notification'||!welcomed||socket!==this.active)return;
   this.arm(socket,timeout);
   const sub=data.payload?.subscription,e=data.payload?.event,stamp=Date.parse(data.metadata?.message_timestamp);
   if(sub?.id!==this.subscriptionId||sub.type!=='channel.chat.message'||sub.condition?.broadcaster_user_id!==this.userId||sub.condition?.user_id!==this.userId||e?.broadcaster_user_id!==this.userId)return;
   if(!Number.isFinite(stamp)||Math.abs(Date.now()-stamp)>30000)return;
   if(typeof e.message_id!=='string'||e.message_id.length>200||!/^\d{1,30}$/.test(e.chatter_user_id))return;
   const value=parseCommand(e.message?.text);if(!value||this.seen.has(e.message_id))return;
   this.seen.add(e.message_id);if(this.seen.size>10000)this.seen.delete(this.seen.values().next().value!);
   this.options.onCommand({eventId:e.message_id,broadcasterId:this.userId,viewerIdHash:createHmac('sha256',this.salt).update(e.chatter_user_id).digest('hex'),value,occurredAt:stamp});
  })().catch(()=>{socket.close();});});
  socket.addEventListener('error',()=>{socket.close();});
  socket.addEventListener('close',()=>{
   this.sockets.delete(socket);const timer=this.watchdogs.get(socket);if(timer)clearTimeout(timer);this.watchdogs.delete(socket);
   if(this.stopped||generation!==this.generation)return;
   if(socket===this.active||!this.active) {
    this.active=null;this.options.onState('OFFLINE','Connection lost; retrying.');
    if(!this.retry){this.retry=setTimeout(()=>{this.retry=null;this.open('wss://eventsub.wss.twitch.tv/ws');},1500);this.retry.unref?.();}
   }
  });
 }
 stop() {
  this.stopped=true;this.generation++;if(this.retry)clearTimeout(this.retry);this.retry=null;
  if(this.validation)clearInterval(this.validation);this.validation=null;
  for(const t of this.watchdogs.values())clearTimeout(t);this.watchdogs.clear();
  for(const s of this.sockets)s.close();this.sockets.clear();this.active=null;this.token='';
 }
}
