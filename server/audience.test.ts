import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudienceDirector, parseCommand } from './audience.ts';

test('only strict aid commands are accepted', () => {
  assert.equal(parseCommand(' !SHIELD '), 'shield');
  assert.equal(parseCommand('!torch'), 'torch');
  for (const value of [null, {}, '!shield now', '!torch\n!shield', '!build a', '!harm', 'x'.repeat(600)]) assert.equal(parseCommand(value), null);
});
function setup(source: 'LIVE'|'DEMO'|'OFFLINE'='DEMO') {
  let time=0; const director=new AudienceDirector(()=>time); director.setSource(source);
  return {director, at:(n:number)=>{time=n; director.tick();}};
}
function vote(d:AudienceDirector, id:string, viewer:string, value='shield', source='DEMO', receivedAt=0) {
  return d.accept({eventId:id,broadcasterId:'123',viewerIdHash:viewer,receivedAt,source,type:'KNIGHT_AID',value,voteWindowId:d.snapshot().window?.id});
}
test('first vote per viewer and duplicate delivery never inflate counts', () => {
  const {director:d}=setup(); d.open(); assert.equal(vote(d,'1','a'),true);
  assert.equal(vote(d,'1','b'),false); assert.equal(vote(d,'2','a','torch'),false);
  assert.deepEqual(d.snapshot().window?.tally,{shield:1,torch:0});
});
test('majority, deterministic tie, zero viewers fallback, and one resolution', () => {
  for(const [values,winner] of [[['torch','torch','shield'],'torch'],[['torch','shield'],'shield'],[[],'shield']] as const) {
    const {director:d,at}=setup(); d.open(); values.forEach((v,i)=>vote(d,String(i),String(i),v));
    at(12000); assert.equal(d.snapshot().result?.value,winner); assert.equal(d.snapshot().result?.fallback,values.length===0);
    const id=d.snapshot().result?.id; at(13000); assert.equal(d.snapshot().result?.id,id);
  }
});
test('paused time does not consume window and paused votes rejected', () => {
  const {director:d,at}=setup(); d.open(); at(4000); d.setPaused(true); at(24000);
  assert.equal(d.snapshot().window?.remainingMs,8000); assert.equal(vote(d,'x','x'),false);
  d.setPaused(false); at(31999); assert.equal(d.snapshot().result,null); at(32000); assert.equal(d.snapshot().result?.value,'shield');
});
test('deadline, stale window, malformed events and source mixing rejected', () => {
  const {director:d,at}=setup(); const old=d.open(); d.cancel(); d.open();
  assert.equal(d.accept({eventId:'1',broadcasterId:'123',viewerIdHash:'a',receivedAt:0,source:'DEMO',type:'KNIGHT_AID',value:'shield',voteWindowId:old.id}),false);
  assert.equal(vote(d,'2','b','shield','LIVE'),false);
  assert.equal(d.accept(null),false); assert.equal(d.accept({}),false);
  assert.equal(vote(d,'3','c','harm'),false); at(12000); assert.equal(vote(d,'4','d'),false);
});
test('disconnect cancels window and pending result; reconnect does not replay', () => {
  const {director:d,at}=setup('LIVE'); d.open(); vote(d,'live','a','torch','LIVE');
  d.setSource('OFFLINE'); assert.equal(d.snapshot().window,null); at(20000); assert.equal(d.snapshot().result,null);
  d.setSource('LIVE'); d.open(); assert.equal(vote(d,'live','a','torch','LIVE',20000),false);
});
test('cooldown survives round restart and resets safely after it elapses', () => {
  const {director:d,at}=setup(); d.open(); vote(d,'1','a'); d.cancel(); d.open();
  assert.equal(vote(d,'2','a'),false); at(751); assert.equal(vote(d,'3','a','torch','DEMO',751),true);
});
test('old event times, excessive ids and future timestamps are rejected', () => {
  const {director:d,at}=setup(); at(10000); d.open();
  assert.equal(vote(d,'1','a','shield','DEMO',0),false);
  assert.equal(vote(d,'x'.repeat(300),'a','shield','DEMO',10000),false);
  assert.equal(vote(d,'2','a','shield','DEMO',100000),false);
});
