/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Ok,
  Err,
  Some,
  None,
  unwrapOr,
  createChannel,
  sendChannel,
  drainChannel,
  computeNoseVertex,
  springStep,
  CHAT_1853,
  CHAT_2143,
  SCENE_1_BEATS,
  SCENE_2_BEATS,
  SCENE_3_BEATS,
  SCENE_4_BEATS,
  createInitialEngineState,
  reduceEngineState,
} from './engine.ts';

test('Rust-inspired Result<T, E>, Option<T>, and deterministic MPSC channel queue', () => {
  const okVal = Ok(42);
  assert.equal(okVal.ok, true);
  if (okVal.ok) assert.equal(okVal.value, 42);

  const errVal = Err('channel closed');
  assert.equal(errVal.ok, false);

  assert.equal(unwrapOr(Some('Lóže'), 'Katomos'), 'Lóže');
  assert.equal(unwrapOr(None, 'Katomos'), 'Katomos');

  let ch = createChannel<string>();
  ch = sendChannel(ch, 'beat:0', 100);
  ch = sendChannel(ch, 'beat:1', 200);
  assert.equal(ch.queue.length, 2);
  assert.equal(ch.queue[0].seq, 1);
  assert.equal(ch.queue[1].seq, 2);

  const drained = drainChannel(ch);
  assert.equal(drained.messages.length, 2);
  assert.equal(drained.channel.queue.length, 0);
  assert.equal(drained.channel.nextSeq, 3);
});

test('Finite-safe computeNoseVertex never produces NaN even when apex y slightly exceeds hSpan * 0.5', () => {
  const vApexOvershoot = computeNoseVertex(0.01, 0.01900001, 0.01, 1.0, 1.0, true);
  assert.equal(Number.isFinite(vApexOvershoot.x), true);
  assert.equal(Number.isFinite(vApexOvershoot.y), true);
  assert.equal(Number.isFinite(vApexOvershoot.z), true);

  const vAdult = computeNoseVertex(-0.012, -0.025, 0.014, 1.1, 1.05, false);
  assert.equal(Number.isFinite(vAdult.x), true);
  assert.equal(Number.isFinite(vAdult.z), true);
});

test('Critically damped springStep converges smoothly to goal without NaN or overshoot', () => {
  let val = 0;
  let vel = 0;
  const goal = 1.25;
  for (let i = 0; i < 60; i++) {
    const next = springStep(val, vel, goal, 12.0, 1 / 60);
    assert.equal(Number.isFinite(next.value), true);
    assert.equal(Number.isFinite(next.velocity), true);
    assert.equal(next.value <= goal + 1e-6, true);
    val = next.value;
    vel = next.velocity;
  }
  assert.equal(Math.abs(val - goal) < 0.01, true);
});

test('Canon invariant: 38 verbatim 18:53 chat messages and Scene 1 -> Scene 2 -> Scene 3 -> Scene 4 progression', () => {
  assert.equal(CHAT_1853.length, 38);
  assert.equal(CHAT_1853[0].text, 'Hi');
  assert.equal(CHAT_1853[31].text, 'lets swap I give u blue 🦊');
  assert.equal(CHAT_1853[32].text, 'Fine I give u my green 🐺');
  assert.equal(CHAT_1853[37].text, 'Okay bye');
  assert.equal(CHAT_2143.length, 2);
  assert.equal(CHAT_2143[1].text, 'Hi when is sun up?');

  let state = createInitialEngineState(false);
  assert.equal(state.mode, 'title');
  assert.equal(state.foxSwapAgreed, true);
  assert.equal(state.foxTransferred, false);
  assert.equal(state.tummyScrape, false);

  const started = reduceEngineState(state, { type: 'START_SCENE', sceneId: 1 });
  assert.equal(started.ok, true);
  if (!started.ok) return;
  state = started.value;
  assert.equal(state.mode, 'playing');
  assert.equal(state.sceneId, 1);

  // Step through all lines of Scene 1 until it transitions into Scene 2
  const totalS1Lines = SCENE_1_BEATS.reduce((acc, b) => acc + b.lines.length, 0);
  for (let i = 0; i < totalS1Lines; i++) {
    const r = reduceEngineState(state, { type: 'NEXT_LINE' });
    assert.equal(r.ok, true);
    if (r.ok) state = r.value;
  }

  // Should now be at Scene 2, Beat 0, Line 0 ("Get up. You're home now.")
  assert.equal(state.sceneId, 2);
  assert.equal(state.beatIdx, 0);
  assert.equal(state.lineIdx, 0);
  assert.equal(SCENE_2_BEATS[0].lines[0].html.includes('Get up'), true);

  // Step through all lines of Scene 2 until it transitions into Scene 3
  const totalS2Lines = SCENE_2_BEATS.reduce((acc, b) => acc + b.lines.length, 0);
  for (let i = 0; i < totalS2Lines; i++) {
    const r = reduceEngineState(state, { type: 'NEXT_LINE' });
    assert.equal(r.ok, true);
    if (r.ok) state = r.value;
  }
  assert.equal(state.scene2Completed, true);
  assert.equal(state.sceneId, 3);
  assert.equal(state.beatIdx, 0);
  assert.equal(SCENE_3_BEATS[0].lines[1].html.includes('poop'), true);

  // Step through all lines of Scene 3 until it transitions into Scene 4
  const totalS3Lines = SCENE_3_BEATS.reduce((acc, b) => acc + b.lines.length, 0);
  for (let i = 0; i < totalS3Lines; i++) {
    const r = reduceEngineState(state, { type: 'NEXT_LINE' });
    assert.equal(r.ok, true);
    if (r.ok) state = r.value;
  }
  assert.equal(state.tummyScrape, true);
  assert.equal(state.sceneId, 4);
  assert.equal(state.beatIdx, 0);
  assert.equal(SCENE_4_BEATS[1].lines[0].html.includes('teddy bear'), true);

  // Step to the final line of Scene 4
  const totalS4Lines = SCENE_4_BEATS.reduce((acc, b) => acc + b.lines.length, 0);
  for (let i = 0; i < totalS4Lines - 1; i++) {
    const r = reduceEngineState(state, { type: 'NEXT_LINE' });
    assert.equal(r.ok, true);
    if (r.ok) state = r.value;
  }
  assert.equal(state.sceneId, 4);
  assert.equal(state.beatIdx, SCENE_4_BEATS.length - 1);
  assert.equal(state.scene4Completed, true);
  assert.equal(state.foxTransferred, false);
});
