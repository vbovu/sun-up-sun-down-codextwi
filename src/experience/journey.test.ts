import {test} from 'node:test';import assert from 'node:assert/strict';
import {initialJourney,journeyReducer as reduce} from './journey.ts';
test('short chapter follows authored conversation, Mum, driver, console, outcome, reflection',()=>{
 let s=reduce(initialJourney,{type:'PLAY'});assert.equal(s.phase,'intro');
 s=reduce(s,{type:'READ_CHAT'});assert.equal(s.phase,'chat');s=reduce(s,{type:'CHAT_DONE'});
 assert.equal(reduce(s,{type:'INTERACT',key:'console'}).phase,'world');
 s=reduce(s,{type:'INTERACT',key:'mum'});assert.equal(s.dialogueBeat,1);s=reduce(s,{type:'DIALOGUE_DONE'});
 assert.equal(s.objective,1);assert.equal(reduce(s,{type:'INTERACT',key:'mum'}).phase,'world');
 s=reduce(s,{type:'INTERACT',key:'driver'});assert.equal(s.dialogueBeat,2);s=reduce(s,{type:'DIALOGUE_DONE'});
 s=reduce(s,{type:'INTERACT',key:'console'});assert.equal(s.phase,'ready');s=reduce(s,{type:'BEGIN'});
 s=reduce(s,{type:'FINISH'});assert.equal(s.phase,'outcome');s=reduce(s,{type:'REFLECT'});assert.equal(s.phase,'ending');
 assert.deepEqual(reduce(s,{type:'TITLE'}),initialJourney);
});
test('close combat returns to console objective without restarting story; replay resets presentation only',()=>{
 const s={...initialJourney,phase:'encounter' as const,objective:2};assert.equal(reduce(s,{type:'CLOSE_CONSOLE'}).objective,2);assert.equal(reduce(s,{type:'CLOSE_CONSOLE'}).phase,'world');
 assert.equal(reduce(s,{type:'PLAY'}).phase,'intro');assert.equal(reduce(s,{type:'PLAY'}).objective,0);
});
