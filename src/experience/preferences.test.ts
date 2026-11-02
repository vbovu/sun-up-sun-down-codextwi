import {test} from 'node:test';import assert from 'node:assert/strict';
import {normalizePreferences,lookDelta,normalizedAxes,DEFAULT_PREFERENCES} from './preferences.ts';
test('preferences clamp values and never preserve secrets or unknown keys',()=>{
 const p=normalizePreferences({sensitivity:99,textScale:0,volume:-2,invertY:true,token:'secret'});
 assert.equal(p.sensitivity,2.5);assert.equal(p.textScale,1);assert.equal(p.volume,0);assert.equal(p.invertY,true);assert.ok(!('token' in p));
 assert.deepEqual(normalizePreferences(null),DEFAULT_PREFERENCES);
});
test('sensitivity changes actual look deltas and invert reverses vertical only',()=>{
 const base=lookDelta(10,10,{sensitivity:1,invertY:false},true),fast=lookDelta(10,10,{sensitivity:2,invertY:true},true);
 assert.equal(fast.yaw,base.yaw*2);assert.equal(fast.pitch,-base.pitch*2);
});
test('diagonal movement uses the same input magnitude as straight movement',()=>{
 assert.deepEqual(normalizedAxes(1,0),{forward:1,strafe:0});const diagonal=normalizedAxes(1,1);assert.ok(Math.abs(Math.hypot(diagonal.forward,diagonal.strafe)-1)<1e-10);assert.deepEqual(normalizedAxes(0,0),{forward:0,strafe:0});
});
