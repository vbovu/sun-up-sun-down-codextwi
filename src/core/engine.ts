/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure Functional & Rust-Inspired Concurrency/State Engine for Sun Up, Sun Down
 * Covers:
 * - Result<T, E> and Option<T> algebraic data types
 * - Deterministic MPSC-style Channel Queue for non-blocking concurrent events
 * - Pure immutable state transitions for Title Menu (PHERSU-inspired), Scene I (18:53 Night Car),
 *   Scene II (21:43 Arrival at the Black-and-White House), and Character Studio (13 preserved rigs)
 * - Finite-safe 3D geometry math (computeNoseVertex) & critically-damped spring physics (springStep)
 */

// ============================================================================
// 1. RUST-INSPIRED ALGEBRAIC TYPES (Result<T, E> & Option<T>)
// ============================================================================
export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const Ok = <T>(value: T): Result<T, never> => Object.freeze({ ok: true, value });
export const Err = <E = string>(error: E): Result<never, E> => Object.freeze({ ok: false, error });

export type Option<T> =
  | { readonly some: true; readonly value: T }
  | { readonly some: false };

export const Some = <T>(value: T): Option<T> => Object.freeze({ some: true, value });
export const None: Option<never> = Object.freeze({ some: false });

export function unwrapOr<T>(opt: Option<T>, fallback: T): T {
  return opt.some ? opt.value : fallback;
}

// ============================================================================
// 2. DETERMINISTIC ACTOR / CHANNEL QUEUE (Rust mpsc::channel style)
// ============================================================================
export interface ChannelMessage<T> {
  readonly seq: number;
  readonly timestampMs: number;
  readonly payload: T;
}

export interface ChannelState<T> {
  readonly nextSeq: number;
  readonly queue: readonly ChannelMessage<T>[];
}

export function createChannel<T>(): ChannelState<T> {
  return Object.freeze({ nextSeq: 1, queue: Object.freeze([]) });
}

export function sendChannel<T>(
  ch: ChannelState<T>,
  payload: T,
  timestampMs = 0
): ChannelState<T> {
  const msg: ChannelMessage<T> = Object.freeze({
    seq: ch.nextSeq,
    timestampMs,
    payload,
  });
  return Object.freeze({
    nextSeq: ch.nextSeq + 1,
    queue: Object.freeze([...ch.queue, msg]),
  });
}

export function drainChannel<T>(
  ch: ChannelState<T>
): { readonly messages: readonly ChannelMessage<T>[]; readonly channel: ChannelState<T> } {
  return Object.freeze({
    messages: ch.queue,
    channel: Object.freeze({ nextSeq: ch.nextSeq, queue: Object.freeze([]) }),
  });
}

// ============================================================================
// 3. FINITE-SAFE MATH & CRITICALLY DAMPED SPRING STEP
// ============================================================================
export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Number.isFinite(v) ? v : min));

/**
 * Finite-safe nose vertex deformation (fixes floating-point negative base in Math.pow
 * when y slightly exceeds hSpan * 0.5 at the cone apex).
 */
export function computeNoseVertex(
  x: number,
  y: number,
  z: number,
  wScale = 1.0,
  lScale = 1.0,
  isKid = false
): { readonly x: number; readonly y: number; readonly z: number } {
  const hSpan = Math.max(1e-6, (isKid ? 0.038 : 0.050) * lScale);
  const t = clamp((hSpan * 0.5 - y) / hSpan, 0, 1);
  const outZ =
    z > 0
      ? z + Math.pow(t, isKid ? 1.45 : 1.0) * (isKid ? 0.016 : 0.013) * lScale
      : z * 0.22;
  const outX = x * (0.48 + 0.62 * Math.pow(t, 1.3));
  return Object.freeze({
    x: Number.isFinite(outX) ? outX : 0,
    y: Number.isFinite(y) ? y : 0,
    z: Number.isFinite(outZ) ? outZ : 0,
  });
}

/**
 * Exact analytical solution for a critically damped spring:
 * x'' + 2 * omega * x' + omega^2 * (x - goal) = 0
 * Never overshoots and remains unconditionally stable across any dt > 0.
 */
export function springStep(
  value: number,
  velocity: number,
  goal: number,
  omega: number,
  dt: number
): { readonly value: number; readonly velocity: number } {
  const safeDt = clamp(dt, 0, 0.25);
  const safeOmega = Math.max(0.001, omega);
  const x = value - goal;
  const e = Math.exp(-safeOmega * safeDt);
  const tmp = (velocity + safeOmega * x) * safeDt;
  const nextVel = (velocity - safeOmega * tmp) * e;
  const nextVal = goal + (x + tmp) * e;
  return Object.freeze({
    value: Number.isFinite(nextVal) ? nextVal : goal,
    velocity: Number.isFinite(nextVel) ? nextVel : 0,
  });
}

// ============================================================================
// 4. VERBATIM CANON DATA: SCENE I (18:53) & SCENE II (21:43)
// ============================================================================
export interface ChatMessage {
  readonly from: 'ethan' | 'sofi';
  readonly text: string;
  readonly time: '18:53' | '21:43';
}

export const CHAT_1853: readonly ChatMessage[] = Object.freeze([
  { from: 'ethan', text: 'Hi', time: '18:53' },
  { from: 'sofi',  text: 'Hi', time: '18:53' },
  { from: 'ethan', text: 'Hw r u', time: '18:53' },
  { from: 'ethan', text: 'ok', time: '18:53' },
  { from: 'sofi',  text: 'good', time: '18:53' },
  { from: 'ethan', text: '😊', time: '18:53' },
  { from: 'ethan', text: 'I am Ethan', time: '18:53' },
  { from: 'sofi',  text: 'Me. Sofi', time: '18:53' },
  { from: 'ethan', text: 'Haha. You almost sound like Sofa. Haha', time: '18:53' },
  { from: 'sofi',  text: 'No not funny😡', time: '18:53' },
  { from: 'ethan', text: 'sorry', time: '18:53' },
  { from: 'sofi',  text: 'it fine', time: '18:53' },
  { from: 'sofi',  text: 'Where u from', time: '18:53' },
  { from: 'ethan', text: 'Katomos', time: '18:53' },
  { from: 'sofi',  text: 'I from Lóže', time: '18:53' },
  { from: 'ethan', text: 'I am 10', time: '18:53' },
  { from: 'sofi',  text: 'I am 11. My birthday will make me 12', time: '18:53' },
  { from: 'ethan', text: 'My birthday is past', time: '18:53' },
  { from: 'sofi',  text: 'My birthday is when tommrw is finish😊', time: '18:53' },
  { from: 'ethan', text: 'happy birthday happy 😄', time: '18:53' },
  { from: 'sofi',  text: 'Thanks 😊', time: '18:53' },
  { from: 'ethan', text: 'Sofa? Can I ask some thg', time: '18:53' },
  { from: 'sofi',  text: 'Sofi 😡', time: '18:53' },
  { from: 'ethan', text: 'sorry sofi can we be friends?', time: '18:53' },
  { from: 'sofi',  text: 'No😡', time: '18:53' },
  { from: 'ethan', text: 'why please', time: '18:53' },
  { from: 'sofi',  text: 'becus u call me sofa', time: '18:53' },
  { from: 'ethan', text: 'I not call u that again', time: '18:53' },
  { from: 'sofi',  text: 'fine I your friend but u must give me purple 🐉', time: '18:53' },
  { from: 'ethan', text: 'I have no dragon but I have a blue 🦊', time: '18:53' },
  { from: 'sofi',  text: 'I have green 🐺', time: '18:53' },
  { from: 'ethan', text: 'lets swap I give u blue 🦊', time: '18:53' },
  { from: 'sofi',  text: 'Fine I give u my green 🐺', time: '18:53' },
  { from: 'ethan', text: 'Yay', time: '18:53' },
  { from: 'sofi',  text: 'we friends now I play when sun is up I play and I type you', time: '18:53' },
  { from: 'ethan', text: 'I play when sun is down and I type to you too 😊', time: '18:53' },
  { from: 'sofi',  text: 'Okay bye bye dont forget i play sun up', time: '18:53' },
  { from: 'ethan', text: 'Okay bye', time: '18:53' },
]);

export const CHAT_2143: readonly ChatMessage[] = Object.freeze([
  { from: 'ethan', text: 'Hi', time: '21:43' },
  { from: 'ethan', text: 'Hi when is sun up?', time: '21:43' },
]);

export type LineKind = 'narr' | 'think' | 'say';

export interface DialogueLine {
  readonly who: string;
  readonly html: string;
  readonly kind: LineKind;
}

export interface StoryBeat {
  readonly id: number;
  readonly sceneId: 1 | 2 | 3 | 4;
  readonly lookKey: string;
  readonly fpYaw: number;
  readonly fpPitch: number;
  readonly openConsole: boolean;
  readonly conTab: 'game' | 'chat' | null;
  readonly castleReflection: boolean;
  readonly lines: readonly DialogueLine[];
}

export const SCENE_1_BEATS: readonly StoryBeat[] = Object.freeze([
  {
    id: 0,
    sceneId: 1,
    lookKey: 'console',
    fpYaw: 0.08,
    fpPitch: -0.28,
    openConsole: true,
    conTab: 'chat',
    castleReflection: false,
    lines: [
      { who: 'n', html: 'I was bored, so I played games.', kind: 'narr' },
      {
        who: 'n',
        html: 'On the screen, <strong>Sofi</strong> from Lóže, where the sun is up, and I agreed to swap my <em>blue 🦊</em> for her <em>green 🐺</em>.',
        kind: 'narr',
      },
      { who: 't', html: '“I play when sun is down and I type to you too 😊”', kind: 'think' },
      { who: 't', html: 'But first… I need to ask Mum for ice cream.', kind: 'think' },
    ],
  },
  {
    id: 1,
    sceneId: 1,
    lookKey: 'mum',
    fpYaw: 1.25,
    fpPitch: -0.05,
    openConsole: false,
    conTab: null,
    castleReflection: false,
    lines: [
      { who: 'Ethan', html: '‘Mum I am hungry. Can I have ice cream’', kind: 'say' },
      { who: 'n', html: 'She said nothing. I think she was sleeping.', kind: 'narr' },
    ],
  },
  {
    id: 2,
    sceneId: 1,
    lookKey: 'driver',
    fpYaw: 0.66,
    fpPitch: -0.02,
    openConsole: false,
    conTab: null,
    castleReflection: false,
    lines: [
      { who: 'Ethan', html: '‘Sir. Can I have ice cream?’', kind: 'say' },
      { who: 'Sir', html: '“Ask ur stupid mum for ice cream. I’m driving”', kind: 'say' },
      { who: 'Ethan', html: '‘Okay.’', kind: 'say' },
      { who: 't', html: 'I don’t think I can ask her. She’s only sleeping.', kind: 'think' },
      { who: 't', html: 'I play my games, I will get food maybe tommrw.', kind: 'think' },
    ],
  },
  {
    id: 3,
    sceneId: 1,
    lookKey: 'console',
    fpYaw: -0.45,
    fpPitch: -0.16,
    openConsole: true,
    conTab: 'game',
    castleReflection: false,
    lines: [
      {
        who: 'n',
        html: 'I played my game and looked out the car window then I played my game then looked out the castle window.',
        kind: 'narr',
      },
      {
        who: 't',
        html: 'I love to be a knight who is stronger than a king and can win in a fight.',
        kind: 'think',
      },
    ],
  },
  {
    id: 4,
    sceneId: 1,
    lookKey: 'window',
    fpYaw: -1.38,
    fpPitch: -0.01,
    openConsole: false,
    conTab: null,
    castleReflection: true,
    lines: [
      {
        who: 't',
        html: '<strong>I love to be a knight. I am so cool, strong and amazing....</strong>',
        kind: 'think',
      },
      {
        who: 'n',
        html: 'End of Scene I · Continue to Scene II: Pulling Up to the Old House (21:43)',
        kind: 'narr',
      },
    ],
  },
]);

export const SCENE_2_BEATS: readonly StoryBeat[] = Object.freeze([
  {
    id: 0,
    sceneId: 2,
    lookKey: 'driver',
    fpYaw: 0.58,
    fpPitch: -0.04,
    openConsole: false,
    conTab: null,
    castleReflection: false,
    lines: [
      { who: 'Sir', html: '“Get up. You’re home now.”', kind: 'say' },
      {
        who: 'n',
        html: 'I woke up and my eyes were itchy. I scratched them and looked out the normal car window.',
        kind: 'narr',
      },
    ],
  },
  {
    id: 1,
    sceneId: 2,
    lookKey: 'driver',
    fpYaw: 0.64,
    fpPitch: -0.02,
    openConsole: false,
    conTab: null,
    castleReflection: false,
    lines: [
      {
        who: 'Sir',
        html: '“Ethan you wasting my time, get your sleeping donkey self out of my car. I need to collect other customers you know.”',
        kind: 'say',
      },
      { who: 'Ethan', html: '‘im sorry my eyes hurt.’', kind: 'say' },
      {
        who: 'Sir',
        html: '“because you have been sleeping throughout the car trip with your stupid games playing that same annoying sound over and over again.”',
        kind: 'say',
      },
    ],
  },
  {
    id: 2,
    sceneId: 2,
    lookKey: 'aunt',
    fpYaw: -1.57,
    fpPitch: 0.02,
    openConsole: false,
    conTab: null,
    castleReflection: false,
    lines: [
      {
        who: 'n',
        html: 'The driver came out of the car and picked me up and put me down. I almost fell when somebody caught me.',
        kind: 'narr',
      },
      { who: 'Aunt Momma', html: '“Ethan dear, be careful.”', kind: 'say' },
      { who: 'Ethan', html: '‘Where is mum going?’', kind: 'say' },
    ],
  },
  {
    id: 3,
    sceneId: 2,
    lookKey: 'mum',
    fpYaw: 0.38,
    fpPitch: -0.02,
    openConsole: false,
    conTab: null,
    castleReflection: false,
    lines: [
      {
        who: 'n',
        html: 'I looked at the car and the driver got in and drove away with my still sleeping mother in the back seat.',
        kind: 'narr',
      },
      { who: 'Aunt Momma', html: '“Let’s forget about that dear, come.”', kind: 'say' },
    ],
  },
  {
    id: 4,
    sceneId: 2,
    lookKey: 'window',
    fpYaw: -1.62,
    fpPitch: 0.06,
    openConsole: false,
    conTab: null,
    castleReflection: false,
    lines: [
      {
        who: 'n',
        html: 'She took me to a big house. It was painted black and white and had two stories and a dog. It was not like my dog. My dog was orange and could shoot fire.',
        kind: 'narr',
      },
      {
        who: 'Aunt Momma',
        html: '“Welcome to your new home, Ethan. How do you love this home?”',
        kind: 'say',
      },
      {
        who: 'n',
        html: 'She opened the door and a stinky smell came out of the house. <strong>Continue to Scene III: Entering the Stinky House</strong>',
        kind: 'narr',
      },
    ],
  },
]);

export const SCENE_3_BEATS: readonly StoryBeat[] = Object.freeze([
  {
    id: 0,
    sceneId: 3,
    lookKey: 'aunt',
    fpYaw: 0.0,
    fpPitch: 0.02,
    openConsole: false,
    conTab: null,
    castleReflection: false,
    lines: [
      {
        who: 'n',
        html: 'We stepped inside the front hallway. The air was thick and green and smelled terrible.',
        kind: 'narr',
      },
      { who: 'Ethan', html: '‘It smells like poop.’', kind: 'say' },
      {
        who: 'Aunt Momma',
        html: '“Ethan! Don’t say such things! Now I’m going to wash your mouth with soap!”',
        kind: 'say',
      },
      { who: 'Ethan', html: '‘Sorry.’', kind: 'say' },
    ],
  },
  {
    id: 1,
    sceneId: 3,
    lookKey: 'aunt',
    fpYaw: 0.0,
    fpPitch: -0.08,
    openConsole: false,
    conTab: null,
    castleReflection: false,
    lines: [
      {
        who: 'n',
        html: 'She knelt down on one knee in front of me, almost like a knight, and held my shoulders with tears in her eyes.',
        kind: 'narr',
      },
      {
        who: 'Aunt Momma',
        html: '“Oh dear, it’s okay. You are home now dear. I’m your momma now. You can call me Aunt Momma.”',
        kind: 'say',
      },
      { who: 'Ethan', html: '‘Where is my real mum?’', kind: 'say' },
      {
        who: 'Aunt Momma',
        html: '“Your real mum is sleeping, dear. She needs to rest for a very, very long time.”',
        kind: 'say',
      },
    ],
  },
  {
    id: 2,
    sceneId: 3,
    lookKey: 'floor',
    fpYaw: 0.24,
    fpPitch: -0.14,
    openConsole: false,
    conTab: null,
    castleReflection: false,
    lines: [
      {
        who: 'n',
        html: 'I didn’t want to stay inside the stinky house. So I fell on the floor on purpose so I could go to the hospital and see my mum.',
        kind: 'narr',
      },
      { who: 'Ethan', html: '‘Ow! My tummy hurts! I fell!’', kind: 'say' },
      {
        who: 'n',
        html: 'My tummy was bleeding a little bit where I scratched it against the floorboards.',
        kind: 'narr',
      },
    ],
  },
  {
    id: 3,
    sceneId: 3,
    lookKey: 'table',
    fpYaw: 0.70,
    fpPitch: -0.05,
    openConsole: false,
    conTab: null,
    castleReflection: false,
    lines: [
      {
        who: 'Aunt Momma',
        html: '“Oh my poor baby! You don’t need a hospital for a little scratch. Aunt Momma will put a plaster on your tummy and make you some hot soup.”',
        kind: 'say',
      },
      {
        who: 'n',
        html: 'She put a sticky bandage on my tummy side and set a steaming pot of weird smelly soup on the table. I didn’t eat it.',
        kind: 'narr',
      },
      {
        who: 'Aunt Momma',
        html: '“No games at night, dear. Go upstairs to your bedroom and go to sleep.”',
        kind: 'say',
      },
    ],
  },
  {
    id: 4,
    sceneId: 3,
    lookKey: 'stairs',
    fpYaw: -0.53,
    fpPitch: 0.10,
    openConsole: false,
    conTab: null,
    castleReflection: false,
    lines: [
      {
        who: 'n',
        html: 'I hid my console deep in my pocket and walked toward the creaky wooden stairs.',
        kind: 'narr',
      },
      {
        who: 't',
        html: 'I will go upstairs, wait until it is quiet, and check if Sofi wrote back. <strong>Continue to Scene IV: Upstairs Bedroom</strong>',
        kind: 'think',
      },
    ],
  },
]);

export const SCENE_4_BEATS: readonly StoryBeat[] = Object.freeze([
  {
    id: 0,
    sceneId: 4,
    lookKey: 'bed',
    fpYaw: 0.0,
    fpPitch: -0.06,
    openConsole: false,
    conTab: null,
    castleReflection: false,
    lines: [
      {
        who: 'n',
        html: 'Upstairs, my new bedroom had peeling wallpaper, a narrow wooden bed, and a window rattling in the rain.',
        kind: 'narr',
      },
      {
        who: 'n',
        html: 'I sat by the bed. My tummy still stung under the sticky plaster.',
        kind: 'narr',
      },
    ],
  },
  {
    id: 1,
    sceneId: 4,
    lookKey: 'teddy',
    fpYaw: 0.0,
    fpPitch: -0.16,
    openConsole: false,
    conTab: null,
    castleReflection: false,
    lines: [
      {
        who: 'n',
        html: 'On the pillow sat an old brown teddy bear. One of its black button eyes hung by a loose thread, and grey stuffing was spilling out of its torn tummy.',
        kind: 'narr',
      },
      {
        who: 'Ethan',
        html: '‘You have a hurt tummy too, just like me.’',
        kind: 'say',
      },
    ],
  },
  {
    id: 2,
    sceneId: 4,
    lookKey: 'memory',
    fpYaw: 0.70,
    fpPitch: 0.0,
    openConsole: false,
    conTab: null,
    castleReflection: false,
    lines: [
      {
        who: 'n',
        html: 'I closed my eyes and remembered my real mum in her warm cardigan. She still felt like home.',
        kind: 'narr',
      },
      {
        who: 'n',
        html: 'Then I remembered the night before the car ride, when I heard her crying softly in the dark while she packed my bag.',
        kind: 'narr',
      },
      {
        who: 'Ethan',
        html: '‘Mum… please wake up and come get me.’',
        kind: 'say',
      },
    ],
  },
  {
    id: 3,
    sceneId: 4,
    lookKey: 'console',
    fpYaw: 0.0,
    fpPitch: -0.22,
    openConsole: true,
    conTab: 'chat',
    castleReflection: false,
    lines: [
      {
        who: 'n',
        html: 'Under the blanket, I opened my console to the chat with <strong>Sofi</strong>: <em>21:43 — “Heyy” / “I am home now.”</em> Still no reply.',
        kind: 'narr',
      },
      {
        who: 't',
        html: 'I’m not a princess. I’m Knight Ethan. Knights don’t cry.',
        kind: 'think',
      },
    ],
  },
  {
    id: 4,
    sceneId: 4,
    lookKey: 'window',
    fpYaw: -0.73,
    fpPitch: 0.04,
    openConsole: false,
    conTab: null,
    castleReflection: false,
    lines: [
      {
        who: 'n',
        html: 'The rain tapped against the bedroom window like claws. My itchy eyes grew heavy, and the shadow of the torn teddy bear stretched across the wall like giant wings.',
        kind: 'narr',
      },
      {
        who: 'n',
        html: 'Outside in the dark, a colossal shadow with a glowing green eye began to breathe pink and blue fire… <strong>End of Scene IV (Scenes I–IV Complete)</strong>',
        kind: 'narr',
      },
    ],
  },
]);

export function getBeatsForScene(sceneId: 1 | 2 | 3 | 4): readonly StoryBeat[] {
  if (sceneId === 1) return SCENE_1_BEATS;
  if (sceneId === 2) return SCENE_2_BEATS;
  if (sceneId === 3) return SCENE_3_BEATS;
  return SCENE_4_BEATS;
}

export function getInitialWalkerForScene(sceneId: 1 | 2 | 3 | 4, beatIdx = 0): WalkerState {
  if (sceneId === 2) {
    return beatIdx >= 4
      ? Object.freeze({ x: -3.55, z: -1.15, yaw: -1.62, speed: 0 })
      : Object.freeze({ x: -2.15, z: -1.05, yaw: -1.57, speed: 0 });
  }
  if (sceneId === 3) {
    if (beatIdx === 4) return Object.freeze({ x: -0.45, z: -1.20, yaw: -0.53, speed: 0 });
    if (beatIdx >= 2) return Object.freeze({ x: 0.0, z: -1.60, yaw: beatIdx === 3 ? 0.70 : 0.24, speed: 0 });
    return Object.freeze({ x: 0.0, z: -1.80, yaw: 0.0, speed: 0 });
  }
  if (sceneId === 4) {
    if (beatIdx === 1) return Object.freeze({ x: 0.0, z: -0.55, yaw: 0.0, speed: 0 });
    if (beatIdx === 2) return Object.freeze({ x: 0.0, z: -1.25, yaw: 0.70, speed: 0 });
    if (beatIdx === 3) return Object.freeze({ x: 0.0, z: -0.85, yaw: 0.0, speed: 0 });
    if (beatIdx === 4) return Object.freeze({ x: -0.25, z: -1.10, yaw: -0.73, speed: 0 });
    return Object.freeze({ x: 0.0, z: -1.55, yaw: 0.0, speed: 0 });
  }
  return Object.freeze({ x: -2.15, z: -0.95, yaw: -1.15, speed: 0 });
}

// ============================================================================
// 5. PURE FUNCTIONAL ENGINE STATE & REDUCER
// ============================================================================
export type AppMode = 'title' | 'playing' | 'studio';
export type MenuSection = 'home' | 'scenes' | 'settings' | 'credits';
export type WorldShift = 'sun_down' | 'sun_up';

export interface WalkerState {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly speed: number;
}

export interface EngineState {
  readonly mode: AppMode;
  readonly menuSection: MenuSection;
  readonly worldShift: WorldShift;
  readonly sceneId: 1 | 2 | 3 | 4;
  readonly beatIdx: number;
  readonly lineIdx: number;
  readonly isFirstPerson: boolean;
  readonly consoleOpen: boolean;
  readonly consoleTab: 'game' | 'chat';
  readonly styleIdx: number;
  readonly autoAdvance: boolean;
  readonly foxSwapAgreed: boolean;
  readonly foxTransferred: boolean;
  readonly tummyScrape: boolean;
  readonly scene2Completed: boolean;
  readonly scene4Completed: boolean;
  readonly studioCharId: string;
  readonly walker: WalkerState;
}

export type EngineAction =
  | { readonly type: 'START_SCENE'; readonly sceneId: 1 | 2 | 3 | 4 }
  | { readonly type: 'OPEN_TITLE'; readonly section?: MenuSection }
  | { readonly type: 'SET_MENU_SECTION'; readonly section: MenuSection }
  | { readonly type: 'TOGGLE_WORLD_SHIFT' }
  | { readonly type: 'OPEN_STUDIO'; readonly charId?: string }
  | { readonly type: 'SELECT_STUDIO_CHAR'; readonly charId: string }
  | { readonly type: 'NEXT_LINE' }
  | { readonly type: 'PREV_LINE' }
  | { readonly type: 'SELECT_BEAT'; readonly beatIdx: number; readonly atEnd?: boolean }
  | { readonly type: 'TOGGLE_POV'; readonly force?: boolean }
  | { readonly type: 'TOGGLE_CONSOLE'; readonly force?: boolean; readonly tab?: 'game' | 'chat' }
  | { readonly type: 'SET_CONSOLE_TAB'; readonly tab: 'game' | 'chat' }
  | { readonly type: 'CYCLE_STYLE' }
  | { readonly type: 'TOGGLE_AUTO' }
  | { readonly type: 'STEP_WALKER'; readonly moveForward: number; readonly moveStrafe: number; readonly yaw: number; readonly dt: number };

export function createInitialEngineState(autostart = false): EngineState {
  const b0 = SCENE_1_BEATS[0];
  return Object.freeze({
    mode: autostart ? 'playing' : 'title',
    menuSection: 'home',
    worldShift: 'sun_down',
    sceneId: 1,
    beatIdx: 0,
    lineIdx: 0,
    isFirstPerson: true,
    consoleOpen: autostart ? b0.openConsole : false,
    consoleTab: b0.conTab || 'chat',
    styleIdx: 0,
    autoAdvance: false,
    // Canon invariant: In Scene 1 (18:53), Ethan and Sofi AGREE to swap Blue Fox for Green Wolf,
    // but the actual Fox transfer happens later on Oct 28 08:15.
    foxSwapAgreed: true,
    foxTransferred: false,
    tummyScrape: false,
    scene2Completed: false,
    scene4Completed: false,
    studioCharId: 'ethan',
    walker: Object.freeze({ x: -2.15, z: -0.95, yaw: -1.15, speed: 0 }),
  });
}

export function reduceEngineState(
  state: EngineState,
  action: EngineAction
): Result<EngineState, string> {
  switch (action.type) {
    case 'START_SCENE': {
      const beats = getBeatsForScene(action.sceneId);
      const b0 = beats[0];
      return Ok(
        Object.freeze({
          ...state,
          mode: 'playing',
          sceneId: action.sceneId,
          beatIdx: 0,
          lineIdx: 0,
          consoleOpen: b0.openConsole,
          consoleTab: b0.conTab || state.consoleTab,
          tummyScrape: action.sceneId >= 4 ? true : state.tummyScrape,
          walker: getInitialWalkerForScene(action.sceneId, 0),
        })
      );
    }

    case 'OPEN_TITLE':
      return Ok(
        Object.freeze({
          ...state,
          mode: 'title',
          menuSection: action.section || 'home',
          consoleOpen: false,
        })
      );

    case 'SET_MENU_SECTION':
      return Ok(
        Object.freeze({
          ...state,
          menuSection: action.section,
        })
      );

    case 'TOGGLE_WORLD_SHIFT':
      return Ok(
        Object.freeze({
          ...state,
          worldShift: state.worldShift === 'sun_down' ? 'sun_up' : 'sun_down',
        })
      );

    case 'OPEN_STUDIO':
      return Ok(
        Object.freeze({
          ...state,
          mode: 'studio',
          studioCharId: action.charId || state.studioCharId,
          consoleOpen: false,
        })
      );

    case 'SELECT_STUDIO_CHAR':
      return Ok(
        Object.freeze({
          ...state,
          studioCharId: action.charId,
        })
      );

    case 'SELECT_BEAT': {
      const beats = getBeatsForScene(state.sceneId);
      const idx = clamp(action.beatIdx, 0, beats.length - 1);
      const b = beats[idx];
      const lineIdx = action.atEnd ? b.lines.length - 1 : 0;
      const isS2End = state.sceneId === 2 && idx === beats.length - 1 && lineIdx === b.lines.length - 1;
      const isS4End = state.sceneId === 4 && idx === beats.length - 1 && lineIdx === b.lines.length - 1;
      const hasScrape =
        state.tummyScrape ||
        state.sceneId === 4 ||
        (state.sceneId === 3 && idx >= 2);
      const nextWalker = getInitialWalkerForScene(state.sceneId, idx);
      return Ok(
        Object.freeze({
          ...state,
          beatIdx: idx,
          lineIdx,
          consoleOpen: b.openConsole,
          consoleTab: b.conTab || state.consoleTab,
          tummyScrape: hasScrape,
          scene2Completed: state.scene2Completed || isS2End,
          scene4Completed: state.scene4Completed || isS4End,
          walker: nextWalker,
        })
      );
    }

    case 'NEXT_LINE': {
      const beats = getBeatsForScene(state.sceneId);
      const curBeat = beats[state.beatIdx];
      if (!curBeat) return Err('Invalid beat index');

      if (state.lineIdx < curBeat.lines.length - 1) {
        const nextLineIdx = state.lineIdx + 1;
        const isS2End =
          state.sceneId === 2 &&
          state.beatIdx === beats.length - 1 &&
          nextLineIdx === curBeat.lines.length - 1;
        const isS4End =
          state.sceneId === 4 &&
          state.beatIdx === beats.length - 1 &&
          nextLineIdx === curBeat.lines.length - 1;
        return Ok(
          Object.freeze({
            ...state,
            lineIdx: nextLineIdx,
            scene2Completed: state.scene2Completed || isS2End,
            scene4Completed: state.scene4Completed || isS4End,
          })
        );
      }

      if (state.beatIdx < beats.length - 1) {
        return reduceEngineState(state, { type: 'SELECT_BEAT', beatIdx: state.beatIdx + 1 });
      }

      // Seamless multi-scene progression: Scene I -> Scene II -> Scene III -> Scene IV
      if (state.sceneId === 1) {
        return reduceEngineState(state, { type: 'START_SCENE', sceneId: 2 });
      }
      if (state.sceneId === 2) {
        return reduceEngineState(
          Object.freeze({ ...state, scene2Completed: true }),
          { type: 'START_SCENE', sceneId: 3 }
        );
      }
      if (state.sceneId === 3) {
        return reduceEngineState(
          Object.freeze({ ...state, tummyScrape: true }),
          { type: 'START_SCENE', sceneId: 4 }
        );
      }

      // At the end of Scene IV -> mark Scene IV complete and wrap to Beat 0 of Scene IV on replay
      return Ok(
        Object.freeze({
          ...state,
          beatIdx: 0,
          lineIdx: 0,
          scene4Completed: true,
          walker: getInitialWalkerForScene(4, 0),
        })
      );
    }

    case 'PREV_LINE': {
      if (state.lineIdx > 0) {
        return Ok(
          Object.freeze({
            ...state,
            lineIdx: state.lineIdx - 1,
          })
        );
      }
      if (state.beatIdx > 0) {
        return reduceEngineState(state, {
          type: 'SELECT_BEAT',
          beatIdx: state.beatIdx - 1,
          atEnd: true,
        });
      }
      if (state.sceneId > 1) {
        const prevScene = (state.sceneId - 1) as 1 | 2 | 3;
        const prevBeats = getBeatsForScene(prevScene);
        const lastIdx = prevBeats.length - 1;
        const lastBeat = prevBeats[lastIdx];
        return Ok(
          Object.freeze({
            ...state,
            sceneId: prevScene,
            beatIdx: lastIdx,
            lineIdx: lastBeat.lines.length - 1,
            consoleOpen: lastBeat.openConsole,
            walker: getInitialWalkerForScene(prevScene, lastIdx),
          })
        );
      }
      return Ok(state);
    }

    case 'TOGGLE_POV': {
      const nextFp = action.force !== undefined ? action.force : !state.isFirstPerson;
      return Ok(Object.freeze({ ...state, isFirstPerson: nextFp }));
    }

    case 'TOGGLE_CONSOLE': {
      const nextOpen = action.force !== undefined ? action.force : !state.consoleOpen;
      return Ok(
        Object.freeze({
          ...state,
          consoleOpen: nextOpen,
          consoleTab: action.tab || state.consoleTab,
        })
      );
    }

    case 'SET_CONSOLE_TAB':
      return Ok(Object.freeze({ ...state, consoleTab: action.tab }));

    case 'CYCLE_STYLE':
      return Ok(Object.freeze({ ...state, styleIdx: (state.styleIdx + 1) % 4 }));

    case 'TOGGLE_AUTO':
      return Ok(Object.freeze({ ...state, autoAdvance: !state.autoAdvance }));

    case 'STEP_WALKER': {
      const dt = clamp(action.dt, 0, 0.1);
      const speed = 2.8;
      const sinY = Math.sin(action.yaw);
      const cosY = Math.cos(action.yaw);
      const vx = (sinY * action.moveForward - cosY * action.moveStrafe) * speed;
      const vz = (cosY * action.moveForward + sinY * action.moveStrafe) * speed;
      const minX = state.sceneId === 3 ? -3.4 : state.sceneId === 4 ? -3.0 : -10.5;
      const maxX = state.sceneId === 3 ? 3.4 : state.sceneId === 4 ? 3.0 : 4.5;
      const minZ = state.sceneId === 3 ? -3.2 : state.sceneId === 4 ? -2.8 : -8.5;
      const maxZ = state.sceneId === 3 ? 3.8 : state.sceneId === 4 ? 3.0 : 8.5;
      const nx = clamp(state.walker.x + vx * dt, minX, maxX);
      const nz = clamp(state.walker.z + vz * dt, minZ, maxZ);
      return Ok(
        Object.freeze({
          ...state,
          walker: Object.freeze({
            x: nx,
            z: nz,
            yaw: action.yaw,
            speed: Math.hypot(vx, vz),
          }),
        })
      );
    }

    default:
      return Err('Unknown action');
  }
}
