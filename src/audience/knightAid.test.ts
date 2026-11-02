import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aidDamage,stepAid,type KnightAid} from './knightAid.ts';
test('torch changes real slash damage and expires in active simulation time',()=>{
 let aid:KnightAid={value:'torch',remaining:8};assert.equal(aidDamage(aid),35);
 aid=stepAid(aid,7);assert.equal(aidDamage(aid),35);aid=stepAid(aid,1);assert.equal(aid,null);assert.equal(aidDamage(aid),25);
});
test('shield does not buff attacks, and paused time preserves duration',()=>{
 const aid:KnightAid={value:'shield',remaining:8};assert.equal(aidDamage(aid),25);assert.deepEqual(stepAid(aid,0),aid);
});
