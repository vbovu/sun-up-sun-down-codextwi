import test from 'node:test';import assert from 'node:assert/strict';
import {resumeJourney} from './recovery';import {initialJourney} from './journey';import {lookDelta,normalizePreferences} from './preferences';
test('captured and dragged mouse have coherent angular sensitivity',()=>assert.deepEqual(lookDelta(40,20,{sensitivity:1,invertY:false},true),lookDelta(40,20,{sensitivity:1,invertY:false},false)));
test('combat checkpoint resumes at console ready and preserves the story objective',()=>{const j={...initialJourney,phase:'encounter' as const,objective:2};assert.deepEqual(resumeJourney(j),{...j,phase:'ready'});assert.equal(resumeJourney({...j,phase:'ending'}).phase,'ending');});
test('graphics preferences clamp and only mark a deliberate choice',()=>{assert.equal(normalizePreferences({graphicsStyle:99,graphicsChosen:true}).graphicsStyle,3);assert.equal(normalizePreferences(null).graphicsChosen,false);});
