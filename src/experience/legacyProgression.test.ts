import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyAdvance} from './legacyProgression';
test('legacy Continue finishes text, advances one page, then closes/advances or completes',()=>{
 const p={scene:4,beat:4,line:0,beatCount:5,lineCount:2,typing:true};
 assert.equal(legacyAdvance(p),'finish-text');
 assert.equal(legacyAdvance({...p,typing:false}),'next-page');
 assert.equal(legacyAdvance({...p,typing:false,line:1}),'complete');
 assert.equal(legacyAdvance({...p,typing:false,line:1,beat:2}),'next-beat');
 assert.equal(legacyAdvance({...p,typing:false,line:1,scene:3}),'next-scene');
});
