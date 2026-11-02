import express,{type Response} from 'express';
import {randomBytes,randomUUID} from 'node:crypto';
import {appendFileSync,mkdirSync} from 'node:fs';
import {AudienceDirector} from './audience.ts';
import {TwitchBridge} from './twitch.ts';
import {acceptLiveCommand} from './liveCommand.ts';
interface Config {clientId?:string;clientSecret?:string;channel?:string;redirectUri?:string;eventLog?:string;fetcher?:typeof fetch;}
type Session={csrf:string;expires:number;oauth?:{state:string;expires:number}};
export function createLocalApp(config:Config={}) {
 const app=express(),director=new AudienceDirector(),sessions=new Map<string,Session>(),streams=new Set<Response>();
 const channel=config.channel??'vbovu',fetcher=config.fetcher??fetch;
 let detail='Solo available. Choose DEMO or connect Twitch.',lastLiveEvent:unknown=null,windowOpenedAt=0;
 const receipt=(record:object)=>{if(config.eventLog)appendFileSync(config.eventLog,JSON.stringify({at:new Date().toISOString(),...record})+'\n');};
 const state=()=>({audience:director.snapshot(),channel,detail,oauthConfigured:Boolean(config.clientId&&config.clientSecret),lastLiveEvent});
 const broadcast=()=>{const payload=`data: ${JSON.stringify(state())}\n\n`;for(const res of streams)res.write(payload);};
 const bridge=new TwitchBridge({clientId:config.clientId??'',channel,fetcher,onState:(source,message)=>{director.setSource(source);detail=message??source;receipt({kind:'connection',source});broadcast();},onCommand:event=>{
  const window=director.snapshot().window;
  const accepted=acceptLiveCommand(director,event,windowOpenedAt,performance.now());
  if(accepted){lastLiveEvent={eventId:event.eventId,value:event.value,voteWindowId:window!.id};receipt({kind:'accepted-live-vote',...lastLiveEvent as object});}broadcast();
 }});
 app.disable('x-powered-by');
 app.use((req,res,next)=>{
  const host=req.headers.host??'';if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)){res.status(403).json({error:'Loopback host required'});return;}
  res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'});
  if(req.path.startsWith('/api/')&&req.headers.origin&&req.headers.origin!==`http://${host}`){res.status(403).json({error:'Same origin required'});return;}
  next();
 });
 app.use(express.json({limit:'4kb'}));
 const sessionFor=(req:express.Request)=>{const id=/(?:^|;\s*)sundown_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie??'')?.[1];const s=id?sessions.get(id):undefined;return s&&s.expires>Date.now()?s:null;};
 app.get('/api/session',(req,res)=>{
  let session=sessionFor(req);
  if(!session){const id=randomBytes(32).toString('hex');session={csrf:randomBytes(32).toString('hex'),expires:Date.now()+12*3600000};sessions.set(id,session);res.cookie('sundown_session',id,{httpOnly:true,sameSite:'lax',maxAge:12*3600000,path:'/'});}
  res.json({...state(),csrf:session.csrf});
 });
 app.use('/api',(req,res,next)=>{
  const session=sessionFor(req);if(!session){res.status(401).json({error:'Open the game first'});return;}
  if(req.method!=='GET'&&(req.headers.origin!==`http://${req.headers.host}`||req.headers['x-csrf-token']!==session.csrf)){res.status(403).json({error:'CSRF validation failed'});return;}
  next();
 });
 app.get('/api/state',(_req,res)=>res.json(state()));
 app.get('/api/events',(req,res)=>{
  res.set({'Content-Type':'text/event-stream','Connection':'keep-alive'});res.flushHeaders();streams.add(res);res.write(`data: ${JSON.stringify(state())}\n\n`);req.on('close',()=>{streams.delete(res);if(streams.size===0){director.cancel();director.setPaused(true);windowOpenedAt=0;receipt({kind:'controller-disconnected',observed:'Window canceled; simulation requires explicit resume.'});}});
 });
 app.post('/api/control',(req,res)=>{
  const b=req.body??{};
  switch(b.action){
   case 'start':director.cancel();director.setPaused(false);windowOpenedAt=Date.now();director.open();break;
   case 'source':
    if(!['DEMO','OFFLINE'].includes(b.source)){res.status(400).json({error:'Source must be DEMO or OFFLINE'});return;}
    bridge.stop();director.setSource(b.source);detail=b.source==='DEMO'?'Simulated viewers. This is not live Twitch.':'Solo mode. Twitch disconnected.';break;
   case 'open':if(!director.snapshot().window)windowOpenedAt=Date.now();director.open();break;
   case 'cancel':director.cancel();windowOpenedAt=0;break;
   case 'pause':{
    if(typeof b.paused!=='boolean'){res.sendStatus(400);return;}
    const before=director.snapshot();
    // Resume keeps the vote/tally/time, but excludes delayed paused-period messages.
    if(!b.paused&&before.paused&&before.window)windowOpenedAt=Date.now();
    director.setPaused(b.paused);break;
   }
   case 'demo-vote': {
    if(director.snapshot().source!=='DEMO'||!['shield','torch'].includes(b.value)||typeof b.viewer!=='string'||b.viewer.length>40){res.sendStatus(400);return;}
    director.accept({eventId:'demo-'+randomUUID(),broadcasterId:'demo',viewerIdHash:'demo-'+b.viewer,receivedAt:performance.now(),source:'DEMO',type:'KNIGHT_AID',value:b.value,voteWindowId:director.snapshot().window?.id});break;
   }
   case 'effect-applied':{
    const r=director.snapshot().result;if(r&&r.id===b.id)receipt({kind:'game-effect-acknowledged',result:r,gameplay:b.gameplay==='knight'?'knight':'unknown'});break;
   }
   default:res.status(400).json({error:'Unknown action'});return;
  }
  broadcast();res.json(state());
 });
 app.post('/api/oauth/start',(req,res)=>{
  if(!config.clientId||!config.clientSecret){res.status(503).json({error:'Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in the local .env, then restart the server.'});return;}
  const session=sessionFor(req)!;const nonce=randomBytes(32).toString('hex');session.oauth={state:nonce,expires:Date.now()+10*60000};
  const params=new URLSearchParams({client_id:config.clientId,redirect_uri:config.redirectUri??'http://localhost:3000/auth/twitch/callback',response_type:'code',scope:'user:read:chat',state:nonce,force_verify:'true'});
  res.json({url:'https://id.twitch.tv/oauth2/authorize?'+params});
 });
 app.get('/auth/twitch/callback',async(req,res)=>{
  const session=sessionFor(req),pending=session?.oauth;
  if(!pending||pending.expires<Date.now()||req.query.state!==pending.state){res.status(400).type('text').send('Invalid or expired OAuth state. Return to the game and reconnect Twitch.');return;}
  delete session!.oauth;
  if(req.query.error||typeof req.query.code!=='string'){res.status(400).type('text').send('Authorization was not completed. Return to the game to retry.');return;}
  try {
   const response=await fetcher('https://id.twitch.tv/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId!,client_secret:config.clientSecret!,code:req.query.code,grant_type:'authorization_code',redirect_uri:config.redirectUri??'http://localhost:3000/auth/twitch/callback'}),signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw new Error('OAuth exchange failed');const data=await response.json();if(typeof data.access_token!=='string')throw new Error('No token');
   director.setSource('OFFLINE');await bridge.connect(data.access_token);res.redirect(303,'/?twitch=connecting');
  }catch{detail='Twitch authorization failed. Check local app settings and sign in as '+channel;director.setSource('OFFLINE');broadcast();res.status(502).type('text').send('Twitch connection failed. Return to the game and retry. Tokens and error responses were not logged.');}
 });
 app.use((error:unknown,_req:express.Request,res:Response,_next:express.NextFunction)=>res.status(400).json({error:'Invalid request'}));
 const timer=setInterval(()=>{director.tick();broadcast();for(const [id,s]of sessions)if(s.expires<Date.now())sessions.delete(id);},250);timer.unref();
 return {app,director,close:()=>{clearInterval(timer);bridge.stop();for(const res of streams)res.end();streams.clear();},state};
}
