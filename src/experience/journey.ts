export type Phase='title'|'intro'|'chat'|'world'|'dialogue'|'ready'|'encounter'|'outcome'|'ending'|'legacy';
export interface Journey {phase:Phase;objective:number;dialogueBeat:1|2;windowInspected:boolean;}
export const initialJourney:Journey={phase:'title',objective:0,dialogueBeat:1,windowInspected:false};
export type JourneyAction={type:'PLAY'|'READ_CHAT'|'CHAT_DONE'|'DIALOGUE_DONE'|'BEGIN'|'FINISH'|'REFLECT'|'TITLE'|'LEGACY'|'CLOSE_CONSOLE'}|{type:'INTERACT';key:string}|{type:'RESTORE';journey:Journey};
/** Presentation order only. Authoritative story data, world movement and combat stay in existing engines. */
export function journeyReducer(s:Journey,a:JourneyAction):Journey {
 if(a.type==='RESTORE')return {...a.journey};
 if(a.type==='TITLE')return {...initialJourney};
 if(a.type==='PLAY')return {...initialJourney,phase:'intro'};
 if(a.type==='LEGACY')return {...s,phase:'legacy'};
 if(a.type==='READ_CHAT'&&s.phase==='intro')return {...s,phase:'chat'};
 if(a.type==='CHAT_DONE'&&s.phase==='chat')return {...s,phase:'world'};
 if(a.type==='INTERACT'&&s.phase==='world') {
  if(a.key==='window')return {...s,windowInspected:true};
  if(s.objective===0&&a.key==='mum')return {...s,phase:'dialogue',dialogueBeat:1};
  if(s.objective===1&&a.key==='driver')return {...s,phase:'dialogue',dialogueBeat:2};
  if(s.objective===2&&a.key==='console')return {...s,phase:'ready'};
 }
 if(a.type==='DIALOGUE_DONE'&&s.phase==='dialogue')return {...s,phase:'world',objective:s.dialogueBeat};
 if(a.type==='BEGIN'&&s.phase==='ready')return {...s,phase:'encounter'};
 if(a.type==='CLOSE_CONSOLE'&&['encounter','ready'].includes(s.phase))return {...s,phase:'world',objective:2};
 if(a.type==='FINISH'&&s.phase==='encounter')return {...s,phase:'outcome'};
 if(a.type==='REFLECT'&&s.phase==='outcome')return {...s,phase:'ending'};
 return s;
}
