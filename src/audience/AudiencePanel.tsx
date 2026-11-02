import {createPortal} from 'react-dom';
import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import type {Aid,Result,Source,VoteWindow} from '../../server/audience';
import type {createSceneStage} from '../three/sceneStage';
import './audience.css';
type Stage=ReturnType<typeof createSceneStage>;
export type EncounterSummary=ReturnType<Stage['getKnightState']>;
interface Snapshot {audience:{source:Source;paused:boolean;window:VoteWindow|null;result:Result|null};channel:string;detail:string;oauthConfigured:boolean;lastLiveEvent:{eventId:string;value:Aid;voteWindowId:string}|null;}
export interface AudienceHandle {start:()=>Promise<void>;pause:()=>void;resume:()=>Promise<void>;leave:()=>Promise<void>;}
interface Props {stage:React.RefObject<Stage|null>;mode:'hidden'|'setup'|'ready'|'active';onStart:()=>void;onFinish:(s:EncounterSummary|null)=>void;onLeave:()=>void;onPaused:(paused:boolean)=>void;onDismiss:()=>void;onSettings:()=>void;}
export const AudiencePanel=forwardRef<AudienceHandle,Props>(function AudiencePanel({stage,mode,onStart,onFinish,onLeave,onPaused,onDismiss,onSettings},ref) {
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[transport,setTransport]=useState(false),[error,setError]=useState('');
 const [active,setActive]=useState(false),[paused,setPaused]=useState(false),[elapsed,setElapsed]=useState(0),[expanded,setExpanded]=useState(mode==='setup');
 const [knight,setKnight]=useState<EncounterSummary|null>(null),[applied,setApplied]=useState(''),[busy,setBusy]=useState(false);
 const csrf=useRef(''),seen=useRef(new Set<string>()),activeRef=useRef(false),pausedRef=useRef(false),elapsedRef=useRef(0),last=useRef(performance.now()),alive=useRef(true);
 const operation=useRef(0),modeRef=useRef(mode);modeRef.current=mode;
 activeRef.current=active;
 async function control(body:object) {
  try {const r=await fetch('/api/control',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf.current},body:JSON.stringify(body)});if(!r.ok)throw new Error('Audience control unavailable. Reopen the game if your session expired.');const d=await r.json();if(alive.current)setSnapshot(d);return d;}
  catch(e){if(alive.current)setError((e as Error).message);return null;}
 }
 function pause() {operation.current++;if(!activeRef.current)return;pausedRef.current=true;setPaused(true);stage.current?.setEncounterPaused(true);onPaused(true);void control({action:'pause',paused:true});}
 async function resume() {if(!transport)return;const attempt=++operation.current;const resumed=await control({action:'pause',paused:false});if(attempt!==operation.current||!activeRef.current||!resumed||resumed.audience.paused)return;pausedRef.current=false;setPaused(false);stage.current?.setEncounterPaused(false);last.current=performance.now();onPaused(false);}
 async function start() {
  if(!snapshot||!transport||busy||modeRef.current!=='ready')return;const attempt=++operation.current;setBusy(true);setError('');stage.current?.unlockAudio();
  const started=await control({action:'start'});
  if(attempt!==operation.current||modeRef.current!=='ready'){await control({action:'cancel'});setBusy(false);return;}
  setBusy(false);if(!started||!started.audience.window||started.audience.paused)return;
  setApplied('');seen.current.clear();setElapsed(0);setKnight(null);pausedRef.current=false;setPaused(false);onPaused(false);onStart();setActive(true);
 }
 async function leave() {const attempt=++operation.current;pausedRef.current=true;stage.current?.setEncounterPaused(true);await control({action:'cancel'});if(attempt!==operation.current)return;setActive(false);setPaused(false);pausedRef.current=false;onPaused(false);onLeave();}
 useImperativeHandle(ref,()=>({start,pause,resume,leave}));
 useEffect(()=>{
  alive.current=true;let stream:EventSource|undefined;
  void fetch('/api/session').then(r=>{if(!r.ok)throw new Error('Backend unavailable');return r.json();}).then(d=>{
   if(!alive.current)return;csrf.current=d.csrf;setSnapshot(d);stream=new EventSource('/api/events');stream.onopen=()=>setTransport(true);
   stream.onmessage=e=>{try{setSnapshot(JSON.parse(e.data));setTransport(true);}catch{}};
   stream.onerror=()=>{setTransport(false);if(activeRef.current){pausedRef.current=true;stage.current?.setEncounterPaused(true);setPaused(true);onPaused(true);}};
  }).catch(()=>setError('The local audience backend is unavailable. Restart the local server.'));
  return()=>{alive.current=false;stream?.close();};
 },[]);
 useEffect(()=>{
  const r=snapshot?.audience.result;if(!r||seen.current.has(r.id)||!active||pausedRef.current||!transport)return;
  if(stage.current?.applyAudienceAid(r.value)){seen.current.add(r.id);setApplied(`${r.fallback?'Solo fallback':r.source==='LIVE'?'LIVE audience':'DEMO audience'}: ${r.value==='shield'?'shield reached the knight':'torch reached the knight'}.`);void control({action:'effect-applied',id:r.id,gameplay:'knight'});}
 },[snapshot?.audience.result?.id,active,paused,transport]);
 useEffect(()=>{
  document.body.dataset.encounter=String(active);stage.current?.setEncounterActive(active);stage.current?.setEncounterPaused(pausedRef.current);
  if(!active){pausedRef.current=false;setPaused(false);stage.current?.setEncounterPaused(false);return;}
  elapsedRef.current=0;last.current=performance.now();
  const timer=setInterval(()=>{
   const now=performance.now(),dt=Math.max(0,now-last.current);last.current=now;if(!pausedRef.current)elapsedRef.current+=dt;
   setElapsed(elapsedRef.current);const stats=stage.current?.getKnightState()??null;setKnight(stats);
   if(elapsedRef.current>=60000){onFinish(stats);setActive(false);void control({action:'cancel'});}
  },100);
  return()=>{clearInterval(timer);document.body.dataset.encounter='false';stage.current?.setEncounterActive(false);};
 },[active]);
 useEffect(()=>{const blur=()=>{if(activeRef.current)pause();};const visibility=()=>{if(document.hidden)blur();};window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);return()=>{window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);};},[]);
 async function connect() {try{const r=await fetch('/api/oauth/start',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf.current},body:'{}'});const d=await r.json();if(!r.ok)throw new Error(d.error);location.assign(d.url);}catch(e){setError((e as Error).message);}}
 const source:Source=transport?snapshot?.audience.source??'OFFLINE':'OFFLINE',vote=snapshot?.audience.window,voters=vote? vote.tally.shield+vote.tally.torch:0;
 if(mode==='hidden')return null;
 return <aside className={`audience-panel compact-audience ${active?'is-active':''} ${mode==='ready'?'is-ready':''} ${mode==='setup'?'audience-setup':''}`} aria-label="Audience encounter">
  <header className="audience-top"><span className="chapter-kicker">{active?'Knight encounter':mode==='ready'?'Ethan’s console':'Audience setup'}</span><strong className={`audience-source ${source.toLowerCase()}`} data-testid="audience-source">{source}</strong>{mode==='setup'&&<button onClick={onDismiss} aria-label="Close audience setup">Close</button>}</header>
  {mode==='ready'&&<><h2>A knight stronger<br/>than a king.</h2><p>Move close to slash. When the king raises his sword, block or jump. Survive 60 seconds. Wins are a bonus, not a six-win requirement. Defeat retries after two seconds; replay starts a fresh round.</p><div className="combat-keys"><kbd>A D</kbd> move <kbd>W</kbd> jump <kbd>S</kbd> block <kbd>F</kbd> slash</div></>}
  <div className="audience-status" role="status">{transport?(source==='OFFLINE'?'Solo play. No Twitch connection required.':source==='DEMO'?'Simulated viewers. This is not live Twitch.':`Listening to ${snapshot?.channel}`):'Local audience bridge disconnected.'}</div>
  {mode==='ready'&&<button className="audience-config-toggle" onClick={()=>setExpanded(!expanded)} aria-expanded={expanded}>Audience options {expanded?'−':'+'}</button>}
  {(mode==='setup'||expanded)&&<div className="audience-connection"><div className="audience-buttons"><button onClick={connect} disabled={!snapshot?.oauthConfigured||!transport||active||source==='LIVE'}>{source==='LIVE'?'Already connected':'Connect Twitch'} · {snapshot?.channel??'vbovu'}</button><button onClick={()=>void control({action:'source',source:source==='DEMO'?'OFFLINE':'DEMO'})} disabled={!transport||active}>{source==='DEMO'?'Use solo mode':'Use DEMO viewers'}</button></div>{!snapshot?.oauthConfigured&&<p className="audience-note">Twitch is optional. To connect later, save app credentials in the local .env and restart the server.</p>}</div>}
  {mode==='ready'&&!active&&<button className="paper-button audience-primary" onClick={start} disabled={!transport||busy} aria-label="Start audience encounter">Begin the knight encounter <span>→</span></button>}
  {active&&<>{document.getElementById('console-clock-slot')&&createPortal(<div className="console-clock" aria-label="Round timer"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg><span>{paused?'Paused':'Time left'}</span><strong data-testid="encounter-seconds">{Math.max(0,60-Math.floor(elapsed/1000))}<small>s</small></strong></div>,document.getElementById('console-clock-slot')!)}<div className="encounter-clock"><span>{paused?'Paused':'Survive the round'}</span><small>Time remaining is on the console</small></div><div className="knight-meters"><span>Knight <b data-testid="knight-health">{knight?.health??100}</b></span><span>King <b data-testid="enemy-health">{knight?.enemyHealth??100}</b></span><span>Wins <b>{knight?.wins??0}</b></span></div>
   {vote?<div className="vote-window"><div><strong>{Math.ceil(vote.remainingMs/1000)}s to vote</strong><span>{voters} {voters===1?'viewer':'viewers'}</span></div><progress max={12000} value={vote.remainingMs}/><div className="vote-options"><span><code>!shield</code> {vote.tally.shield}</span><span><code>!torch</code> {vote.tally.torch}</span></div></div>:<button className="next-vote" onClick={()=>void control({action:'open'})} disabled={paused}>Open next aid vote</button>}
   <p className="aid-result" aria-live="polite" data-testid="aid-result">{applied||'Chat chooses a shield or a stronger slash. First vote per viewer; empty votes choose shield.'}</p>
   {knight?.aid&&<p className="active-aid" data-testid="active-aid">{knight.aid.value==='shield'?'Shield ready · next hit absorbed':'Torch active · 35 damage per slash'} <span>{Math.ceil(knight.aid.remaining)}s</span></p>}
   {source==='DEMO'&&<div className="audience-demo"><span>DEMO controls · one simulated viewer</span><button disabled={!vote||paused} onClick={()=>void control({action:'demo-vote',value:'shield',viewer:'local-viewer'})}>DEMO !shield</button><button disabled={!vote||paused} onClick={()=>void control({action:'demo-vote',value:'torch',viewer:'local-viewer'})}>DEMO !torch</button></div>}
   <div className="encounter-actions"><button onClick={()=>paused?void resume():pause()} disabled={!transport}>{paused?'Resume encounter':'Pause encounter'}</button><button onClick={onSettings}>Settings</button><button onClick={()=>void leave()}>Put console down</button></div>
  </>}
  {error&&<p className="audience-error" role="alert">{error}</p>}
 </aside>;
});
