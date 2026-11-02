/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback, useReducer } from 'react';
import {
  CHAT_1853,
  CHAT_2143,
  getBeatsForScene,
  createInitialEngineState,
  reduceEngineState,
  createChannel,
  sendChannel,
  drainChannel,
  type EngineAction,
  type EngineState,
} from './core/engine';
import { createSceneStage, type HotspotInfo } from './three/sceneStage';
import { defs } from './three/characterRegistry';
import {AudiencePanel,type AudienceHandle,type EncounterSummary} from './audience/AudiencePanel';
import {TitleScreen,Settings,Controls,JourneyUI,PauseMenu,GraphicsChooser,ConfirmNewChapter} from './experience/GameUI';
import {initialJourney,journeyReducer} from './experience/journey';
import {resumeJourney} from './experience/recovery';
import {legacyAdvance} from './experience/legacyProgression';
import {readPreferences,savePreferences,type Preferences} from './experience/preferences';

const IC = (p: string) =>
  `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

const ICONS: Record<string, string> = {
  eye: IC('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  cam: IC('<path d="M3 9a2 2 0 0 1 2-2h2l1.5-2h7L17 7h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.2"/>'),
  pad: IC('<rect x="2.5" y="7" width="19" height="10" rx="4"/><path d="M7 10v4M5 12h4"/><circle cx="16" cy="11" r=".8"/><circle cx="18" cy="13" r=".8"/>'),
  brush: IC('<path d="M14 4l6 6-8 8-5 1 1-5z"/><path d="M5 19c-1 0-2 0-2 2 2 0 3-1 3-2"/>'),
  user: IC('<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.8-4 3.7-6 7.5-6s6.700 2 7.500 6"/>'),
  car: IC('<path d="M4 15l1.500-5a2 2 0 0 1 2-1.500h9a2 2 0 0 1 2 1.500L20 15v3H4z"/><circle cx="8" cy="15.500" r=".8"/><circle cx="16" cy="15.500" r=".8"/>'),
  win: IC('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 4v16M4 12h16"/>'),
  snd: IC('<path d="M4 9.500v5h3.500L12 18.500v-13L7.500 9.500z"/><path d="M15.500 9a4 4 0 0 1 0 6M18 6.500a8 8 0 0 1 0 11"/>'),
  mute: IC('<path d="M4 9.500v5h3.500L12 18.500v-13L7.500 9.500z"/><path d="M16 9.500l5 5M21 9.500l-5 5"/>'),
  home: IC('<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
};

const STYLE_LABELS = [
  'Ink & Gouache 2.5D',
  'Rich Painterly',
  'Classic Toon',
  '2D Colour-Sketch',
];

const AMBIENT_CAPTIONS = [
  'rain on the back window, wipers keeping time',
  '18:53 · Katomos highway — Sofi types from Lóže where the sun is up',
  '“I play when sun is down and I type to you too 😊”',
  '21:43 · two stories painted black and white, and a dog in the yard',
];

export default function App() {
  const autostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [engine, setEngine] = useState<EngineState>(() => ({...createInitialEngineState(autostart),styleIdx:readPreferences().graphicsStyle}));
  const [journey,sendJourney]=useReducer(journeyReducer,{...initialJourney,phase:autostart?'legacy':'title'});
  const journeyRef=useRef(journey);journeyRef.current=journey;
  const [preferences,setPreferences]=useState(readPreferences);
  const [gamePaused,setGamePaused]=useState(false),[settingsOpen,setSettingsOpen]=useState(false),[controlsOpen,setControlsOpen]=useState(false),[audienceSetup,setAudienceSetup]=useState(false);
  const [graphicsOpen,setGraphicsOpen]=useState(false),[confirmNew,setConfirmNew]=useState(false);
  const pendingPlay=useRef(false),graphicsBefore=useRef(0);
  const checkpoint=useRef<{engine:EngineState;journey:typeof journey;summary:EncounterSummary|null}|null>(null);
  const [hasCheckpoint,setHasCheckpoint]=useState(false);
  const [summary,setSummary]=useState<EncounterSummary|null>(null);
  const audienceRef=useRef<AudienceHandle|null>(null);
  const interactionRef=useRef<(key:string)=>void>(()=>{}),advanceRef=useRef<()=>void>(()=>{});
  const engineRef = useRef<EngineState>(engine);
  engineRef.current = engine;

  // Deterministic Rust-inspired channel queue for dispatching engine actions without race conditions
  const channelRef = useRef(createChannel<EngineAction>());
  const dispatch = useCallback((action: EngineAction) => {
    channelRef.current = sendChannel(channelRef.current, action, performance.now());
    const drained = drainChannel(channelRef.current);
    channelRef.current = drained.channel;
    setEngine(prev => {
      let cur = prev;
      for (const msg of drained.messages) {
        const res = reduceEngineState(cur, msg.payload);
        if (res.ok) cur = res.value;
      }
      return cur;
    });
  }, []);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const stickmanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageCtrlRef = useRef<ReturnType<typeof createSceneStage> | null>(null);

  const [hoveredHotspot, setHoveredHotspot] = useState<HotspotInfo | null>(null);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [pointerLockFailed, setPointerLockFailed] = useState(false);
  const [stickmanWins, setStickmanWins] = useState(0);
  const [legacyOpen,setLegacyOpen]=useState(true),[legacyComplete,setLegacyComplete]=useState(false),[moved,setMoved]=useState(false);
  const legacyAdvanceRef=useRef<()=>void>(()=>{});
  const [toastMsg, setToastMsg] = useState('');
  const toastTimerRef = useRef<number | null>(null);

  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(60);
  const [activeLookKey, setActiveLookKey] = useState('console');

  // Chat log playback state
  const activeChatList = engine.sceneId === 1 ? CHAT_1853 : [...CHAT_1853, ...CHAT_2143];
  const [visibleMsgCount, setVisibleMsgCount] = useState<number>(CHAT_1853.length);
  const chatLogRef = useRef<HTMLDivElement | null>(null);

  // Typewriter state
  const [typedChars, setTypedChars] = useState(9999);
  const lineElRef = useRef<HTMLParagraphElement | null>(null);

  // Title menu ambient caption & parallax state
  const [captionIdx, setCaptionIdx] = useState(0);
  const [titleDrift, setTitleDrift] = useState(false);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [studioOutfit, setStudioOutfit] = useState(0);
  const [studioPose, setStudioPose] = useState('Idle');

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(''), 3200);
  }, []);

  // Sync body[data-state] for automated acceptance checks & CSS hooks
  useEffect(() => {
    document.body.dataset.state = engine.mode;
    document.body.dataset.scene = String(engine.sceneId);
    document.body.dataset.beat = String(engine.beatIdx);document.body.dataset.line = String(engine.lineIdx);
    document.body.dataset.walker=JSON.stringify(engine.walker);
  }, [engine.mode, engine.sceneId,engine.beatIdx,engine.lineIdx,engine.walker]);

  // Initialize Three.js Scene Stage
  useEffect(() => {
    if (!stageRef.current || !stickmanCanvasRef.current) return;
    const ctrl = createSceneStage(stageRef.current, stickmanCanvasRef.current, {
      onHotspotHover: hs => setHoveredHotspot(hs),
      onHotspotActivate: hs => {
        if(journeyRef.current.phase!=='legacy'){interactionRef.current(hs.key);return;}
        setLegacyOpen(true);
        if (hs.key === 'console') {
          dispatch({ type: 'TOGGLE_CONSOLE', force: true, tab: 'game' });
        } else if (hs.beatTarget === engineRef.current.beatIdx) {
          setLegacyOpen(true);
        } else {
          dispatch({ type: 'SELECT_BEAT', beatIdx: hs.beatTarget });
        }
      },
      onAdvanceDialogue: () => {if(journeyRef.current.phase==='legacy')legacyAdvanceRef.current();else if(journeyRef.current.phase==='dialogue')advanceRef.current();},
      onStickmanWinChange: wins => setStickmanWins(wins),
      onPointerLockChange: (lck, fail) => {
        setPointerLocked(lck);
        setPointerLockFailed(fail);
        if (lck) showToast('Mouse captured · click or Space to continue · Esc to release');
      },
      onStepWalker: (fwd, str, yaw, dt) => {
        if(fwd||str)setMoved(true);
        dispatch({ type: 'STEP_WALKER', moveForward: fwd, moveStrafe: str, yaw, dt });
      },
    });
    stageCtrlRef.current = ctrl;
    const aud = ctrl.getAudioState();
    setMuted(aud.muted);
    setVolume(Math.round(aud.vol * 100));

    return () => {
      ctrl.dispose();
      stageCtrlRef.current = null;
    };
  }, [dispatch, showToast]);

  // Sync current EngineState into 3D Stage Controller
  const beats = getBeatsForScene(engine.sceneId);
  const curBeat = beats[engine.beatIdx] || beats[0];
  const curLine = curBeat.lines[engine.lineIdx] || curBeat.lines[0];

  useEffect(() => {
    const ctrl = stageCtrlRef.current;
    if (!ctrl) return;
    const curSpeaker = curLine.kind === 'say' ? curLine.who : '';
    ctrl.syncState({
      mode: engine.mode,
      worldShift: engine.worldShift,
      sceneId: engine.sceneId,
      beatIdx: engine.beatIdx,
      lineIdx: engine.lineIdx,
      isFirstPerson: engine.isFirstPerson,
      consoleOpen: engine.consoleOpen,
      consoleTab: engine.consoleTab,
      styleIdx: engine.styleIdx,
      curSpeaker,
      castleReflection: curBeat.castleReflection,
      fpYaw: curBeat.fpYaw,
      fpPitch: curBeat.fpPitch,
      walkerX: engine.walker.x,
      walkerZ: engine.walker.z,
      walkerSpeed: engine.walker.speed,
    });
    setActiveLookKey(curBeat.lookKey);
  }, [
    engine.mode,
    engine.worldShift,
    engine.sceneId,
    engine.beatIdx,
    engine.lineIdx,
    engine.isFirstPerson,
    engine.consoleOpen,
    engine.consoleTab,
    engine.styleIdx,
    engine.walker.x,
    engine.walker.z,
    engine.walker.speed,
    curBeat.castleReflection,
    curBeat.fpYaw,
    curBeat.fpPitch,
    curBeat.lookKey,
    curLine.kind,
    curLine.who,
  ]);

  // Sync Character Studio rig selection
  useEffect(() => {
    if (engine.mode === 'studio' && stageCtrlRef.current) {
      stageCtrlRef.current.setStudioCharacter(engine.studioCharId, studioOutfit, studioPose);
    }
  }, [engine.mode, engine.studioCharId, studioOutfit, studioPose]);

  // Reset typewriter when beat or line changes
  const plainTextLen = curLine.html.replace(/<[^>]*>/g, '').length;
  useEffect(() => {
    setTypedChars(0);
  }, [engine.sceneId, engine.beatIdx, engine.lineIdx]);

  useEffect(() => {
    if (engine.mode !== 'playing') return;
    const iv = window.setInterval(() => {
      setTypedChars(prev => {
        if (prev < plainTextLen) return prev + 3;
        return prev;
      });
    }, 30);
    return () => window.clearInterval(iv);
  }, [engine.mode, plainTextLen]);

  useEffect(()=>{setLegacyOpen(true);setLegacyComplete(false);setMoved(false);},[engine.sceneId]);

  // Auto-advance timer when autoAdvance is enabled
  useEffect(() => {
    if (engine.mode !== 'playing' || !engine.autoAdvance || typedChars < plainTextLen) return;
    if(gamePaused||journey.phase!=='legacy'||!legacyOpen||legacyComplete)return;
    const tm = window.setTimeout(() => {
      if(gamePaused||journeyRef.current.phase!=='legacy')return;
      legacyAdvanceRef.current();
    }, 1500 + plainTextLen * 25);
    return () => window.clearTimeout(tm);
  }, [engine.mode, engine.autoAdvance, typedChars, plainTextLen, dispatch,gamePaused,journey.phase,legacyOpen,legacyComplete,graphicsOpen,confirmNew]);

  // Progressive chat replay timer
  useEffect(() => {
    if (visibleMsgCount >= activeChatList.length) return;
    const nextMsg = activeChatList[visibleMsgCount];
    const delay = 450 + (nextMsg ? nextMsg.text.length * 20 : 200);
    const tm = window.setTimeout(() => {
      setVisibleMsgCount(c => Math.min(activeChatList.length, c + 1));
    }, delay);
    return () => window.clearTimeout(tm);
  }, [visibleMsgCount, activeChatList]);

  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [visibleMsgCount, engine.consoleOpen, engine.consoleTab]);

  // Title menu ambient captions & subtle ghost-lettering drift
  useEffect(() => {
    if (engine.mode !== 'title') return;
    const capIv = window.setInterval(() => {
      setCaptionIdx(i => (i + 1) % AMBIENT_CAPTIONS.length);
    }, 6200);
    const driftIv = window.setInterval(() => {
      setTitleDrift(true);
      window.setTimeout(() => setTitleDrift(false), 1800);
    }, 8500);
    return () => {
      window.clearInterval(capIv);
      window.clearInterval(driftIv);
    };
  }, [engine.mode]);

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      const target=e.target as HTMLElement,k=e.key.toLowerCase();
      if(k==='escape'){
        if(graphicsOpen){e.preventDefault();e.stopPropagation();updatePreferences({...preferences,graphicsStyle:graphicsBefore.current});setGraphicsOpen(false);return;}if(confirmNew){e.preventDefault();e.stopPropagation();setConfirmNew(false);return;}if(controlsOpen){e.preventDefault();e.stopPropagation();setControlsOpen(false);return;}if(settingsOpen){e.preventDefault();e.stopPropagation();setSettingsOpen(false);return;}if(audienceSetup){e.preventDefault();e.stopPropagation();setAudienceSetup(false);return;}
        if(journeyRef.current.phase==='legacy'&&legacyOpen&&!engineRef.current.consoleOpen){e.preventDefault();e.stopPropagation();setLegacyOpen(false);return;}
        if(engineRef.current.mode==='title')return;e.preventDefault();
        if(gamePaused)resumeGame();else pauseGame();return;
      }
      if(gamePaused||settingsOpen||controlsOpen||graphicsOpen||confirmNew||['INPUT','SELECT','TEXTAREA','BUTTON','A'].includes(target?.tagName)||target?.isContentEditable||e.ctrlKey||e.metaKey||e.altKey)return;
      if(k==='m'){updatePreferences({...preferences,muted:!preferences.muted});return;}
      if(journeyRef.current.phase!=='legacy'){
        if(k==='enter'&&!e.repeat){e.preventDefault();if(engineRef.current.mode==='title')requestPlay();else if(journeyRef.current.phase==='dialogue')advanceRef.current();}
        if(k==='c'&&!e.repeat){if(journeyRef.current.phase==='chat')finishChat();else if(['ready','encounter'].includes(journeyRef.current.phase))void audienceRef.current?.leave();else interactionRef.current('console');}
        return;
      }
      if(engineRef.current.mode==='studio')return;
      if((k===' '||k==='enter')&&!e.repeat){e.preventDefault();if(legacyOpen)legacyAdvanceRef.current();else if(!legacyComplete)setLegacyOpen(true);}
      else if(k==='c')dispatch({type:'TOGGLE_CONSOLE'});else if(k==='v')dispatch({type:'TOGGLE_POV'});
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[gamePaused,settingsOpen,controlsOpen,audienceSetup,preferences,typedChars,plainTextLen,legacyOpen,legacyComplete,graphicsOpen,confirmNew]);

  function updatePreferences(p:Preferences){stageCtrlRef.current?.unlockAudio();setPreferences(p);savePreferences(p);setMuted(p.muted);setVolume(p.volume);}
  function openGraphics(play=false){pendingPlay.current=play;graphicsBefore.current=preferences.graphicsStyle;setGraphicsOpen(true);}
  function requestPlay(){if(checkpoint.current){setConfirmNew(true);return;}if(!preferences.graphicsChosen){openGraphics(true);return;}startJourney();}
  async function restoreCheckpoint(){const c=checkpoint.current;if(!c)return;await audienceRef.current?.leave();setEngine({...c.engine,mode:'playing',styleIdx:preferences.graphicsStyle});sendJourney({type:'RESTORE',journey:resumeJourney(c.journey)});setSummary(c.summary);setLegacyComplete(false);setGamePaused(false);}
  function startJourney(){setGamePaused(false);setSummary(null);setAudienceSetup(false);let fresh={...createInitialEngineState(false),styleIdx:preferences.graphicsStyle};for(const action of [{type:'START_SCENE',sceneId:1},{type:'TOGGLE_CONSOLE',force:false}] as EngineAction[]){const next=reduceEngineState(fresh,action);if(next.ok)fresh=next.value;}setEngine(fresh);sendJourney({type:'PLAY'});stageCtrlRef.current?.unlockAudio();}
  function finishChat(){dispatch({type:'SELECT_BEAT',beatIdx:1});dispatch({type:'TOGGLE_CONSOLE',force:false});sendJourney({type:'CHAT_DONE'});}
  function interact(key:string){
    const j=journeyRef.current;if(j.phase!=='world'||gamePaused)return;
    stageCtrlRef.current?.lookToward(key);
    if(key==='window'){sendJourney({type:'INTERACT',key});return;}
    if(key!==['mum','driver','console'][j.objective])return;
    dispatch({type:'SELECT_BEAT',beatIdx:j.objective+1});
    if(key==='console')dispatch({type:'TOGGLE_CONSOLE',force:true,tab:'game'});
    sendJourney({type:'INTERACT',key});
  }
  interactionRef.current=interact;
  function advanceDialogue(){const e=engineRef.current,beat=getBeatsForScene(e.sceneId)[e.beatIdx];if(e.lineIdx<beat.lines.length-1)dispatch({type:'NEXT_LINE'});else sendJourney({type:'DIALOGUE_DONE'});}
  advanceRef.current=advanceDialogue;
  function pauseGame(){setGamePaused(true);if(['ready','encounter'].includes(journeyRef.current.phase))audienceRef.current?.pause();}
  function resumeGame(){if(journeyRef.current.phase==='encounter')void audienceRef.current?.resume();else setGamePaused(false);}
  function openSettings(){if(engineRef.current.mode==='playing')pauseGame();setSettingsOpen(true);}
  function returnTitle(){if(['ready','encounter'].includes(journeyRef.current.phase))void audienceRef.current?.leave();sendJourney({type:'TITLE'});dispatch({type:'OPEN_TITLE',section:'home'});setGamePaused(false);}
  function closeConsole(){if(journeyRef.current.phase==='chat')finishChat();else if(['encounter','ready'].includes(journeyRef.current.phase))void audienceRef.current?.leave();else dispatch({type:'TOGGLE_CONSOLE',force:false});}
  useEffect(()=>{document.body.dataset.journey=journey.phase;document.documentElement.dataset.reducedMotion=String(preferences.reducedMotion);document.documentElement.style.setProperty('--dialogue-scale',String(preferences.textScale));stageCtrlRef.current?.applyPreferences(preferences);setMuted(preferences.muted);setVolume(preferences.volume);setEngine(e=>e.styleIdx===preferences.graphicsStyle?e:{...e,styleIdx:preferences.graphicsStyle});},[preferences,journey.phase]);
  useEffect(()=>{stageCtrlRef.current?.setPaused(gamePaused||settingsOpen||controlsOpen||graphicsOpen||confirmNew||journey.phase==='ready'||(journey.phase==='legacy'&&legacyOpen&&!engine.consoleOpen));document.body.dataset.gamePaused=String(gamePaused);},[gamePaused,settingsOpen,controlsOpen,journey.phase,legacyOpen,engine.consoleOpen,graphicsOpen,confirmNew]);
  useEffect(()=>{const blur=()=>{if(engineRef.current.mode==='playing')pauseGame();};window.addEventListener('blur',blur);const hidden=()=>{if(document.hidden)blur();};document.addEventListener('visibilitychange',hidden);return()=>{window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden);};},[]);

  useEffect(()=>{if(engine.mode==='playing'&&!['title','legacy'].includes(journey.phase)){checkpoint.current={engine,journey,summary};setHasCheckpoint(true);}},[engine,journey,summary]);
  useEffect(()=>{document.body.dataset.graphicsPreview=String(graphicsOpen);},[graphicsOpen]);
  const handleAdvanceClick = () => {
    if(gamePaused||settingsOpen||controlsOpen||graphicsOpen||confirmNew||legacyComplete)return;
    stageCtrlRef.current?.playBlip(560);
    const action=legacyAdvance({scene:engine.sceneId,beat:engine.beatIdx,line:engine.lineIdx,beatCount:beats.length,lineCount:curBeat.lines.length,typing:typedChars<plainTextLen});
    if(action==='finish-text'){setTypedChars(plainTextLen);return;}
    if(action==='complete'){setLegacyOpen(false);setLegacyComplete(true);dispatch({type:'TOGGLE_CONSOLE',force:false});return;}
    dispatch({type:'NEXT_LINE'});
    if(action==='next-beat')setLegacyOpen(Boolean(beats[engine.beatIdx+1]?.openConsole));
  };
  legacyAdvanceRef.current=handleAdvanceClick;

  const isSceneEnd =
    engine.beatIdx === beats.length - 1 && engine.lineIdx === curBeat.lines.length - 1;

  const speakerClass =
    curLine.who.toLowerCase().includes('aunt')
      ? 'aunt'
      : curLine.who.toLowerCase();

  const studioCharDef = defs.find((d: any) => d.id === engine.studioCharId) || defs[0];
  const studioPoseKeys = Object.keys(studioCharDef.an || { Idle: true });

  return (
    <>
      <AudiencePanel ref={audienceRef} stage={stageCtrlRef} mode={audienceSetup?'setup':journey.phase==='ready'?'ready':journey.phase==='encounter'?'active':'hidden'} onStart={()=>{sendJourney({type:'BEGIN'});setGamePaused(false);}} onFinish={stats=>{setSummary(stats);sendJourney({type:'FINISH'});dispatch({type:'TOGGLE_CONSOLE',force:false});setGamePaused(false);}} onLeave={()=>{sendJourney({type:'CLOSE_CONSOLE'});dispatch({type:'TOGGLE_CONSOLE',force:false});setGamePaused(false);}} onPaused={setGamePaused} onDismiss={()=>setAudienceSetup(false)} onSettings={openSettings}/>
      <JourneyUI journey={journey} engine={engine} line={curLine} summary={summary} onRead={()=>{sendJourney({type:'READ_CHAT'});dispatch({type:'TOGGLE_CONSOLE',force:true,tab:'chat'});}} onChatDone={finishChat} onInteract={interact} onDialogue={advanceDialogue} onReflect={()=>{sendJourney({type:'REFLECT'});dispatch({type:'SELECT_BEAT',beatIdx:4});}} onTitle={returnTitle} onReplay={startJourney} onWider={()=>{sendJourney({type:'LEGACY'});dispatch({type:'SELECT_BEAT',beatIdx:4,atEnd:true});dispatch({type:'NEXT_LINE'});}}/>
      {engine.mode==='playing'&&<header className="experience-header"><div><b>The Night Car</b><span>{journey.phase==='legacy'?`Story archive · Scene ${engine.sceneId}`:journey.phase==='encounter'?'Console controls · A D / W / S / F':engine.consoleOpen?'Ethan’s console · world input suspended':'Ethan’s world · drag to look · E to interact'}</span></div><nav><button onClick={()=>{pauseGame();setControlsOpen(true);}}>Controls</button><button onClick={openSettings}>Settings</button><button onClick={()=>gamePaused?resumeGame():pauseGame()}>{gamePaused?'Resume':'Pause'} <kbd>Esc</kbd></button></nav></header>}
      {gamePaused&&!settingsOpen&&!controlsOpen&&engine.mode==='playing'&&<PauseMenu onResume={resumeGame} onSettings={openSettings} onControls={()=>setControlsOpen(true)} onTitle={returnTitle} onConsole={journey.phase==='encounter'?()=>void audienceRef.current?.leave():undefined}/>}
      {settingsOpen&&<Settings preferences={preferences} onChange={updatePreferences} onClose={()=>setSettingsOpen(false)} onControls={()=>setControlsOpen(true)}/>}
      {controlsOpen&&<Controls onClose={()=>setControlsOpen(false)}/>}

      {journey.phase==='legacy'&&engine.mode==='playing'&&!engine.consoleOpen&&!legacyOpen&&!legacyComplete&&<section className="legacy-objective" aria-label="Next objective"><span>Explore: {curBeat.lookKey==='memory'?'Mum’s memory':curBeat.lookKey}. Drag to look; E examines nearby objects.</span><button className="paper-button" onClick={()=>setLegacyOpen(true)}>Continue story</button></section>}
      {journey.phase==='legacy'&&legacyComplete&&<section className="story-caption" aria-label="Story complete"><h2>Scenes I–IV complete</h2><p>You have reached the end of the available story.</p><button className="paper-button" onClick={returnTitle}>Return to title</button></section>}
      {journey.phase==='legacy'&&engine.consoleOpen&&<p className="legacy-practice">Practice: move A/D, jump W, block S, slash F. No win target. Defeat retries after two seconds. Close the console to continue the story.</p>}
      {graphicsOpen&&<GraphicsChooser startPlay={pendingPlay.current} style={preferences.graphicsStyle} onSelect={graphicsStyle=>updatePreferences({...preferences,graphicsStyle})} onCancel={()=>{updatePreferences({...preferences,graphicsStyle:graphicsBefore.current});setGraphicsOpen(false);}} onConfirm={()=>{updatePreferences({...preferences,graphicsChosen:true});setGraphicsOpen(false);if(pendingPlay.current)startJourney();}}/>}
      {confirmNew&&<ConfirmNewChapter onCancel={()=>setConfirmNew(false)} onConfirm={()=>{setConfirmNew(false);if(!preferences.graphicsChosen)openGraphics(true);else startJourney();}}/>}
      {journey.phase==='legacy'&&hasCheckpoint&&engine.mode==='playing'&&<button className="back-to-chapter" onClick={restoreCheckpoint}>Back to chapter</button>}
      {/* FULL-BLEED 3D INK-AND-GOUACHE STAGE */}
      <div id="stage" ref={stageRef} className="m3" />
      <div id="vignette" />
      <div id="grain" />

      {engine.mode==='title'&&<TitleScreen onPlay={requestPlay} onGraphics={()=>openGraphics(false)} onContinue={hasCheckpoint?restoreCheckpoint:undefined} onSettings={openSettings} onControls={()=>setControlsOpen(true)} onAudience={()=>setAudienceSetup(true)} onArchive={id=>{setLegacyOpen(true);setLegacyComplete(false);sendJourney({type:'LEGACY'});dispatch({type:'START_SCENE',sceneId:id});setGamePaused(false);}} onStudio={()=>{sendJourney({type:'LEGACY'});dispatch({type:'OPEN_STUDIO',charId:'ethan'});}}/>}

      {/* ====================================================================
          2. CLEAN IN-SCENE HUD (Exact index (18).html layout, mode === 'playing')
          ==================================================================== */}
      {engine.mode === 'playing' && (
        <>
          <header id="hud">
            <div className="title">
              <b>
                {engine.sceneId === 1
                  ? 'The Night Car'
                  : engine.sceneId === 2
                  ? 'Pulling Up to the Old House'
                  : engine.sceneId === 3
                  ? 'Entering the Stinky House'
                  : 'Upstairs Bedroom & Torn Teddy'}
              </b>
              <span>
                Sun Up, Sun Down ·{' '}
                {engine.sceneId === 1
                  ? 'Scene I · 18:53'
                  : engine.sceneId === 2
                  ? 'Scene II · 21:43'
                  : engine.sceneId === 3
                  ? 'Scene III · 21:55'
                  : 'Scene IV · 22:30'}
              </span>
            </div>

            <div className="hud-right">
              <button
                className="ibtn"
                type="button"
                data-tip="Main Menu"
                aria-label="Open Main Menu"
                onClick={() => {
                  stageCtrlRef.current?.playBlip(520);
                  dispatch({ type: 'OPEN_TITLE', section: 'home' });
                }}
                dangerouslySetInnerHTML={{ __html: ICONS.home }}
              />
              <button
                className="ibtn"
                type="button"
                data-tip={`Switch Scene (S${engine.sceneId} → S${(engine.sceneId % 4) + 1})`}
                aria-label="Cycle through Scenes I to IV"
                onClick={() => {
                  stageCtrlRef.current?.playBlip(580);
                  const nextScene = ((engine.sceneId % 4) + 1) as 1 | 2 | 3 | 4;
                  dispatch({ type: 'START_SCENE', sceneId: nextScene });
                  const labels: Record<1 | 2 | 3 | 4, string> = {
                    1: 'Scene I · The Night Car (18:53)',
                    2: 'Scene II · Pulling Up to the Old House (21:43)',
                    3: 'Scene III · Entering the Stinky House (21:55)',
                    4: 'Scene IV · Upstairs Bedroom & Torn Teddy (22:30)',
                  };
                  showToast(labels[nextScene]);
                }}
                style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700 }}
              >
                {`S${engine.sceneId}`}
              </button>
              <button
                className={`ibtn ${engine.isFirstPerson ? 'active' : ''}`}
                id="btn-pov"
                type="button"
                data-tip={engine.isFirstPerson ? 'First-person · V' : 'Orbit car · V'}
                aria-label="Switch camera"
                onClick={() => dispatch({ type: 'TOGGLE_POV' })}
                dangerouslySetInnerHTML={{ __html: engine.isFirstPerson ? ICONS.eye : ICONS.cam }}
              />
              <button
                className={`ibtn ${engine.consoleOpen ? 'active' : 'unread'}`}
                id="btn-console"
                type="button"
                data-tip="Console · C"
                aria-label="Toggle console"
                onClick={() => dispatch({ type: 'TOGGLE_CONSOLE' })}
                dangerouslySetInnerHTML={{ __html: ICONS.pad }}
              />
              <button
                className="ibtn"
                id="btn-style"
                type="button"
                data-tip={STYLE_LABELS[engine.styleIdx]}
                aria-label="Change art style"
                onClick={() => {
                  const nextIdx = (engine.styleIdx + 1) % 4;
                  dispatch({ type: 'CYCLE_STYLE' });
                  showToast(STYLE_LABELS[nextIdx]);
                }}
                dangerouslySetInnerHTML={{ __html: ICONS.brush }}
              />
              <button
                className={`ibtn ${muted ? 'muted' : ''}`}
                id="btn-sound"
                type="button"
                data-tip={`${muted ? 'Sound off' : 'Sound on'} · M`}
                aria-label="Mute or unmute sound"
                aria-pressed={muted}
                onClick={() => {
                  updatePreferences({...preferences,muted:!preferences.muted});
                }}
                dangerouslySetInnerHTML={{ __html: muted ? ICONS.mute : ICONS.snd }}
              />
              <input
                id="vol"
                className="vol"
                type="range"
                min={0}
                max={100}
                value={volume}
                aria-label="Volume"
                onChange={e => {
                  const v = Number(e.target.value);
                  updatePreferences({...preferences,volume:v});
                }}
              />
            </div>
          </header>

          {engine.isFirstPerson && (
            <div
              id="reticle"
              className={hoveredHotspot ? 'hot' : ''}
              aria-hidden="true"
            />
          )}

          {engine.isFirstPerson && hoveredHotspot && !engine.consoleOpen && !(journey.phase==='legacy'&&legacyOpen) && (
            <div id="prompt">
              {hoveredHotspot.title}
              <small>E or click · {['mum','driver','aunt'].includes(hoveredHotspot.key)?'Talk':hoveredHotspot.key==='console'?'Open':'Examine'}</small>
            </div>
          )}

          {engine.isFirstPerson && !pointerLocked && !pointerLockFailed && !engine.consoleOpen && !moved && !(journey.phase==='legacy'&&legacyOpen) && (
            <div id="capture" className="pill">
              {(engine.sceneId === 2 && engine.beatIdx >= 2) ||
              engine.sceneId === 3 ||
              engine.sceneId === 4
                ? 'WASD / arrows move · Drag to look · E examines the highlighted object'
                : 'Click the scene to look around · Enter continues · Esc frees the mouse'}
            </div>
          )}

          <div id="toast" className={`pill ${toastMsg ? 'show' : ''}`} role="status">
            {toastMsg}
          </div>

          {engine.isFirstPerson && (
            <nav id="look-strip" aria-label="Look at">
              {(engine.sceneId === 1
                ? [
                    { key: 'console', tip: 'Console', icon: 'pad' },
                    { key: 'mum', tip: 'Mum', icon: 'user' },
                    { key: 'driver', tip: 'Sir (driver)', icon: 'car' },
                    { key: 'window', tip: 'Window', icon: 'win' },
                  ]
                : engine.sceneId === 2
                ? [
                    { key: 'driver', tip: 'Sir (driver)', icon: 'car' },
                    { key: 'aunt', tip: 'Aunt Momma', icon: 'user' },
                    { key: 'mum', tip: 'Mum Leaving', icon: 'car' },
                    { key: 'window', tip: 'Black & White House', icon: 'win' },
                  ]
                : engine.sceneId === 3
                ? [
                    { key: 'aunt', tip: 'Aunt Momma', icon: 'user' },
                    { key: 'floor', tip: 'Floor & Scrape', icon: 'eye' },
                    { key: 'table', tip: 'Soup, Soap & Plaster', icon: 'home' },
                    { key: 'stairs', tip: 'Upstairs Stairs', icon: 'win' },
                  ]
                : [
                    { key: 'bed', tip: 'Narrow Bed', icon: 'home' },
                    { key: 'teddy', tip: 'Torn Teddy Bear', icon: 'eye' },
                    { key: 'memory', tip: 'Mum’s Memory', icon: 'user' },
                    { key: 'window', tip: 'Rainy Window & Shadow', icon: 'win' },
                  ]
              ).map(item => (
                <button
                  key={item.key}
                  className={`ibtn look-btn ${activeLookKey === item.key ? 'on' : ''}`}
                  data-look={item.key}
                  data-tip={item.tip}
                  type="button"
                  onClick={() => {
                    setActiveLookKey(item.key);
                    stageCtrlRef.current?.lookToward(item.key);setLegacyOpen(true);
                    if (item.key === 'console') {
                      dispatch({ type: 'TOGGLE_CONSOLE', force: true, tab: 'game' });
                    } else if (engine.sceneId === 1) {
                      const s1BeatMap: Record<string, number> = { mum: 1, driver: 2, window: 4 };
                      if (s1BeatMap[item.key] !== undefined) {
                        dispatch({ type: 'SELECT_BEAT', beatIdx: s1BeatMap[item.key] });
                      }
                    } else if (engine.sceneId === 2) {
                      const s2BeatMap: Record<string, number> = { driver: 0, aunt: 2, mum: 3, window: 4 };
                      if (s2BeatMap[item.key] !== undefined) {
                        dispatch({ type: 'SELECT_BEAT', beatIdx: s2BeatMap[item.key] });
                      }
                    } else if (engine.sceneId === 3) {
                      const s3BeatMap: Record<string, number> = { aunt: 1, floor: 2, table: 3, stairs: 4 };
                      if (s3BeatMap[item.key] !== undefined) {
                        dispatch({ type: 'SELECT_BEAT', beatIdx: s3BeatMap[item.key] });
                      }
                    } else if (engine.sceneId === 4) {
                      const s4BeatMap: Record<string, number> = { bed: 0, teddy: 1, memory: 2, window: 4 };
                      if (s4BeatMap[item.key] !== undefined) {
                        dispatch({ type: 'SELECT_BEAT', beatIdx: s4BeatMap[item.key] });
                      }
                    }
                  }}
                  dangerouslySetInnerHTML={{ __html: ICONS[item.icon] }}
                />
              ))}
            </nav>
          )}
        </>
      )}

      {/* ====================================================================
          3. ETHAN'S HANDHELD CONSOLE DRAWER (Mounted always for canvas ref)
          ==================================================================== */}
      <aside
        id="console"
        className={engine.mode === 'playing' && engine.consoleOpen ? '' : 'off'}
        aria-label="Ethan's handheld console"
      >
        <div className="shell">
          <div className="grip L">
            <i className="stick" />
            <div className="dpad">
              <button
                className="dp u"
                id="sk-up"
                type="button"
                aria-label="Jump"
                onClick={() => stageCtrlRef.current?.triggerStickmanAct('jump')}
              >
                ▲
              </button>
              <button
                className="dp l"
                id="sk-l"
                type="button"
                aria-label="Left"
                onPointerDown={e => {
                  e.preventDefault();
                  stageCtrlRef.current?.setHoldKey('arrowleft', true);
                }}
                onPointerUp={() => stageCtrlRef.current?.setHoldKey('arrowleft', false)}
                onPointerLeave={() => stageCtrlRef.current?.setHoldKey('arrowleft', false)}
              >
                ◀
              </button>
              <button
                className="dp r"
                id="sk-r"
                type="button"
                aria-label="Right"
                onPointerDown={e => {
                  e.preventDefault();
                  stageCtrlRef.current?.setHoldKey('arrowright', true);
                }}
                onPointerUp={() => stageCtrlRef.current?.setHoldKey('arrowright', false)}
                onPointerLeave={() => stageCtrlRef.current?.setHoldKey('arrowright', false)}
              >
                ▶
              </button>
              <button
                className="dp d"
                id="sk-dn"
                type="button"
                aria-label="Block"
                onClick={() => stageCtrlRef.current?.triggerStickmanAct('block')}
              >
                ▼
              </button>
            </div>
          </div>

          <div className="mid">
            <div className="bezel">
              <div className="scr">
                <canvas
                  id="stickman-canvas"
                  ref={stickmanCanvasRef}
                  width={360}
                  height={200}
                  hidden={engine.consoleTab !== 'game'}
                />
                <div id="view-chat" hidden={engine.consoleTab !== 'chat'}>
                  <div className="chat-header">
                    <span>
                      <b>Sofi</b> · Lóže
                    </span>
                    <span>{engine.sceneId === 1 ? 'Today 18:53' : 'Today 21:43 (Offline)'}</span>
                  </div>
                  <div id="chat-log" ref={chatLogRef}>
                    {activeChatList.slice(0, visibleMsgCount).map((m, i) => {
                      const prev = activeChatList[i - 1];
                      const showWho = !prev || prev.from !== m.from || prev.time !== m.time;
                      return (
                        <div key={i} className={`c-msg ${m.from}`}>
                          {showWho && (
                            <div className="c-who">
                              {m.from === 'ethan' ? 'Ethan' : 'Sofi'}{' '}
                              {m.time === '21:43' ? '· 21:43 (No reply)' : ''}
                            </div>
                          )}
                          <div className="c-bub">{m.text}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="chat-foot">
                    <button
                      id="chat-replay"
                      type="button"
                      onClick={() => setVisibleMsgCount(1)}
                    >
                      ↺ Replay
                    </button>
                    <button
                      id="chat-all"
                      type="button"
                      onClick={() => setVisibleMsgCount(activeChatList.length)}
                    >
                      Skip ▸▸
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mbar">
              <div className="con-tabs">
                <button
                  className={`con-tab ${engine.consoleTab === 'game' ? 'on' : ''}`}
                  id="tab-game"
                  type="button"
                  onClick={() => dispatch({ type: 'SET_CONSOLE_TAB', tab: 'game' })}
                >
                  Game
                </button>
                <button
                  className={`con-tab ${engine.consoleTab === 'chat' ? 'on' : ''}`}
                  id="tab-chat"
                  type="button"
                  onClick={() => dispatch({ type: 'SET_CONSOLE_TAB', tab: 'chat' })}
                >
                  Chat ({activeChatList.length})
                </button>
              </div>
              <div id="console-clock-slot"/><span id="sk-score">Wins {stickmanWins}{journey.phase==='legacy'?' · Practice':' · bonus'}</span>
              <button
                className="con-tab"
                id="btn-close-console"
                type="button"
                aria-label="Put console down"
                onClick={closeConsole}
              >
                Close
              </button>
            </div>
            <p className="hint">← → move · W jump · F slash · S block</p>
          </div>

          <div className="grip R">
            <div className="abxy">
              <button
                className="fb x"
                id="sk-jmp"
                type="button"
                aria-label="Jump"
                onClick={() => stageCtrlRef.current?.triggerStickmanAct('jump')}
              >
                X
              </button>
              <button
                className="fb y"
                id="btn-y"
                type="button"
                aria-label="Toggle chat"
                onClick={() =>
                  dispatch({
                    type: 'SET_CONSOLE_TAB',
                    tab: engine.consoleTab === 'game' ? 'chat' : 'game',
                  })
                }
              >
                Y
              </button>
              <button
                className="fb a"
                id="sk-atk"
                type="button"
                aria-label="Slash"
                onClick={() => stageCtrlRef.current?.triggerStickmanAct('slash')}
              >
                A
              </button>
              <button
                className="fb b"
                id="sk-blk"
                type="button"
                aria-label="Block"
                onClick={() => stageCtrlRef.current?.triggerStickmanAct('block')}
              >
                B
              </button>
            </div>
            <i className="stick" />
          </div>
        </div>
      </aside>

      {/* ====================================================================
          4. BOTTOM DIALOGUE CARD (mode === 'playing')
          ==================================================================== */}
      {engine.mode === 'playing' && (journey.phase!=='legacy'||(legacyOpen&&!legacyComplete)) && (
        <section
          id="dialogue"
          className={curLine.kind}
          aria-live="polite"
          onClick={handleAdvanceClick}
        >
          {curLine.kind === 'say' && (
            <span id="speaker" className={speakerClass}>
              {curLine.who}
            </span>
          )}
          <p
            id="line"
            ref={lineElRef}
            dangerouslySetInnerHTML={{ __html: curLine.html }}
            style={{
              clipPath:
                typedChars < plainTextLen
                  ? `inset(0 ${Math.max(0, 100 - Math.round((typedChars / Math.max(1, plainTextLen)) * 100))}% 0 0)`
                  : undefined,
            }}
          />
          <div className="dlg-foot">
            <div id="dots" aria-label="Story beats">
              {beats.map((b, i) => (
                <i
                  key={b.id}
                  className={
                    i < engine.beatIdx ? 'done' : i === engine.beatIdx ? 'cur' : ''
                  }
                  onClick={e => {
                    e.stopPropagation();
                    dispatch({ type: 'SELECT_BEAT', beatIdx: i });
                  }}
                  style={{ cursor: 'pointer' }}
                  title={`Beat ${i + 1}`}
                />
              ))}
            </div>
            <div className="dlg-actions" onClick={e => e.stopPropagation()}>
              <span aria-label="Dialogue page">Page {engine.lineIdx+1}/{curBeat.lines.length}</span>
              {journey.phase==='legacy'&&<button className="dlg-btn" onClick={()=>setLegacyOpen(false)}>Close dialogue</button>}
              <button
                className="dlg-btn"
                id="btn-prev"
                type="button"
                disabled={engine.sceneId === 1 && engine.beatIdx === 0 && engine.lineIdx === 0}
                onClick={() => dispatch({ type: 'PREV_LINE' })}
              >
                ‹ Back
              </button>
              <button
                className={`dlg-btn ${engine.autoAdvance ? 'active' : ''}`}
                id="btn-auto"
                type="button"
                onClick={() => dispatch({ type: 'TOGGLE_AUTO' })}
              >
                {engine.autoAdvance ? 'Auto · On' : 'Auto'}
              </button>
              {engine.sceneId === 2 && isSceneEnd && (
                <button
                  className="dlg-btn"
                  type="button"
                  onClick={() => dispatch({ type: 'OPEN_STUDIO', charId: 'aunt' })}
                >
                  Character Studio (13)
                </button>
              )}
              <button
                className="dlg-btn primary"
                id="btn-next"
                type="button"
                title="Enter or Space"
                onClick={handleAdvanceClick}
              >
                <b id="next-lbl">
                  {engine.sceneId === 1 && isSceneEnd
                    ? 'Enter Scene II (21:43)'
                    : engine.sceneId === 2 && isSceneEnd
                    ? 'Enter Scene III'
                    : engine.sceneId===4&&isSceneEnd?'Finish chapter':'Continue'}
                </b>{' '}
                <span>▸</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ====================================================================
          5. PRESERVED 13-CHARACTER STUDIO OVERLAY (mode === 'studio')
          ==================================================================== */}
      {engine.mode === 'studio' && (
        <>
          <header id="hud">
            <div className="title">
              <b>Character Studio · {studioCharDef.n}</b>
              <span>{studioCharDef.r || 'Preserved 13-Rig Ink & Gouache Archive'} · Drag to Orbit</span>
            </div>
            <div className="hud-right">
              <button
                className="dlg-btn primary"
                type="button"
                onClick={() => dispatch({ type: 'OPEN_TITLE', section: 'home' })}
              >
                ‹ Back to Main Menu
              </button>
              <button
                className="dlg-btn"
                type="button"
                onClick={() => dispatch({ type: 'START_SCENE', sceneId: 1 })}
              >
                Scene I
              </button>
              <button
                className="dlg-btn"
                type="button"
                onClick={() => dispatch({ type: 'START_SCENE', sceneId: 2 })}
              >
                Scene II
              </button>
            </div>
          </header>

          <section
            id="dialogue"
            style={{ cursor: 'default', width: 'min(920px, 94vw)' }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {defs.map((d: any) => (
                <button
                  key={d.id}
                  type="button"
                  className={`dlg-btn ${engine.studioCharId === d.id ? 'primary' : ''}`}
                  onClick={() => {
                    setStudioOutfit(0);
                    setStudioPose('Idle');
                    dispatch({ type: 'SELECT_STUDIO_CHAR', charId: d.id });
                  }}
                >
                  {d.n || d.name}
                </button>
              ))}
            </div>
            <div className="dlg-foot">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--gold)' }}>
                  POSE:
                </span>
                {studioPoseKeys.map(pk => (
                  <button
                    key={pk}
                    type="button"
                    className={`dlg-btn ${studioPose === pk ? 'active' : ''}`}
                    onClick={() => setStudioPose(pk)}
                  >
                    {pk}
                  </button>
                ))}
              </div>
              {studioCharDef.outfits && studioCharDef.outfits.length > 1 && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--gold)' }}>
                    OUTFIT:
                  </span>
                  {studioCharDef.outfits.map((o: any, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      className={`dlg-btn ${studioOutfit === idx ? 'active' : ''}`}
                      onClick={() => setStudioOutfit(idx)}
                    >
                      {o.name || `Outfit ${idx + 1}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
