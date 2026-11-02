// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 3D Stage & World Controller for Sun Up, Sun Down
 * - Scene I (18:53): The Night Car (exact index (18).html spacious executive sedan, live mirror,
 *   Stickman Knight console canvas mirroring, rain, highway, castle arch window reflection)
 * - Scene II (21:43): Pulling Up to the Old House (two-story black-and-white painted house,
 *   yard dog, Aunt Momma catching Ethan at the curb, Driver driving off with sleeping Mum,
 *   stinky front door opening, and smooth WASD/Arrow walking exploration)
 * - Character Studio: Turntable inspector for all 13 preserved characters & creatures
 * - Software WebGL (SwiftShader) frame-pacing guard (afterDraw) for instant Playwright verification
 */

import * as THREE from 'three';
import {
  defs,
  build,
  paintFace,
  grad,
  M,
  Cy,
  Sp,
  Cn,
  Bx,
  Tr,
  J,
  setCS,
  conScreenCtx,
  conScreenTex,
} from './characterRegistry';
import { clamp, springStep } from '../core/engine';

const T = THREE;
const S = Math.sin;
const C = Math.cos;
const PI = Math.PI;

// ============================================================================
// ARTISTIC SHADER PIPELINE (2D COLOUR-SKETCH SK & 3D INK-AND-GOUACHE 2.5D SK3D)
// ============================================================================
const SK = `uniform sampler2D t;uniform vec2 res;uniform float time;varying vec2 v;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
vec2 px;vec2 U;
vec4 S(vec2 o){return texture2D(t,U+o*px);}
float L(vec2 o){vec4 s=S(o*1.5);return (dot(s.rgb,vec3(.3,.59,.11))+.6)*s.a;}
void main(){
 px=1./res;float fr=floor(time*7.);
 U=v+(vec2(n(v*res*.018+fr),n(v*res*.018+fr+17.))-.5)*px*6.;
 vec4 c=S(vec2(-3.,2.));
 vec4 b=(S(vec2(5.,0.))+S(vec2(-5.,0.))+S(vec2(0.,5.))+S(vec2(0.,-5.))+c*2.)/6.;
 float gx=-L(vec2(-1.,-1.))-2.*L(vec2(-1.,0.))-L(vec2(-1.,1.))+L(vec2(1.,-1.))+2.*L(vec2(1.,0.))+L(vec2(1.,1.));
 float gy=-L(vec2(-1.,-1.))-2.*L(vec2(0.,-1.))-L(vec2(1.,-1.))+L(vec2(-1.,1.))+2.*L(vec2(0.,1.))+L(vec2(1.,1.));
 float ink=smoothstep(.34,.85,length(vec2(gx,gy)));
 float a=smoothstep(.1,.7,b.a);
 vec3 col=b.rgb/max(b.a,.001);
 float lum=dot(col,vec3(.3,.59,.11));
 col=mix(vec3(lum),col,1.45);col+=mix(vec3(-.03,-.02,.07),vec3(.07,.04,-.03),smoothstep(.2,.8,lum))*.5;
 col=floor(col*7.+.5)/7.*.55+col*.45;
 vec3 pap=vec3(.97,.93,.85)*(.9+.1*n(v*res*.45));
 vec3 bg=pap*(1.-.18*smoothstep(.45,.95,distance(v,vec2(.5))));
 float d1=(v.x+v.y)*res.y*.16+n(v*res*.03)*3.;
 float hatch=step(.55,fract(d1))*(1.-smoothstep(.2,.45,lum))*.32;
 float hatch2=step(.55,fract((v.x-v.y)*res.y*.16+2.))*(1.-smoothstep(.08,.24,lum))*.28;
 col=mix(col,vec3(.22,.16,.34),max(hatch,hatch2));
 col=mix(bg,col,a);
 col*=.93+.07*n(v*res*.7);
 col=mix(col,vec3(.12,.08,.16),ink*.9);
 gl_FragColor=vec4(col,1.);
}`;

const SK3D = `uniform sampler2D t;uniform vec2 res;uniform float time;uniform float styleMode;varying vec2 v;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
vec2 px;vec2 U;
vec4 S(vec2 o){return texture2D(t,clamp(U+o*px,0.001,0.999));}
float L(vec2 o){vec4 s=S(o*1.25);return (dot(s.rgb,vec3(.299,.587,.114))+.45)*s.a;}
void main(){
 px=1./res;
 float fr=floor(time*6.0);
 float jitterAmt = styleMode < 0.5 ? 1.85 : 0.65;
 U=v+(vec2(n(v*res*.024+fr),n(v*res*.024+fr+19.))-.5)*px*jitterAmt;
 vec4 c0=S(vec2(0.,0.));
 if(c0.a < 0.015){ gl_FragColor=vec4(0.,0.,0.,0.); return; }
 vec4 q1=(S(vec2(-2.,-1.))+S(vec2(-1.,-2.))+c0)/3.;
 vec4 q2=(S(vec2(2.,-1.))+S(vec2(1.,-2.))+c0)/3.;
 vec4 q3=(S(vec2(-2.,1.))+S(vec2(-1.,2.))+c0)/3.;
 vec4 q4=(S(vec2(2.,1.))+S(vec2(1.,2.))+c0)/3.;
 float d1=length(q1.rgb-c0.rgb), d2=length(q2.rgb-c0.rgb), d3=length(q3.rgb-c0.rgb), d4=length(q4.rgb-c0.rgb);
 vec4 gouache = q1; float md = d1;
 if(d2<md){md=d2;gouache=q2;} if(d3<md){md=d3;gouache=q3;} if(d4<md){gouache=q4;}
 vec3 col = mix(c0.rgb, gouache.rgb, 0.72) / max(c0.a, 0.001);
 float gx=-L(vec2(-1.,-1.))-2.*L(vec2(-1.,0.))-L(vec2(-1.,1.))+L(vec2(1.,-1.))+2.*L(vec2(1.,0.))+L(vec2(1.,1.));
 float gy=-L(vec2(-1.,-1.))-2.*L(vec2(0.,-1.))-L(vec2(1.,-1.))+L(vec2(-1.,1.))+2.*L(vec2(0.,1.))+L(vec2(1.,1.));
 vec3 cdx = S(vec2(1.2,0.)).rgb - S(vec2(-1.2,0.)).rgb;
 vec3 cdy = S(vec2(0.,1.2)).rgb - S(vec2(0.,-1.2)).rgb;
 float colEdge = length(cdx) + length(cdy);
 float edgeMag = length(vec2(gx,gy)) * 0.85 + colEdge * 0.55;
 float scratch = n(v*res*0.32) * 0.65 + n(v*res*0.08) * 0.35;
 float ink = smoothstep(0.28, 0.76, edgeMag * (0.72 + 0.55 * scratch));
 float lum = dot(col, vec3(.299,.587,.114));
 col = mix(vec3(lum), col, 1.28);
 col += mix(vec3(-0.035,-0.020,0.055), vec3(0.055,0.035,-0.020), smoothstep(0.18,0.82,lum)) * 0.45;
 vec3 poster = floor(col * 9.0 + 0.5) / 9.0;
 col = mix(col, poster, styleMode < 0.5 ? 0.42 : 0.22);
 float tooth = (n(v*res*0.52) - 0.5) * 0.075 + (n(vec2(v.x*res.x*0.18, v.y*res.y*0.04)) - 0.5) * 0.045;
 col = clamp(col + tooth, 0.0, 1.0);
 if (styleMode < 0.5) {
   float hLine1 = step(0.58, fract((v.x + v.y * 1.15) * res.y * 0.19 + n(v*res*0.04)*2.4));
   float hLine2 = step(0.62, fract((v.x - v.y * 1.15) * res.y * 0.19 + 1.7));
   float shMask1 = (1.0 - smoothstep(0.16, 0.38, lum)) * 0.34;
   float shMask2 = (1.0 - smoothstep(0.06, 0.22, lum)) * 0.28;
   col = mix(col, vec3(0.15, 0.10, 0.22), max(hLine1 * shMask1, hLine2 * shMask2));
 }
 float inkStrength = styleMode < 0.5 ? 0.88 : 0.48;
 col = mix(col, vec3(0.10, 0.07, 0.14), ink * inkStrength);
 gl_FragColor = vec4(col, c0.a);
}`;

import {aidDamage,stepAid,type KnightAid} from '../audience/knightAid';
import {lookDelta,normalizedAxes,type Preferences} from '../experience/preferences';

export interface HotspotInfo {
  key: string;
  title: string;
  hint: string;
  beatTarget: number;
}

export const LOOK_ANGLES_S1: Record<string, { yaw: number; pitch: number }> = {
  console: { yaw: 0.08, pitch: -0.28 },
  mum: { yaw: 1.25, pitch: -0.05 },
  driver: { yaw: 0.66, pitch: -0.02 },
  window: { yaw: -1.38, pitch: -0.01 },
};

export const LOOK_ANGLES_S2: Record<string, { yaw: number; pitch: number }> = {
  driver: { yaw: 0.58, pitch: -0.04 },
  aunt: { yaw: -1.57, pitch: 0.02 },
  mum: { yaw: 0.38, pitch: -0.02 },
  window: { yaw: -1.62, pitch: 0.06 },
};

export const LOOK_ANGLES_S3: Record<string, { yaw: number; pitch: number }> = {
  aunt: { yaw: 0.0, pitch: 0.02 },
  floor: { yaw: 0.24, pitch: -0.14 },
  table: { yaw: 0.70, pitch: -0.05 },
  stairs: { yaw: -0.53, pitch: 0.10 },
};

export const LOOK_ANGLES_S4: Record<string, { yaw: number; pitch: number }> = {
  bed: { yaw: 0.0, pitch: -0.06 },
  teddy: { yaw: 0.0, pitch: -0.16 },
  memory: { yaw: 0.70, pitch: 0.0 },
  console: { yaw: 0.0, pitch: -0.22 },
  window: { yaw: -0.73, pitch: 0.04 },
};

export function createSceneStage(
  stageEl: HTMLElement,
  stickmanCanvas: HTMLCanvasElement,
  callbacks: {
    onHotspotHover: (hs: HotspotInfo | null) => void;
    onHotspotActivate: (hs: HotspotInfo) => void;
    onAdvanceDialogue: () => void;
    onStickmanWinChange: (wins: number) => void;
    onPointerLockChange: (locked: boolean, failed: boolean) => void;
    onStepWalker: (forward: number, strafe: number, yaw: number, dt: number) => void;
  }
) {
  const R = new T.WebGLRenderer({ antialias: true, alpha: true });
  stageEl.innerHTML = '';
  stageEl.prepend(R.domElement);

  // Detect software WebGL (SwiftShader / llvmpipe) to pace frames and avoid starving headless Chromium
  const gl = R.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const rendererName = (dbg && gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) || '';
  const isSoftwareGl = /SwiftShader|llvmpipe|softpipe/i.test(rendererName);
  R.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));

  const sc = new T.Scene();
  sc.fog = new T.FogExp2(0x0a0b0f, 0.016);

  const cam3 = new T.PerspectiveCamera(58, 1, 0.05, 220);
  const cam2 = new T.OrthographicCamera(-1, 1, 1, -1, 0.05, 220);
  let cam: THREE.Camera = cam3;
  let mode = 3;
  let shaderStyle = 0;

  const hl = new T.HemisphereLight(0x8f97a6, 0x17151b, 0.55);
  sc.add(hl);
  const dl = new T.DirectionalLight(0xaab4c4, 0.30);
  dl.position.set(-5.0, 7.5, 6.0);
  sc.add(dl);

  const domeLightRear = new T.PointLight(0xffd9a8, 0.46, 5.0);
  domeLightRear.position.set(0, 1.84, -0.65);
  sc.add(domeLightRear);

  const domeLightFront = new T.PointLight(0xffd9a8, 0.30, 4.0);
  domeLightFront.position.set(0, 1.84, 0.75);
  sc.add(domeLightFront);

  const dashLight = new T.PointLight(0x6fa8b8, 0.38, 3.2);
  dashLight.position.set(0.35, 1.05, 1.15);
  sc.add(dashLight);

  const porchLight = new T.PointLight(0xffb454, 0.0, 12.0);
  porchLight.position.set(-5.8, 3.2, -1.2);
  sc.add(porchLight);

  const hallwayLight = new T.PointLight(0xd9f99d, 0.0, 14.0);
  hallwayLight.position.set(0.2, 2.9, 0.2);
  sc.add(hallwayLight);

  const bedroomLight = new T.PointLight(0x7dd3fc, 0.0, 12.0);
  bedroomLight.position.set(-0.4, 2.7, 0.3);
  sc.add(bedroomLight);

  const memoryLight = new T.PointLight(0xfbbf24, 0.0, 6.5);
  memoryLight.position.set(1.25, 1.85, 0.25);
  sc.add(memoryLight);

  document.documentElement.style.setProperty(
    '--grain',
    'url("data:image/svg+xml;utf8,' +
      encodeURIComponent(
        "<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .3  0 0 0 0 .2  0 0 0 0 .22  0 0 0 .8 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>"
      ) +
      '")'
  );

  const dotTex = (stops: [number, string][]) => {
    const k = document.createElement('canvas');
    k.width = k.height = 64;
    const g = k.getContext('2d')!;
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    stops.forEach(([o, c]) => r.addColorStop(o, c));
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    return new T.CanvasTexture(k);
  };
  const glowTex = dotTex([
    [0, 'rgba(255,255,255,1)'],
    [0.35, 'rgba(255,255,255,.45)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  const addGlowSprite = (g: THREE.Object3D, x: number, y: number, z: number, s: number, col = 0xffd08a) => {
    const mat = new T.SpriteMaterial({
      map: glowTex,
      color: col,
      blending: T.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const p = new T.Sprite(mat);
    p.scale.set(s, s, 1);
    p.position.set(x, y, z);
    g.add(p);
    return p;
  };

  // ============================================================================
  // BUILD SCENE I - IV CAST: ETHAN, MUM, DRIVER, AUNT MOMMA, MOTHER MEMORY & PRINCEPS
  // ============================================================================
  const ethanDef = defs.find((d: any) => d.id === 'ethan');
  const motherDef = defs.find((d: any) => d.id === 'mother');
  const driverDef = defs.find((d: any) => d.id === 'driver');
  const auntDef = defs.find((d: any) => d.id === 'aunt');
  const princepsDef = defs.find((d: any) => d.id === 'princeps');

  const ethan = build(ethanDef, 0);
  const mother = build(motherDef, 0);
  const driver = build(driverDef, 0);
  const aunt = build(auntDef, 0);
  const motherMemory = build(motherDef, 0);
  const princeps = build(princepsDef, 0);

  // ============================================================================
  // BUILD NIGHT HIGHWAY SCENERY & SCENE 2 BLACK-AND-WHITE HOUSE
  // ============================================================================
  const worldGrp = new T.Group();
  sc.add(worldGrp);

  const roadDashes: THREE.Mesh[] = [];
  const streetLamps: THREE.Group[] = [];
  const rainDrops: THREE.Mesh[] = [];
  const cityBuildings: THREE.Group[] = [];
  const roadsideTrees: THREE.Group[] = [];
  const oncomingCars: THREE.Group[] = [];
  let wiperL: THREE.Group | null = null;
  let wiperR: THREE.Group | null = null;

  const hotspotMeshes: THREE.Object3D[] = [];
  function registerHotspot(mesh: THREE.Object3D, key: string, title: string, hint: string, beatTarget: number, sceneOnly?: 1 | 2 | 3 | 4) {
    mesh.userData.hotspot = { key, title:title.replace(/\s*\(.*$/, '').trim(), hint, beatTarget, sceneOnly };
    hotspotMeshes.push(mesh);
  }

  // Scene 2: Aunt Momma's Two-Story Black-and-White House, Porch, Yard Dog & Stinky Door
  const houseGrp = new T.Group();
  houseGrp.visible = false;
  sc.add(houseGrp);
  let frontDoorPivot: THREE.Group | null = null;
  let yardDogGrp: THREE.Group | null = null;
  const stinkWisps: THREE.Mesh[] = [];

  // Scene 3: Inside Aunt Momma's Stinky House (Foyer, Rug, Soup & Soap Table, Creaky Stairs)
  const hallwayGrp = new T.Group();
  hallwayGrp.visible = false;
  sc.add(hallwayGrp);
  const hallStinkWisps: THREE.Mesh[] = [];
  let soupPotSteam: THREE.Mesh[] = [];
  let ethanBandageMesh: THREE.Mesh | null = null;

  // Scene 4: Upstairs Bedroom (Bed, Torn Teddy Bear with Stuffing, Mother Memory, Rainy Window & Princeps)
  const bedroomGrp = new T.Group();
  bedroomGrp.visible = false;
  sc.add(bedroomGrp);
  let teddyGrp: THREE.Group | null = null;
  let danglingEyePivot: THREE.Group | null = null;

  (function buildNightHighwayScenery() {
    setCS({ gm: grad([0.36, 0.70, 1], 0), w: 0.72, oc: new T.Color(0x11101a) });

    const ground = M(new T.PlaneGeometry(260, 260), 0x0b0f1a, [0, -0.03, 0], worldGrp, null, 0);
    ground.rotation.x = -PI / 2;

    M(Bx(16.0, 0.03, 180), 0x171c2b, [2.0, 0.0, 0], worldGrp, null, 0);
    M(Bx(0.18, 0.035, 180), 0x334155, [-4.6, 0.01, 0], worldGrp, null, 0);
    M(Bx(0.16, 0.035, 180), 0xf59e0b, [2.4, 0.01, 0], worldGrp, null, 0);

    M(Bx(0.14, 0.32, 180), 0x475569, [-5.5, 0.26, 0], worldGrp, null, 0.5);
    M(Bx(0.14, 0.32, 180), 0x475569, [9.4, 0.26, 0], worldGrp, null, 0.5);

    for (let z = -80; z <= 80; z += 5.2) {
      const d1 = M(Bx(0.18, 0.04, 2.2), 0xfacc15, [-2.1, 0.015, z], worldGrp, null, 0);
      const d2 = M(Bx(0.16, 0.04, 2.2), 0x94a3b8, [5.8, 0.015, z + 2.6], worldGrp, null, 0);
      roadDashes.push(d1, d2);
    }

    for (let z = -72; z <= 72; z += 18) {
      [-1, 1].forEach(side => {
        const isRightSide = side < 0;
        const lx = isRightSide ? -6.0 : 9.8;
        const armDir = isRightSide ? 1 : -1;
        const lg = new T.Group();
        lg.position.set(lx, 0, z + (isRightSide ? 0 : 9));
        M(Cy(0.07, 0.10, 5.0, 8), 0x334155, [0, 2.5, 0], lg, null, 0.6);
        M(Bx(1.55, 0.09, 0.09), 0x334155, [armDir * 0.72, 4.95, 0], lg, null, 0.5);
        M(Sp(0.21), 0xfbbf24, [armDir * 1.40, 4.88, 0], lg, null, 0);
        addGlowSprite(lg, armDir * 1.40, 4.82, 0, 4.0, 0xfbbf24);
        if (isRightSide) {
          const pool = new T.Mesh(
            new T.PlaneGeometry(4.8, 4.8),
            new T.MeshBasicMaterial({
              map: glowTex,
              color: 0xf59e0b,
              transparent: true,
              opacity: 0.22,
              depthWrite: false,
              blending: T.AdditiveBlending,
            })
          );
          pool.rotation.x = -PI / 2;
          pool.position.set(1.8, 0.025, 0);
          lg.add(pool);
        }
        worldGrp.add(lg);
        streetLamps.push(lg);
      });
    }

    for (let i = 0; i < 24; i++) {
      const z = -78 + i * 6.5;
      const tg = new T.Group();
      tg.position.set(-(7.5 + (i % 3) * 1.7), 0, z);
      M(Cy(0.11, 0.15, 1.2, 7), 0x291d18, [0, 0.6, 0], tg, null, 0.5);
      M(Cn(0.95, 2.4, 8), 0x132620, [0, 1.9, 0], tg, null, 0.7);
      M(Cn(0.72, 2.0, 8), 0x19332a, [0, 3.0, 0], tg, null, 0.7);
      worldGrp.add(tg);
      roadsideTrees.push(tg);

      const bg = new T.Group();
      const bh = 4.6 + ((i * 37) % 7) * 1.5;
      const bw = 2.6 + (i % 3) * 1.0;
      bg.position.set(-(15.0 + (i % 4) * 2.8), 0, z);
      M(Bx(bw, bh, 2.6), 0x121726, [0, bh / 2, 0], bg, null, 0.5);
      for (let wy = 1.3; wy < bh - 0.6; wy += 0.9) {
        for (let wz = -0.65; wz <= 0.65; wz += 0.65) {
          if ((i + Math.round(wy * 3 + wz * 5)) % 3 !== 0) {
            const wCol = (i + Math.round(wy)) % 4 === 0 ? 0x38bdf8 : 0xfde68a;
            M(Bx(0.04, 0.34, 0.26), wCol, [bw / 2 + 0.01, wy, wz], bg, null, 0);
          }
        }
      }
      worldGrp.add(bg);
      cityBuildings.push(bg);
    }

    for (let i = 0; i < 3; i++) {
      const oc = new T.Group();
      oc.position.set(5.6, 0, 28 + i * 46);
      M(Bx(1.95, 0.56, 4.0), 0x1e293b, [0, 0.52, 0], oc, null, 0.8);
      M(Bx(1.75, 0.48, 2.0), 0x334155, [0, 0.98, -0.1], oc, null, 0.7);
      [-0.68, 0.68].forEach(hx => {
        addGlowSprite(oc, hx, 0.54, -2.05, 2.6, 0xfef08a);
      });
      worldGrp.add(oc);
      oncomingCars.push(oc);
    }

    addGlowSprite(worldGrp, -42, 18, -8, 10.5, 0xfef3c7);
    M(Sp(1.85, 16, 14), 0xfef9c3, [-42, 18, -8], worldGrp, null, 0);

    const rainMat = new T.MeshBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.36 });
    const rainGeo = new T.CylinderGeometry(0.0035, 0.0035, 0.56, 4);
    for (let i = 0; i < 130; i++) {
      const rm = new T.Mesh(rainGeo, rainMat);
      rm.position.set(-11.0 + Math.random() * 16.0, 0.2 + Math.random() * 4.2, -12 + Math.random() * 24);
      rm.rotation.x = -0.42;
      worldGrp.add(rm);
      rainDrops.push(rm);
    }

    // ========================================================================
    // SCENE II: AUNT MOMMA'S TWO-STORY BLACK-AND-WHITE HOUSE & YARD DOG (21:43)
    // ========================================================================
    // Wet sidewalk curb & flagstone path leading from the car (x = -2.0) to the porch (x = -6.5)
    M(Bx(7.5, 0.08, 16.0), 0x1e2433, [-5.6, 0.02, -1.0], houseGrp, null, 0.4);
    for (let s = 0; s < 6; s++) {
      M(Bx(0.62, 0.09, 1.35), 0x475569, [-2.4 - s * 0.72, 0.04, -1.15], houseGrp, null, 0.5);
    }

    // Two-Story Black-and-White Painted House at x = -9.4, z = -1.15
    // First floor: Stark weathered white-parchment clapboard (0xebe5d8) with black timber beams (0x161821)
    const hBody1 = M(Bx(5.2, 3.1, 7.6), 0xebe5d8, [-9.4, 1.55, -1.15], houseGrp, null, 0.9);
    // Second floor: Stark black-and-white half-timbered upper story
    const hBody2 = M(Bx(5.4, 2.9, 7.8), 0x1a1d26, [-9.4, 4.55, -1.15], houseGrp, null, 0.9);
    // White stucco panels on the second story front facade
    [-2.2, 0, 2.2].forEach(pz => {
      M(Bx(0.08, 2.3, 1.8), 0xe5dec9, [-6.68, 4.55, -1.15 + pz], houseGrp, null, 0.5);
    });
    // Vertical & diagonal black half-timber framing beams on both stories
    [-3.5, -1.8, 0, 1.8, 3.5].forEach(bz => {
      M(Bx(0.14, 5.9, 0.16), 0x12141c, [-6.72, 3.0, -1.15 + bz], houseGrp, null, 0.6);
    });
    M(Bx(0.18, 0.22, 7.9), 0x12141c, [-6.70, 3.10, -1.15], houseGrp, null, 0.7);

    // Steep pitched dark-slate gable roof
    const roof = M(Cn(5.2, 2.8, 4), 0x11131a, [-9.4, 7.4, -1.15], houseGrp, [1.0, 1.0, 1.35], 0.9);
    roof.rotation.y = PI / 4;

    // Covered Front Porch, Steps, Pillars & Warm Amber Porch Lantern
    M(Bx(1.6, 0.36, 3.2), 0x2d3342, [-6.1, 0.18, -1.15], houseGrp, null, 0.7);
    M(Bx(0.55, 0.18, 1.8), 0x3b4254, [-5.1, 0.09, -1.15], houseGrp, null, 0.6);
    M(Bx(1.75, 0.18, 3.4), 0x161922, [-6.05, 2.95, -1.15], houseGrp, null, 0.75);
    [-1.35, 1.35].forEach(pz => {
      M(Bx(0.16, 2.6, 0.16), 0xebe5d8, [-5.45, 1.62, -1.15 + pz], houseGrp, null, 0.7);
    });
    // Porch lantern above front door
    M(Sp(0.16), 0xfbbf24, [-6.55, 2.68, -1.15], houseGrp, null, 0);
    addGlowSprite(houseGrp, -6.50, 2.68, -1.15, 3.2, 0xfbbf24);

    // Front Door Frame & Swinging Wooden Door ("She opened the door and a stinky smell came out")
    M(Bx(0.18, 2.25, 1.28), 0x12141c, [-6.74, 1.42, -1.15], houseGrp, null, 0.7);
    // Dark interior hallway behind the door
    M(Bx(0.12, 2.15, 1.16), 0x0c0f0a, [-6.82, 1.42, -1.15], houseGrp, null, 0);
    frontDoorPivot = J(houseGrp, -6.72, 1.42, -1.72);
    const doorMesh = M(Bx(0.09, 2.12, 1.14), 0x2b1d16, [0, 0, 0.57], frontDoorPivot, null, 0.8);
    M(Sp(0.045), 0xd97706, [0.06, -0.05, 0.98], frontDoorPivot, null, 0);
    registerHotspot(
      doorMesh,
      'window',
      'Black-and-White House Front Door',
      '[Click / E] “Welcome to your new home, Ethan.”',
      4,
      2
    );
    registerHotspot(
      hBody1,
      'window',
      'The Two-Story Black-and-White House',
      '[Click / E] Approach the front porch with Aunt Momma',
      4,
      2
    );

    // Upper & Side Lit Windows of the Black-and-White House
    [-2.2, 2.2].forEach(wz => {
      M(Bx(0.12, 1.15, 0.92), 0x1e293b, [-6.72, 1.65, -1.15 + wz], houseGrp, null, 0.6);
      M(Bx(0.14, 1.02, 0.80), 0xfef08a, [-6.71, 1.65, -1.15 + wz], houseGrp, null, 0);
      M(Bx(0.12, 1.10, 0.88), 0x1e293b, [-6.64, 4.55, -1.15 + wz], houseGrp, null, 0.6);
      M(Bx(0.14, 0.96, 0.76), 0xd9f99d, [-6.63, 4.55, -1.15 + wz], houseGrp, null, 0);
    });

    // Stinky Odor Wisps inside the doorway (visible when door opens on Scene 2 Beat 4)
    const stinkMat = new T.MeshBasicMaterial({
      color: 0x84cc16,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
    for (let i = 0; i < 6; i++) {
      const wisp = new T.Mesh(new T.SphereGeometry(0.18 + (i % 3) * 0.08, 12, 10), stinkMat);
      wisp.position.set(-6.4 + i * 0.22, 1.0 + (i % 3) * 0.35, -1.15 + (i % 2 ? 0.22 : -0.22));
      wisp.visible = false;
      houseGrp.add(wisp);
      stinkWisps.push(wisp);
    }

    // Ordinary Yard Dog by the wooden doghouse ("had two stories and a dog. It was not like my dog.")
    M(Bx(1.1, 0.95, 1.2), 0x3b2820, [-5.6, 0.48, -2.7], houseGrp, null, 0.7);
    const dhRoof = M(Cn(0.92, 0.55, 4), 0x1e1b18, [-5.6, 1.22, -2.7], houseGrp, null, 0.7);
    dhRoof.rotation.y = PI / 4;

    yardDogGrp = J(houseGrp, -4.75, 0.02, -2.05);
    yardDogGrp.rotation.y = 1.15;
    // Ordinary scruffy grey-brown yard hound (contrasting with Princeps the orange fire dog)
    const dogCol = 0x574c44;
    const dogDark = 0x2b2520;
    M(Bx(0.28, 0.28, 0.58), dogCol, [0, 0.38, 0], yardDogGrp, null, 0.8);
    const dHead = M(Bx(0.24, 0.24, 0.26), dogCol, [0, 0.54, 0.32], yardDogGrp, null, 0.8);
    M(Bx(0.14, 0.12, 0.18), dogDark, [0, 0.50, 0.48], yardDogGrp, null, 0.7);
    [-0.12, 0.12].forEach(ex => {
      M(Bx(0.06, 0.16, 0.10), dogDark, [ex, 0.52, 0.30], yardDogGrp, null, 0.6);
    });
    [
      [-0.09, 0.20],
      [0.09, 0.20],
      [-0.09, -0.20],
      [0.09, -0.20],
    ].forEach(([lx, lz]) => {
      M(Cy(0.04, 0.035, 0.32, 8), dogCol, [lx, 0.16, lz], yardDogGrp, null, 0.7);
    });
    M(Cy(0.025, 0.015, 0.30, 6), dogDark, [0, 0.46, -0.34], yardDogGrp, null, 0.6).rotation.x = -0.6;
    registerHotspot(
      dHead,
      'window',
      'The Yard Dog (Not Like My Orange Fire Dog)',
      '[Click / E] “It was not like my dog. My dog was orange and could shoot fire.”',
      4,
      2
    );

    // Place Aunt Momma in sc so she appears in both Scene 2 (outside house) and Scene 3 (inside hallway)
    sc.add(aunt.g);
    aunt.g.position.set(-3.15, 0.02, -1.25);
    aunt.g.rotation.y = 1.35;
    aunt.g.traverse((o: any) => {
      if (o.isMesh) {
        registerHotspot(
          o,
          'aunt',
          'Aunt Momma',
          '[Click / E] “You can call me Aunt Momma.”',
          1
        );
      }
    });

    setCS(null);
  })();

  // ============================================================================
  // SCENE III: INSIDE AUNT MOMMA'S STINKY HOUSE (FOYER, SOUP & SOAP, STAIRS)
  // ============================================================================
  (function buildScene3Hallway() {
    setCS({ gm: grad([0.36, 0.70, 1], 0), w: 0.78, oc: new T.Color(0x12150e) });

    const floorCol = 0x261c15;
    const wallUpperCol = 0x2d3324;
    const wainscotCol = 0x1a130f;
    const beamCol = 0x140f0c;

    // Worn oak floorboards & dark wainscoted walls enclosing the foyer
    M(Bx(7.8, 0.08, 8.6), floorCol, [0, -0.04, 0.4], hallwayGrp, null, 0.8);
    for (let px = -3.4; px <= 3.4; px += 0.68) {
      M(Bx(0.03, 0.085, 8.5), 0x16100c, [px, -0.038, 0.4], hallwayGrp, null, 0);
    }

    // Back wall (+Z = +4.4), Front wall (-Z = -3.6), Left wall (-X = -3.7), Right wall (+X = +3.7)
    M(Bx(7.8, 3.6, 0.16), wallUpperCol, [0, 1.8, 4.4], hallwayGrp, null, 0.85);
    M(Bx(7.8, 1.15, 0.20), wainscotCol, [0, 0.58, 4.38], hallwayGrp, null, 0.75);

    M(Bx(7.8, 3.6, 0.16), wallUpperCol, [0, 1.8, -3.6], hallwayGrp, null, 0.85);
    M(Bx(7.8, 1.15, 0.20), wainscotCol, [0, 0.58, -3.58], hallwayGrp, null, 0.75);
    // Closed front door behind Ethan at (0, 1.15, -3.50)
    M(Bx(1.25, 2.25, 0.12), 0x2b1d16, [0, 1.12, -3.48], hallwayGrp, null, 0.8);

    M(Bx(0.16, 3.6, 8.6), wallUpperCol, [-3.7, 1.8, 0.4], hallwayGrp, null, 0.85);
    M(Bx(0.20, 1.15, 8.6), wainscotCol, [-3.68, 0.58, 0.4], hallwayGrp, null, 0.75);

    M(Bx(0.16, 3.6, 8.6), wallUpperCol, [3.7, 1.8, 0.4], hallwayGrp, null, 0.85);
    M(Bx(0.20, 1.15, 8.6), wainscotCol, [3.68, 0.58, 0.4], hallwayGrp, null, 0.75);

    // Ceiling & heavy timber rafters
    M(Bx(7.8, 0.12, 8.6), 0x191d15, [0, 3.55, 0.4], hallwayGrp, null, 0.8);
    [-2.2, -0.6, 1.0, 2.6].forEach(bz => {
      M(Bx(7.6, 0.18, 0.20), beamCol, [0, 3.42, bz], hallwayGrp, null, 0.75);
    });
    // Hanging brass-and-green glass ceiling lamp
    M(Cy(0.02, 0.02, 0.55, 8), 0x1e293b, [0.1, 3.22, 0.1], hallwayGrp, null, 0);
    M(Cn(0.28, 0.22, 12), 0x84cc16, [0.1, 2.92, 0.1], hallwayGrp, null, 0.6);
    addGlowSprite(hallwayGrp, 0.1, 2.82, 0.1, 3.2, 0xd9f99d);

    // Faded crimson-and-ochre hallway runner rug (Hotspot for Beat 2: Ethan falls on purpose & scrapes tummy)
    const rugOuter = M(Bx(1.65, 0.02, 3.2), 0x4c1d24, [0.15, 0.01, -0.55], hallwayGrp, null, 0.6);
    const rugInner = M(Bx(1.32, 0.025, 2.8), 0x7c2d12, [0.15, 0.014, -0.55], hallwayGrp, null, 0.5);
    registerHotspot(
      rugOuter,
      'floor',
      'Worn Foyer Floorboards & Rug',
      '[Click / E] “Ow! My tummy hurts! I fell!” (Deliberate fall)',
      2,
      3
    );
    registerHotspot(
      rugInner,
      'floor',
      'Worn Foyer Floorboards & Rug',
      '[Click / E] “Ow! My tummy hurts! I fell!” (Deliberate fall)',
      2,
      3
    );

    // Dining Table at (+1.65, 0.0, +0.35) with Steaming Green Soup Pot, Pink Soap Bar & Plaster Tin (Beat 3)
    const tblGrp = J(hallwayGrp, 1.65, 0, 0.35);
    const tblTop = M(Bx(1.25, 0.08, 1.55), 0x3b2618, [0, 0.76, 0], tblGrp, null, 0.85);
    [
      [-0.52, -0.65],
      [0.52, -0.65],
      [-0.52, 0.65],
      [0.52, 0.65],
    ].forEach(([lx, lz]) => {
      M(Bx(0.09, 0.75, 0.09), 0x291a10, [lx, 0.375, lz], tblGrp, null, 0.75);
    });

    // Steaming Pot of Weird Smelly Soup at center of table
    const soupPot = M(Cy(0.24, 0.21, 0.26, 16), 0x1e293b, [-0.08, 0.92, 0.05], tblGrp, null, 0.85);
    const soupBroth = M(Cy(0.22, 0.22, 0.04, 16), 0x65a30d, [-0.08, 1.04, 0.05], tblGrp, null, 0);
    // Wooden ladle sticking out of soup pot
    const ladle = M(Cy(0.018, 0.018, 0.34, 8), 0x78350f, [0.02, 1.14, 0.08], tblGrp, null, 0.6);
    ladle.rotation.z = -0.48;

    // Bar of Pink Soap on a Ceramic Dish ("wash your mouth with soap!")
    M(Bx(0.24, 0.03, 0.18), 0xe2e8f0, [-0.28, 0.815, -0.42], tblGrp, null, 0.5);
    const soapBar = M(Bx(0.16, 0.06, 0.11), 0xf472b6, [-0.28, 0.85, -0.42], tblGrp, null, 0.7);

    // First-Aid Plaster Tin & Bandage Strip ("put a plaster on your tummy")
    const plasterTin = M(Bx(0.26, 0.10, 0.20), 0xfef2f2, [-0.22, 0.85, 0.46], tblGrp, null, 0.7);
    M(Bx(0.10, 0.02, 0.035), 0xef4444, [-0.22, 0.905, 0.46], tblGrp, null, 0);
    M(Bx(0.035, 0.02, 0.10), 0xef4444, [-0.22, 0.905, 0.46], tblGrp, null, 0);
    M(Bx(0.14, 0.015, 0.05), 0xfde68a, [-0.02, 0.81, 0.48], tblGrp, null, 0.5);

    [tblTop, soupPot, soupBroth, soapBar, plasterTin].forEach(m => {
      registerHotspot(
        m,
        'table',
        'Steaming Smelly Soup, Soap Bar & Plaster Tin',
        '[Click / E] “Aunt Momma will put a plaster on your tummy and make you some hot soup.”',
        3,
        3
      );
    });

    // Rising green steam puffs above the soup pot + ambient stink wisps in the foyer
    const steamMat = new T.MeshBasicMaterial({
      color: 0xa3e635,
      transparent: true,
      opacity: 0.30,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
    for (let i = 0; i < 4; i++) {
      const sp = new T.Mesh(new T.SphereGeometry(0.09 + i * 0.03, 10, 8), steamMat);
      sp.position.set(1.57, 1.15 + i * 0.22, 0.40);
      hallwayGrp.add(sp);
      soupPotSteam.push(sp);
    }
    for (let i = 0; i < 7; i++) {
      const wisp = new T.Mesh(new T.SphereGeometry(0.22 + (i % 3) * 0.08, 12, 10), steamMat);
      wisp.position.set(-1.8 + (i % 4) * 1.1, 0.9 + (i % 3) * 0.45, -1.2 + i * 0.55);
      hallwayGrp.add(wisp);
      hallStinkWisps.push(wisp);
    }

    // Creaky Wooden Staircase on the left (-X = -1.65, rising from Z = +0.10 to Z = +3.20) (Beat 4)
    const stairsGrp = J(hallwayGrp, -1.65, 0, 0.15);
    for (let st = 0; st < 10; st++) {
      const stepMesh = M(
        Bx(1.25, 0.18, 0.32),
        st % 2 === 0 ? 0x3b281c : 0x2e1f15,
        [0, 0.09 + st * 0.22, st * 0.30],
        stairsGrp,
        null,
        0.8
      );
      registerHotspot(
        stepMesh,
        'stairs',
        'Creaky Wooden Stairs to the Upstairs Bedroom',
        '[Click / E] “Go upstairs to your bedroom and go to sleep.”',
        4,
        3
      );
    }
    // Banister rail & newel post
    M(Bx(0.14, 1.05, 0.14), 0x1e140e, [0.58, 0.52, -0.05], stairsGrp, null, 0.8);
    M(Sp(0.09), 0x3b281c, [0.58, 1.10, -0.05], stairsGrp, null, 0.7);
    const rail = M(Bx(0.08, 0.08, 3.45), 0x1e140e, [0.58, 1.65, 1.35], stairsGrp, null, 0.8);
    rail.rotation.x = -0.62;
    registerHotspot(
      rail,
      'stairs',
      'Creaky Wooden Stairs to the Upstairs Bedroom',
      '[Click / E] Climb upstairs to the bedroom (Scene IV)',
      4,
      3
    );

    // Sticky Plaster Bandage attached to Ethan's torso tummy side (visible after Scene 3 Beat 2)
    if (ethan.j && ethan.j.torso) {
      ethanBandageMesh = M(Bx(0.11, 0.055, 0.04), 0xfde68a, [-0.14, 0.16, 0.14], ethan.j.torso, null, 0.6);
      ethanBandageMesh.rotation.y = -0.35;
      ethanBandageMesh.visible = false;
    }

    setCS(null);
  })();

  // ============================================================================
  // SCENE IV: UPSTAIRS BEDROOM, TORN TEDDY BEAR, MOTHER MEMORY & WINDOW DRAGON
  // ============================================================================
  (function buildScene4Bedroom() {
    setCS({ gm: grad([0.36, 0.70, 1], 0), w: 0.78, oc: new T.Color(0x0d101d) });

    const floorCol = 0x1a1624;
    const wallCol = 0x1e2436;
    const stripeCol = 0x262e45;
    const woodDark = 0x241914;

    // Upstairs bedroom floorboards & peeling striped walls
    M(Bx(6.8, 0.08, 7.2), floorCol, [0, -0.04, 0.2], bedroomGrp, null, 0.8);
    M(Bx(6.8, 3.4, 0.16), wallCol, [0, 1.7, 3.6], bedroomGrp, null, 0.85);
    M(Bx(6.8, 3.4, 0.16), wallCol, [0, 1.7, -3.4], bedroomGrp, null, 0.85);
    M(Bx(0.16, 3.4, 7.2), wallCol, [3.3, 1.7, 0.2], bedroomGrp, null, 0.85);
    // Left wall (-X = -1.75) with cutout opening for the rainy bedroom window at Z = +0.45, Y = 1.45
    M(Bx(0.16, 0.85, 7.2), wallCol, [-1.75, 0.42, 0.2], bedroomGrp, null, 0.85);
    M(Bx(0.16, 1.15, 7.2), wallCol, [-1.75, 2.82, 0.2], bedroomGrp, null, 0.85);
    M(Bx(0.16, 1.40, 2.8), wallCol, [-1.75, 1.55, -1.95], bedroomGrp, null, 0.85);
    M(Bx(0.16, 1.40, 2.6), wallCol, [-1.75, 1.55, 2.50], bedroomGrp, null, 0.85);

    // Peeling wallpaper vertical stripes on back wall
    for (let sx = -2.8; sx <= 2.8; sx += 0.56) {
      M(Bx(0.18, 3.2, 0.02), stripeCol, [sx, 1.65, 3.50], bedroomGrp, null, 0);
    }

    // Sloped attic ceiling beams
    [-1.8, -0.2, 1.4, 3.0].forEach(bz => {
      M(Bx(5.2, 0.16, 0.18), woodDark, [0.75, 3.25, bz], bedroomGrp, null, 0.75);
    });

    // Narrow Wooden Bed at (0.0, 0.0, +0.75) (Beat 0)
    const bedGrp = J(bedroomGrp, 0.0, 0.0, 0.75);
    const bedFrame = M(Bx(1.38, 0.28, 2.15), woodDark, [0, 0.24, 0], bedGrp, null, 0.85);
    // Headboard at +Z (+1.02) and footboard at -Z (-1.02)
    M(Bx(1.42, 0.98, 0.12), woodDark, [0, 0.62, 1.02], bedGrp, null, 0.85);
    M(Bx(1.42, 0.58, 0.10), woodDark, [0, 0.42, -1.02], bedGrp, null, 0.85);
    // Mattress, faded patchwork blanket & white pillow
    const mattress = M(Bx(1.26, 0.22, 1.96), 0x334155, [0, 0.46, 0], bedGrp, null, 0.75);
    const blanket = M(Bx(1.28, 0.24, 1.38), 0x1e3a5f, [0, 0.47, -0.26], bedGrp, null, 0.8);
    const pillow = M(Bx(0.86, 0.14, 0.46), 0xe2e8f0, [0, 0.58, 0.66], bedGrp, null, 0.7);
    [bedFrame, mattress, blanket, pillow].forEach(m => {
      registerHotspot(
        m,
        'bed',
        'Narrow Wooden Bed & Patchwork Blanket',
        '[Click / E] Lie down on the narrow bed as rain rattles the glass',
        0,
        4
      );
    });

    // Composite 3D TORN TEDDY BEAR (teddyGrp) sitting propped against the pillow at (0.0, 0.60, +0.82) facing -Z (Beat 1)
    teddyGrp = J(bedroomGrp, 0.0, 0.60, 0.82);
    teddyGrp.rotation.y = PI; // Faces Ethan at (0, -0.55)
    const furCol = 0x92400e;
    const furDark = 0x78350f;
    const snoutCol = 0xd97706;
    const stuffCol = 0xcbd5e1;

    // Plump stitched bear torso
    const tTorso = M(Sp(0.20, 16, 14), furCol, [0, 0.20, 0], teddyGrp, [1.05, 1.18, 0.88], 0.9);
    // Bear head tilted slightly to the right
    const tHead = M(Sp(0.165, 16, 14), furCol, [0, 0.46, 0.02], teddyGrp, [1.08, 1.0, 0.95], 0.9);
    tHead.rotation.z = 0.14;
    // Round bear ears
    M(Sp(0.065, 12, 10), furDark, [-0.13, 0.58, 0.0], teddyGrp, [1, 1, 0.55], 0.85);
    M(Sp(0.065, 12, 10), furDark, [0.14, 0.56, 0.0], teddyGrp, [1, 1, 0.55], 0.85);
    // Stitched tan snout & black nose tip
    M(Sp(0.068, 12, 10), snoutCol, [0.01, 0.43, 0.16], teddyGrp, [1.1, 0.85, 0.9], 0.75);
    M(Sp(0.024, 10, 8), 0x0f172a, [0.01, 0.45, 0.22], teddyGrp, null, 0);
    // Left eye: intact black button eye
    M(Cy(0.026, 0.026, 0.014, 12), 0x0f172a, [-0.065, 0.48, 0.165], teddyGrp, null, 0.5).rotation.x = PI / 2;
    // Right eye: loose red thread hanging down the cheek with dangling black button eye!
    danglingEyePivot = J(teddyGrp, 0.072, 0.48, 0.165);
    M(Cy(0.004, 0.004, 0.09, 6), 0xef4444, [0.01, -0.045, 0.01], danglingEyePivot, null, 0);
    const dangEye = M(Cy(0.026, 0.026, 0.014, 12), 0x0f172a, [0.015, -0.09, 0.02], danglingEyePivot, null, 0.6);
    dangEye.rotation.x = PI / 2 - 0.35;

    // Floppy arms & seated legs
    M(Cy(0.048, 0.042, 0.22, 10), furDark, [-0.19, 0.22, 0.04], teddyGrp, null, 0.8).rotation.z = 0.45;
    M(Cy(0.048, 0.042, 0.22, 10), furDark, [0.19, 0.22, 0.04], teddyGrp, null, 0.8).rotation.z = -0.45;
    M(Cy(0.055, 0.050, 0.22, 10), furDark, [-0.11, 0.06, 0.16], teddyGrp, null, 0.8).rotation.x = PI / 2 - 0.2;
    M(Cy(0.055, 0.050, 0.22, 10), furDark, [0.11, 0.06, 0.16], teddyGrp, null, 0.8).rotation.x = PI / 2 - 0.2;

    // TORN TUMMY SEAM & GREY STUFFING SPILLING OUT ("You have a hurt tummy too, just like me.")
    M(Bx(0.15, 0.035, 0.02), 0x1e1b18, [0, 0.19, 0.175], teddyGrp, null, 0).rotation.z = -0.18;
    const s1 = M(Sp(0.052, 10, 8), stuffCol, [-0.03, 0.19, 0.195], teddyGrp, null, 0.7);
    const s2 = M(Sp(0.044, 10, 8), 0xe2e8f0, [0.035, 0.175, 0.20], teddyGrp, null, 0.7);
    const s3 = M(Sp(0.038, 10, 8), 0x94a3b8, [0.0, 0.145, 0.19], teddyGrp, null, 0.7);
    const s4 = M(Sp(0.032, 10, 8), stuffCol, [0.055, 0.13, 0.17], teddyGrp, null, 0.7);

    [tTorso, tHead, dangEye, s1, s2, s3, s4].forEach(m => {
      registerHotspot(
        m,
        'teddy',
        'Torn Teddy Bear (Stuffing Spilling from Tummy)',
        '[Click / E] “You have a hurt tummy too, just like me.”',
        1,
        4
      );
    });

    // Mother's Tearful Memory Apparition at (+1.35, 0.02, +0.35) facing Ethan (Beat 2)
    bedroomGrp.add(motherMemory.g);
    motherMemory.g.position.set(1.35, 0.02, 0.35);
    motherMemory.g.rotation.y = -2.45;
    addGlowSprite(bedroomGrp, 1.35, 1.25, 0.35, 2.8, 0xfbbf24);
    motherMemory.g.traverse((o: any) => {
      if (o.isMesh) {
        registerHotspot(
          o,
          'memory',
          'Memory of Mum Crying Softly in the Dark',
          '[Click / E] “Mum… please wake up and come get me.”',
          2,
          4
        );
      }
    });

    // Rain-Streaked Bedroom Casement Window at (-1.72, 1.55, +0.45) & Dragon Princeps Outside (Beat 4)
    const winGrp = J(bedroomGrp, -1.72, 1.55, 0.45);
    M(Bx(0.14, 1.44, 1.56), woodDark, [0, 0, 0], winGrp, null, 0);
    M(Bx(0.16, 1.36, 0.06), woodDark, [0, 0, 0], winGrp, null, 0.7);
    M(Bx(0.16, 0.06, 1.48), woodDark, [0, 0.12, 0], winGrp, null, 0.7);
    const bedWinGlass = new T.Mesh(
      new T.PlaneGeometry(1.46, 1.34),
      new T.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.16,
        side: T.DoubleSide,
        depthWrite: false,
      })
    );
    bedWinGlass.rotation.y = PI / 2;
    winGrp.add(bedWinGlass);
    registerHotspot(
      bedWinGlass,
      'window',
      'Rain-Streaked Bedroom Window (Shadow in the Night)',
      '[Click / E] Look out at the colossal horned silhouette in the rain',
      4,
      4
    );

    // Place Dragon Princeps outside the bedroom window in the rainy night (-2.65, 0.25, +1.15) facing Ethan
    bedroomGrp.add(princeps.g);
    princeps.g.position.set(-2.65, 0.25, 1.15);
    princeps.g.rotation.y = 2.25;
    princeps.g.traverse((o: any) => {
      if (o.isMesh) {
        registerHotspot(
          o,
          'window',
          'Colossal Shadow Outside the Window (Princeps)',
          '[Click / E] Something huge with a glowing green eye stirs in the storm',
          4,
          4
        );
      }
    });

    setCS(null);
  })();

  // ============================================================================
  // BUILD SPACIOUS FULL-SIZE EXECUTIVE SEDAN CABIN & EXTERIOR
  // ============================================================================
  const carGrp = new T.Group();
  sc.add(carGrp);

  let steeringWheel: THREE.Group | null = null;
  let castleGhostGrp: THREE.Group | null = null;
  const wheels: THREE.Group[] = [];

  let mirrorCtx: CanvasRenderingContext2D | null = null;
  let mirrorTex: THREE.CanvasTexture | null = null;
  let mirrorKey = '';

  function drawMirror(angry: boolean, v: number, px: number, py: number, bk: number) {
    const g = mirrorCtx;
    if (!g) return;
    g.globalAlpha = 1;
    g.fillStyle = '#10141b';
    g.fillRect(0, 0, 256, 96);
    const gr = g.createLinearGradient(0, 0, 256, 96);
    gr.addColorStop(0, 'rgba(130,138,155,0.15)');
    gr.addColorStop(1, 'rgba(30,34,46,0.02)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 96);
    if (v > 0.03) {
      g.globalAlpha = v;
      g.fillStyle = '#a97c5d';
      g.fillRect(36, 16, 184, 68);
      g.fillStyle = '#14171f';
      g.fillRect(20, 0, 216, 26);
      g.strokeStyle = '#231c18';
      g.lineWidth = angry ? 8 : 6;
      g.lineCap = 'round';
      g.beginPath();
      if (angry) {
        g.moveTo(58, 30);
        g.lineTo(112, 42);
        g.moveTo(198, 30);
        g.lineTo(144, 42);
      } else {
        g.moveTo(58, 34);
        g.lineTo(112, 31);
        g.moveTo(198, 34);
        g.lineTo(144, 31);
      }
      g.stroke();
      const open = Math.max(0.08, 1 - bk * 0.95);
      [86, 170].forEach(ex => {
        g.fillStyle = '#efe9de';
        g.beginPath();
        g.ellipse(ex, 52, 20, (angry ? 8 : 10) * open, 0, 0, PI * 2);
        g.fill();
        if (open > 0.3) {
          const cx = ex - (angry ? 4 : 0) + px * 9;
          const cy = 52 + py * 4;
          g.save();
          g.beginPath();
          g.ellipse(ex, 52, 20, (angry ? 8 : 10) * open, 0, 0, PI * 2);
          g.clip();
          g.fillStyle = '#2d221c';
          g.beginPath();
          g.arc(cx, cy, angry ? 7 : 8, 0, PI * 2);
          g.fill();
          g.fillStyle = '#ffffff';
          g.beginPath();
          g.arc(cx - 2, cy - 3, 2.2, 0, PI * 2);
          g.fill();
          g.restore();
        }
      });
      g.globalAlpha = 1;
    }
    g.strokeStyle = 'rgba(200,210,225,0.12)';
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(15, 90);
    g.lineTo(95, 6);
    g.stroke();
  }

  function makeRearviewMirrorTex() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 96;
    mirrorCtx = c.getContext('2d');
    mirrorTex = new T.CanvasTexture(c);
    drawMirror(false, 0, 0, 0, 0);
    return mirrorTex;
  }

  function setMirrorState(angry: boolean, v: number, px: number, py: number, bk: number) {
    if (!mirrorTex) return;
    v = Math.round(v * 16) / 16;
    px = Math.round(px * 6) / 6;
    py = Math.round(py * 6) / 6;
    bk = Math.round(bk * 6) / 6;
    const k = [angry ? 1 : 0, v, v ? px : 0, v ? py : 0, v ? bk : 0].join('|');
    if (k === mirrorKey) return;
    mirrorKey = k;
    drawMirror(angry, v, px, py, bk);
    mirrorTex.needsUpdate = true;
  }

  (function buildSpaciousExecutiveCar() {
    setCS({ gm: grad([0.36, 0.70, 1], 0), w: 0.82, oc: new T.Color(0x100e18) });

    const bodyCol = 0x222a3a;
    const trimCol = 0x171c28;
    const woodCol = 0x5c3a24;
    const headlinerCol = 0x2d3446;
    const seatCol = 0x333b50;
    const bolsterCol = 0x282f42;

    M(Bx(2.90, 0.14, 5.60), bodyCol, [0, 0.18, -0.05], carGrp, null, 0.9);
    M(Bx(2.68, 0.04, 4.10), 0x1c202e, [0, 0.26, -0.10], carGrp, null, 0);
    M(Bx(0.42, 0.34, 1.35), trimCol, [0, 0.44, 0.72], carGrp, null, 0.65);
    M(Bx(0.44, 0.04, 1.32), woodCol, [0, 0.62, 0.72], carGrp, null, 0.4);
    M(Bx(0.32, 0.16, 0.04), 0x0f1420, [0, 0.50, 0.04], carGrp, null, 0.4);
    [-0.08, 0.08].forEach(vx => {
      M(Sp(0.022), vx < 0 ? 0x38bdf8 : 0xf43f5e, [vx, 0.46, 0.018], carGrp, [1, 1, 0.3], 0);
    });

    const hood = M(Bx(2.84, 0.56, 1.45), bodyCol, [0, 0.58, 2.38], carGrp, null, 0.9);
    hood.rotation.x = 0.05;
    M(Bx(2.82, 0.58, 1.05), bodyCol, [0, 0.60, -2.55], carGrp, null, 0.9);
    [-1.02, 1.02].forEach(x => {
      M(Sp(0.15), 0xfef08a, [x, 0.62, 3.10], carGrp, [1.3, 0.7, 0.4], 0);
      addGlowSprite(carGrp, x, 0.62, 3.18, 2.8, 0xfef08a);
      M(Bx(0.46, 0.14, 0.08), 0xf43f5e, [x, 0.66, -3.08], carGrp, null, 0);
    });

    [
      [-1.46, 1.85],
      [1.46, 1.85],
      [-1.46, -1.75],
      [1.46, -1.75],
    ].forEach(([wx, wz]) => {
      const wg = J(carGrp, wx, 0.36, wz);
      M(Cy(0.38, 0.38, 0.24, 22), 0x12131a, [0, 0, 0], wg, null, 0.8).rotation.z = PI / 2;
      M(Cy(0.23, 0.23, 0.25, 14), 0x94a3b8, [0, 0, 0], wg, null, 0.4).rotation.z = PI / 2;
      M(Bx(0.26, 0.05, 0.36), 0x475569, [0, 0, 0], wg, null, 0);
      wheels.push(wg);
    });

    [-1, 1].forEach(sd => {
      M(Bx(0.11, 0.68, 3.85), bodyCol, [sd * 1.40, 0.58, -0.10], carGrp, null, 0.85);
      M(Bx(0.05, 0.62, 3.70), trimCol, [sd * 1.33, 0.58, -0.10], carGrp, null, 0.5);
      M(Bx(0.06, 0.045, 3.55), woodCol, [sd * 1.31, 0.84, -0.10], carGrp, null, 0.4);
      M(Bx(0.065, 0.012, 3.55), 0x38bdf8, [sd * 1.30, 0.81, -0.10], carGrp, null, 0);
      [0.62, -0.95].forEach(az => {
        M(Bx(0.14, 0.07, 0.78), bolsterCol, [sd * 1.25, 0.72, az], carGrp, null, 0.55);
        M(Bx(0.035, 0.016, 0.06), 0x38bdf8, [sd * 1.24, 0.76, az + 0.24], carGrp, null, 0);
        M(Bx(0.025, 0.035, 0.12), 0xcbd5e1, [sd * 1.28, 0.84, az + 0.16], carGrp, null, 0);
      });
    });

    M(Bx(2.72, 0.06, 0.62), bodyCol, [0, 1.98, 1.02], carGrp, null, 0.85);
    M(Bx(2.72, 0.06, 0.78), bodyCol, [0, 1.98, -1.62], carGrp, null, 0.85);
    M(Bx(2.60, 0.03, 0.58), headlinerCol, [0, 1.94, 1.02], carGrp, null, 0.4);
    M(Bx(2.60, 0.03, 0.74), headlinerCol, [0, 1.94, -1.62], carGrp, null, 0.4);
    M(Bx(0.32, 0.04, 1.95), headlinerCol, [0, 1.94, -0.25], carGrp, null, 0.4);
    M(Bx(0.22, 0.025, 0.18), 0xfef3c7, [0, 1.92, -0.55], carGrp, null, 0);
    M(Bx(0.22, 0.025, 0.18), 0xfef3c7, [0, 1.92, 0.85], carGrp, null, 0);

    [-1, 1].forEach(sd => {
      M(Bx(0.12, 0.08, 3.35), bodyCol, [sd * 1.34, 1.95, -0.30], carGrp, null, 0.8);
      M(Bx(0.14, 0.05, 3.25), headlinerCol, [sd * 1.28, 1.92, -0.30], carGrp, null, 0.4);
      M(Bx(0.035, 0.03, 0.24), 0x64748b, [sd * 1.20, 1.88, -0.88], carGrp, null, 0);
      const sunGlass = new T.Mesh(
        new T.PlaneGeometry(0.98, 1.92),
        new T.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.12,
          side: T.DoubleSide,
          depthWrite: false,
        })
      );
      sunGlass.position.set(sd * 0.66, 1.97, -0.25);
      sunGlass.rotation.x = PI / 2;
      carGrp.add(sunGlass);
    });

    [-0.68, 0.68].forEach(vx => {
      const visor = M(Bx(0.54, 0.025, 0.18), 0x1e2330, [vx, 1.90, 1.18], carGrp, null, 0.4);
      visor.rotation.x = 0.25;
    });

    [-1, 1].forEach(sd => {
      const aPillar = M(Bx(0.09, 1.15, 0.09), bodyCol, [sd * 1.35, 1.44, 1.50], carGrp, null, 0.75);
      aPillar.rotation.x = -0.36;
      M(Bx(0.09, 1.06, 0.13), trimCol, [sd * 1.35, 1.44, -0.08], carGrp, null, 0.75);
      const cPillar = M(Bx(0.10, 1.12, 0.16), bodyCol, [sd * 1.35, 1.44, -1.88], carGrp, null, 0.75);
      cPillar.rotation.x = 0.28;
    });

    const windshieldMat = new T.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.10,
      side: T.DoubleSide,
      depthWrite: false,
    });
    const sideGlassMat = new T.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.12,
      side: T.DoubleSide,
      depthWrite: false,
    });

    const frontGlass = new T.Mesh(new T.PlaneGeometry(2.66, 1.12), windshieldMat);
    frontGlass.position.set(0, 1.44, 1.50);
    frontGlass.rotation.x = -0.36;
    carGrp.add(frontGlass);

    M(Bx(2.72, 0.05, 0.05), 0x111520, [0, 1.94, 1.31], carGrp, null, 0);
    M(Bx(2.76, 0.06, 0.10), 0x111520, [0, 0.92, 1.69], carGrp, null, 0);

    wiperL = J(carGrp, 0.65, 0.94, 1.68);
    wiperL.rotation.x = -0.36;
    M(Bx(0.022, 0.68, 0.018), 0x0f172a, [0, 0.34, 0], wiperL, null, 0);
    wiperR = J(carGrp, -0.22, 0.94, 1.68);
    wiperR.rotation.x = -0.36;
    M(Bx(0.022, 0.68, 0.018), 0x0f172a, [0, 0.34, 0], wiperR, null, 0);

    M(Bx(2.68, 0.07, 0.52), trimCol, [0, 0.92, -1.76], carGrp, null, 0.5);
    const rearGlass = new T.Mesh(new T.PlaneGeometry(2.64, 1.08), windshieldMat);
    rearGlass.position.set(0, 1.44, -1.88);
    rearGlass.rotation.x = 0.28;
    carGrp.add(rearGlass);

    const rightRearGlass = new T.Mesh(new T.PlaneGeometry(1.68, 0.98), sideGlassMat);
    rightRearGlass.position.set(-1.36, 1.42, -0.95);
    rightRearGlass.rotation.y = PI / 2;
    carGrp.add(rightRearGlass);
    registerHotspot(
      rightRearGlass,
      'window',
      'Look Out the Car Window',
      '[Click / E] Gaze out at the rainy Katomos night',
      4
    );

    const rightFrontGlass = new T.Mesh(new T.PlaneGeometry(1.48, 0.98), sideGlassMat);
    rightFrontGlass.position.set(-1.36, 1.42, 0.68);
    rightFrontGlass.rotation.y = PI / 2;
    carGrp.add(rightFrontGlass);

    const leftRearGlass = new T.Mesh(new T.PlaneGeometry(1.68, 0.98), sideGlassMat);
    leftRearGlass.position.set(1.36, 1.42, -0.95);
    leftRearGlass.rotation.y = PI / 2;
    carGrp.add(leftRearGlass);

    const leftFrontGlass = new T.Mesh(new T.PlaneGeometry(1.48, 0.98), sideGlassMat);
    leftFrontGlass.position.set(1.36, 1.42, 0.68);
    leftFrontGlass.rotation.y = PI / 2;
    carGrp.add(leftFrontGlass);

    castleGhostGrp = new T.Group();
    castleGhostGrp.visible = false;
    carGrp.add(castleGhostGrp);
    {
      const ghostMat = new T.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.22,
        blending: T.AdditiveBlending,
        depthWrite: false,
      });
      const archSil = new T.Mesh(new T.TorusGeometry(0.42, 0.022, 8, 24, PI), ghostMat);
      archSil.position.set(-1.33, 1.42, -0.92);
      archSil.rotation.y = PI / 2;
      castleGhostGrp.add(archSil);
      [-0.42, 0.42].forEach(sz => {
        const colSil = new T.Mesh(new T.BoxGeometry(0.018, 0.54, 0.035), ghostMat);
        colSil.position.set(-1.33, 1.15, -0.92 + sz);
        castleGhostGrp.add(colSil);
      });
      addGlowSprite(castleGhostGrp, -1.31, 1.46, -0.92, 1.4, 0x38bdf8);
    }

    M(Bx(2.68, 0.56, 0.56), 0x161a26, [0, 0.68, 1.42], carGrp, null, 0.85);
    M(Bx(2.66, 0.09, 0.48), 0x111520, [0, 0.94, 1.40], carGrp, null, 0.6);
    M(Bx(2.62, 0.05, 0.04), woodCol, [0, 0.82, 1.14], carGrp, null, 0.4);
    M(Bx(2.62, 0.014, 0.045), 0x38bdf8, [0, 0.79, 1.14], carGrp, null, 0);
    M(Bx(0.52, 0.16, 0.03), 0x0ea5e9, [0.68, 0.98, 1.18], carGrp, null, 0);
    M(Sp(0.058), 0x38bdf8, [0.78, 0.98, 1.16], carGrp, [1, 1, 0.2], 0);
    M(Sp(0.058), 0x34d399, [0.58, 0.98, 1.16], carGrp, [1, 1, 0.2], 0);
    M(Bx(0.46, 0.22, 0.03), 0x1e293b, [0.0, 0.96, 1.16], carGrp, null, 0.5);
    M(Bx(0.42, 0.18, 0.032), 0x0284c7, [0.0, 0.96, 1.158], carGrp, null, 0);
    M(Bx(0.045, 0.032, 0.04), 0xf43f5e, [0.0, 0.81, 1.15], carGrp, null, 0);
    M(Cy(0.022, 0.028, 0.18, 8), 0x475569, [0.0, 0.68, 0.88], carGrp, null, 0);
    M(Sp(0.045), 0x111520, [0.0, 0.78, 0.88], carGrp, null, 0.5);

    steeringWheel = J(carGrp, 0.68, 0.96, 0.98);
    steeringWheel.rotation.x = -0.36;
    M(Tr(0.21, 0.028, PI * 2, 10, 24), 0x0f131d, [0, 0, 0], steeringWheel, null, 0.6);
    M(Bx(0.38, 0.032, 0.024), 0x334155, [0, 0, 0], steeringWheel, null, 0);
    M(Cy(0.045, 0.045, 0.24, 10), 0x1e293b, [0, 0, 0.11], steeringWheel, null, 0).rotation.x = PI / 2;

    const mirrorGrp = J(carGrp, 0.0, 1.74, 1.05);
    mirrorGrp.rotation.y = -0.22;
    M(Bx(0.025, 0.16, 0.025), 0x1e293b, [0, 0.10, 0], mirrorGrp, null, 0);
    const mirrorBody = M(Bx(0.42, 0.11, 0.032), 0x111520, [0, 0, 0], mirrorGrp, null, 0.6);
    const mirrorFace = new T.Mesh(
      new T.PlaneGeometry(0.39, 0.092),
      new T.MeshBasicMaterial({ map: makeRearviewMirrorTex() })
    );
    mirrorFace.position.set(0, 0, -0.018);
    mirrorFace.rotation.y = PI;
    mirrorGrp.add(mirrorFace);
    registerHotspot(
      mirrorBody,
      'driver',
      'The Driver ("Sir")',
      '[Click / E] “Sir. Can I have ice cream?”',
      2
    );

    [-0.68, 0.68].forEach(sx => {
      M(Bx(0.80, 0.18, 0.72), seatCol, [sx, 0.38, 0.62], carGrp, null, 0.85);
      [-0.36, 0.36].forEach(bx => {
        M(Bx(0.11, 0.08, 0.68), bolsterCol, [sx + bx, 0.48, 0.62], carGrp, null, 0.5);
      });
      const back = M(Bx(0.76, 0.68, 0.14), seatCol, [sx, 0.78, 0.26], carGrp, null, 0.85);
      back.rotation.x = -0.10;
      [-0.35, 0.35].forEach(bx => {
        const sb = M(Bx(0.11, 0.62, 0.16), bolsterCol, [sx + bx, 0.78, 0.28], carGrp, null, 0.6);
        sb.rotation.x = -0.10;
      });
      M(Cy(0.012, 0.012, 0.12, 8), 0x94a3b8, [sx - 0.10, 1.15, 0.22], carGrp, null, 0);
      M(Cy(0.012, 0.012, 0.12, 8), 0x94a3b8, [sx + 0.10, 1.15, 0.22], carGrp, null, 0);
      M(Bx(0.34, 0.18, 0.12), bolsterCol, [sx, 1.24, 0.22], carGrp, null, 0.75);
    });

    M(Bx(2.62, 0.20, 0.78), seatCol, [0, 0.40, -1.05], carGrp, null, 0.88);
    const rearBack = M(Bx(2.62, 0.82, 0.18), seatCol, [0, 0.88, -1.44], carGrp, null, 0.88);
    rearBack.rotation.x = -0.12;

    [-0.68, 0.68].forEach(sx => {
      [-0.40, 0.40].forEach(bx => {
        M(Bx(0.12, 0.08, 0.72), bolsterCol, [sx + bx, 0.52, -1.05], carGrp, null, 0.5);
        const rb = M(Bx(0.12, 0.74, 0.20), bolsterCol, [sx + bx, 0.88, -1.40], carGrp, null, 0.6);
        rb.rotation.x = -0.12;
      });
      M(Bx(0.42, 0.22, 0.14), bolsterCol, [sx, 1.38, -1.48], carGrp, null, 0.75);
    });

    M(Bx(0.36, 0.14, 0.62), bolsterCol, [0, 0.56, -1.02], carGrp, null, 0.7);
    M(Bx(0.30, 0.02, 0.24), woodCol, [0, 0.635, -0.86], carGrp, null, 0.4);
    [-0.07, 0.07].forEach(cx => {
      M(Cy(0.038, 0.038, 0.025, 12), 0x0f1420, [cx, 0.642, -0.84], carGrp, null, 0);
    });

    const beltMum = M(Bx(0.055, 0.72, 0.018), 0x111520, [0.68, 0.86, -0.88], carGrp, null, 0);
    beltMum.rotation.z = 0.46;

    setCS(null);
  })();

  // Place cast in car
  sc.add(ethan.g);
  carGrp.add(mother.g);
  carGrp.add(driver.g);

  driver.g.position.set(0.68, 0.04, 0.58);
  mother.g.position.set(0.68, 0.06, -1.02);
  ethan.g.position.set(-0.68, 0.06, -1.05);

  mother.g.traverse((o: any) => {
    if (o.isMesh) {
      registerHotspot(
        o,
        'mum',
        'Mum (Sleeping Across the Back Seat)',
        '[Click / E] “Mum I am hungry. Can I have ice cream”',
        1
      );
    }
  });
  driver.g.traverse((o: any) => {
    if (o.isMesh) {
      registerHotspot(
        o,
        'driver',
        'The Driver ("Sir")',
        '[Click / E] Talk to the Driver',
        2
      );
    }
  });
  if (ethan.propConsole) {
    ethan.propConsole.traverse((o: any) => {
      if (o.isMesh) {
        registerHotspot(
          o,
          'console',
          'Ethan’s Handheld Console',
          '[Click / E] Open Stickman Knight & Sofi Chat (18:53)',
          0
        );
      }
    });
  }

  // ============================================================================
  // CHARACTER STUDIO TURNTABLE STAGE (FOR ALL 13 PRESERVED CHARACTERS)
  // ============================================================================
  const studioGrp = new T.Group();
  studioGrp.visible = false;
  sc.add(studioGrp);
  let studioInstance: any = null;
  let studioCharKey = '';
  let studioOutfitIdx = 0;
  let studioPoseName = 'Idle';

  (function buildStudioPedestal() {
    setCS({ gm: grad([0.38, 0.72, 1], 0), w: 0.75, oc: new T.Color(0x16121e) });
    M(Cy(1.15, 1.25, 0.14, 32), 0x1e2436, [0, -0.07, 0], studioGrp, null, 0.8);
    M(Tr(1.12, 0.018, PI * 2, 10, 36), 0xdfb879, [0, 0.01, 0], studioGrp, null, 0).rotation.x = PI / 2;
    setCS(null);
  })();

  function setStudioCharacter(charId: string, outfitIdx = 0, poseName = 'Idle') {
    const key = `${charId}:${outfitIdx}`;
    studioPoseName = poseName;
    if (key === studioCharKey && studioInstance) return studioInstance.s;
    studioCharKey = key;
    studioOutfitIdx = outfitIdx;
    if (studioInstance && studioInstance.g) {
      studioGrp.remove(studioInstance.g);
    }
    const d = defs.find((x: any) => x.id === charId) || defs[0];
    studioInstance = build(d, outfitIdx);
    studioGrp.add(studioInstance.g);
    tpYaw = 0.24;
    tpPitch = 0.08;
    return d;
  }

  // ============================================================================
  // STICKMAN KNIGHT MINI-GAME (LIVE CANVAS + MIRRORED ON 3D CONSOLE IN LAP)
  // ============================================================================
  const skCtx = stickmanCanvas.getContext('2d')!;
  const keys = new Set<string>();
  let audienceAid:KnightAid=null;
  let encounterActive=false;
  let encounterPaused=false;
  let worldPaused=false;
  let lookPreferences={sensitivity:1,invertY:false};
  let reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const G: any = {
    wins: 0,
    kx: 90,
    ky: 0,
    kvy: 0,
    kHp: 100,
    kAct: '',
    kT: 0,
    kCd: 0,
    bx: 270,
    bHp: 100,
    bState: 'walk',
    bT: 0,
    msg: '',
    msgT: 0,
    idle: 0,
    fall: null,
    sparks: [],
    damageDealt:0,blocks:0,deaths:0,shieldSaves:0,jumps:0,slashes:0,lastHit:null,
  };
  const GROUND = 168;
  // Cached ink masonry: a visual adaptation of the specialist's hatch vocabulary,
  // reconstructed here without importing its game, audio or state systems.
  const inkArena=document.createElement('canvas');inkArena.width=360;inkArena.height=200;
  const ink=inkArena.getContext('2d')!;
  ink.fillStyle='#151c18';ink.fillRect(0,0,360,200);
  ink.fillStyle='#343c2e';ink.beginPath();ink.arc(205,47,13,0,Math.PI*2);ink.fill();
  function inkTower(x:number,y:number,w:number) {
    ink.fillStyle='#252f27';ink.beginPath();ink.moveTo(x-2,GROUND);ink.lineTo(x+1,y+5);ink.lineTo(x+w*.28,y+3);ink.lineTo(x+w*.28,y-5);ink.lineTo(x+w*.52,y-6);ink.lineTo(x+w*.52,y+3);ink.lineTo(x+w*.76,y+4);ink.lineTo(x+w*.76,y-5);ink.lineTo(x+w+1,y-3);ink.lineTo(x+w-1,GROUND);ink.closePath();ink.fill();
    ink.strokeStyle='#66705a55';ink.lineWidth=.65;
    for(let row=0;row<8;row++){const yy=y+19+row*17;ink.beginPath();ink.moveTo(x+3,yy);ink.lineTo(x+w-4,yy+1);ink.stroke();for(let col=0;col<3;col++){const xx=x+8+col*17+(row%2)*7;ink.beginPath();ink.moveTo(xx,yy);ink.lineTo(xx-1,yy+14);ink.stroke();}}
    ink.fillStyle='#141b17';ink.fillRect(x+w*.43,y+24,7,20);
    ink.strokeStyle='#131b16';for(let i=0;i<9;i++){ink.beginPath();ink.moveTo(x+5+i*4,y+61);ink.lineTo(x-1+i*4,y+79);ink.stroke();}
  }
  inkTower(18,42,53);inkTower(292,29,58);
  ink.fillStyle='#35342a';ink.beginPath();ink.moveTo(0,168);ink.lineTo(60,167);ink.lineTo(145,169);ink.lineTo(240,167);ink.lineTo(360,169);ink.lineTo(360,200);ink.lineTo(0,200);ink.closePath();ink.fill();
  ink.strokeStyle='#89765580';ink.lineWidth=.8;for(let i=0;i<14;i++){ink.beginPath();ink.moveTo(i*29+3,170);ink.lineTo(i*28-12,199);ink.stroke();}ink.beginPath();ink.moveTo(0,183);ink.lineTo(360,185);ink.stroke();

  function spark(x: number, y: number, n: number, col: string) {
    if(reducedMotion)return;
    for (let i = 0; i < n; i++) {
      G.sparks.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 180,
        vy: (Math.random() - 0.8) * 140,
        life: 0.35,
        col,
      });
    }
  }
  function say(m: string, t = 1.2) {
    G.msg = m;
    G.msgT = t;
  }
  function skAct(type: 'jump' | 'block' | 'slash', byPlayer = true) {
    if(worldPaused||(encounterActive&&encounterPaused))return;
    if (byPlayer) G.idle = 0;
    if (G.fall || (byPlayer && (!stateRef.consoleOpen || stateRef.consoleTab !== 'game'))) return;
    if (type === 'jump') {
      if (G.ky <= 0.1) {G.kvy = 330;G.jumps++;if(byPlayer)audBlip(390);}
      return;
    }
    if (G.kCd > 0) return;
    if (type === 'block') {
      if(byPlayer)audBlip(240);
      G.kAct = 'block';
      G.kT = 0.55;
      G.kCd = 0.15;
      return;
    }
    G.kAct = 'slash';
    if(byPlayer)audBlip(170);
    G.slashes++;
    G.kT = 0.28;
    G.kCd = 0.4;
    if (Math.abs(G.bx - G.kx) < 74 && G.bState !== 'stun') {
      const damage=Math.min(G.bHp,aidDamage(audienceAid));G.damageDealt+=damage;G.bHp-=damage;
      G.bState = 'stun';
      G.bT = 0;
      spark(G.bx - 10, GROUND - 40, 10, '#fde047');
      if (G.bHp <= 0) {
        G.wins++;
        callbacks.onStickmanWinChange(G.wins);
        say('VICTORY!', 1.9);
        G.fall = { who: 'b', t: 0, hit: false };
      }
    }
  }

  function stepAndDrawStickmanGame(t: number, dt: number) {
    stickmanCanvas.dataset.knightX=G.kx.toFixed(2);
    stickmanCanvas.dataset.enemyHealth=String(G.bHp);
    stickmanCanvas.dataset.aid=audienceAid?.value??'none';
    stickmanCanvas.dataset.jump=G.ky.toFixed(2);
    stickmanCanvas.dataset.enemyX=G.bx.toFixed(2);stickmanCanvas.dataset.enemyState=G.bState;stickmanCanvas.dataset.knightHealth=String(G.kHp);stickmanCanvas.dataset.blocks=String(G.blocks);stickmanCanvas.dataset.shieldSaves=String(G.shieldSaves);stickmanCanvas.dataset.wins=String(G.wins);
    stickmanCanvas.dataset.lastHit=JSON.stringify(G.lastHit);
    if(worldPaused || stateRef.mode!=='playing' || !stateRef.consoleOpen || stateRef.consoleTab!=='game' || (encounterActive && encounterPaused)) dt=0;
    stickmanCanvas.dataset.simulation=JSON.stringify({dt,encounterActive,encounterPaused,mode:stateRef.mode,consoleOpen:stateRef.consoleOpen,consoleTab:stateRef.consoleTab,keys:[...keys]});
    audienceAid=stepAid(audienceAid,dt);
    const W = stickmanCanvas.width;
    const H = stickmanCanvas.height;
    const c = skCtx;
    const playing = stateRef.consoleOpen && stateRef.consoleTab === 'game';
    G.idle += dt;
    const auto = !encounterActive && !playing;
    const F = G.fall;
    if (F) {
      F.t += dt;
      if (!F.hit && F.t > 0.5) {
        F.hit = true;
        spark(F.who === 'k' ? G.kx : G.bx, GROUND - 4, 12, '#94a3b8');
      }
      if (F.t > 2.0) {
        G.fall = null;
        G.kHp = 100;
        G.bHp = 100;
        G.bState = 'walk';
        G.bT = 0;
        G.sparks.length = 0;
        if (F.who === 'k') {
          G.kx = 90;
          G.bx = 290;
        } else G.bx = 300;
      }
    }
    const L = keys.has('arrowleft') || keys.has('a');
    const Rr = keys.has('arrowright') || keys.has('d');
    let mv = F ? 0 : (Rr ? 1 : 0) - (L ? 1 : 0);
    if (!F && (L || Rr) && playing) G.idle = 0;
    if (auto && !F) {
      const d = G.bx - G.kx;
      mv = Math.abs(d) > 62 ? Math.sign(d) : 0;
      if (G.bState === 'wind' && Math.abs(d) < 80 && G.kAct !== 'block' && G.bT > 0.15) skAct('block', false);
      else if (Math.abs(d) < 70 && G.bState !== 'wind') skAct('slash', false);
    }
    G.kx = clamp(G.kx + mv * 125 * dt, 22, 338);
    if (G.ky > 0 || G.kvy > 0) {
      G.ky += G.kvy * dt;
      G.kvy -= 900 * dt;
      if (G.ky <= 0) {
        G.ky = 0;
        G.kvy = 0;
      }
    }
    G.kCd -= dt;
    if (G.kT > 0 && (G.kT -= dt) <= 0) G.kAct = '';
    if (G.msgT > 0) G.msgT -= dt;
    G.bT += dt;
    const dx = G.kx - G.bx;
    const dist = Math.abs(dx);
    if (!F) {
      if (G.bState === 'walk') {
        if (dist > 56) G.bx += Math.sign(dx) * 55 * dt;
        else if (G.bT > 0.9) {
          G.bState = 'wind';
          G.bT = 0;
          if(encounterActive)say('Incoming strike · block or jump',.55);
        }
      } else if (G.bState === 'wind' && G.bT > 0.6) {
        if (dist < 76) {
          if (G.kAct === 'block' || audienceAid?.value==='shield') {
            const shield=audienceAid?.value==='shield';
            G.blocks++;
            if(shield) {audienceAid=null;G.shieldSaves++;}
            G.lastHit={kind:shield?'audience-shield':'block',before:G.kHp,after:G.kHp};
            spark(G.kx + 16, GROUND - 34, 8, '#91ad98');
            say(shield?'Audience shield absorbed the hit!':G.kT>.35?'Timed block!':'Blocked!',shield?1.3:.6);
          } else if (G.ky > 24) {G.lastHit={kind:'jump',before:G.kHp,after:G.kHp};say('Dodged!', 0.6);}
          else {
            const before=G.kHp;
            G.kHp -= 18;
            G.lastHit={kind:'damage',before,after:Math.max(0,G.kHp)};
            spark(G.kx, GROUND - 40, 8, '#f43f5e');
            G.kx = clamp(G.kx - 24, 22, 338);
            if (G.kHp <= 0) {
              G.deaths++;
              G.kHp = 0;
              G.fall = { who: 'k', t: 0, hit: false };
              say('Knight down · retry in 2 seconds', 1.8);
            }
          }
        }
        G.bState = 'rest';
        G.bT = 0;
      } else if (G.bState === 'rest' && G.bT > 0.7) {
        G.bState = 'walk';
        G.bT = 0;
      } else if (G.bState === 'stun' && G.bT > 0.35) {
        G.bState = 'walk';
        G.bT = 0;
      }
    }

    c.drawImage(inkArena,0,0,W,H);
    const ease = (a: number) => {
      a = clamp(a, 0, 1);
      return a * a * (3 - 2 * a);
    };
    function man(x: number, y: number, face: number, col: string, king: boolean, fallT?: number) {
      const down = fallT !== undefined;
      c.save();
      c.translate(x, y);
      c.scale(face, 1);
      if (down) c.rotate((-ease(fallT / 0.5) * PI) / 2);
      const moving = king ? G.bState === 'walk' && dist > 56 : mv;
      const sw = down ? 4 : Math.sin(t * 8 + (king ? 2 : 0)) * (moving ? 8 : 1.5);
      c.lineCap = 'round';
      c.lineWidth = 2.8;
      c.strokeStyle = col;
      c.beginPath();
      c.moveTo(0, -24);
      c.lineTo(-7 + sw, 0);
      c.moveTo(0, -24);
      c.lineTo(7 - sw, 0);
      c.moveTo(0, -24);
      c.lineTo(0, -48);
      c.stroke();
      c.beginPath();
      c.arc(0, -57, 9, 0, PI * 2);
      c.fillStyle = '#0f172a';
      c.fill();
      c.stroke();
      if (down) {
        c.lineWidth = 1.8;
        c.beginPath();
        [-4, 3].forEach(ex => {
          c.moveTo(ex - 2, -60);
          c.lineTo(ex + 2, -55);
          c.moveTo(ex + 2, -60);
          c.lineTo(ex - 2, -55);
        });
        c.stroke();
        c.lineWidth = 2.8;
      }
      const swing = down ? 0 : king ? (G.bState === 'wind' ? -1 : G.bState === 'rest' ? 1 : 0) : G.kAct === 'slash' ? 1 : 0;
      const ax = down ? 12 : 14;
      const ay = down ? -30 : -38 + (swing > 0 ? 4 : 0);
      c.beginPath();
      c.moveTo(0, -42);
      c.lineTo(ax, ay);
      c.stroke();
      c.strokeStyle = king ? '#a7a49b' : audienceAid?.value==='torch'?'#e4a443':'#d8c58e';
      c.lineWidth = 3.2;
      c.beginPath();
      c.moveTo(ax, ay);
      c.lineTo(ax + (swing > 0 ? 30 : down ? 20 : 17), ay + (swing > 0 ? -2 : swing < 0 ? -34 : down ? 8 : -18));
      c.stroke();
      if (king) {
        c.fillStyle = '#fbbf24';
        c.beginPath();
        c.moveTo(-7, -65);
        c.lineTo(-7, -73);
        c.lineTo(-2, -68);
        c.lineTo(0, -74);
        c.lineTo(3, -68);
        c.lineTo(7, -73);
        c.lineTo(7, -65);
        c.fill();
      } else {
        c.strokeStyle = audienceAid?.value==='shield'?'#b1c9b1':'#9dbaa9';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(-2, -65);
        c.quadraticCurveTo(-13, -73, -17, -64);
        c.stroke();
        if ((G.kAct === 'block'||audienceAid?.value==='shield') && !down) {
          c.lineWidth = 4;
          c.beginPath();
          c.arc(16, -36, 15, -PI * 0.45, PI * 0.45);
          c.stroke();
        }
      }
      c.restore();
    }
    const kface = G.bx >= G.kx ? 1 : -1;
    man(G.kx, GROUND - G.ky, kface, '#f8fafc', false, F && F.who === 'k' ? F.t : undefined);
    man(G.bx, GROUND, -kface, '#cbd5e1', true, F && F.who === 'b' ? F.t : undefined);
    if (G.bState === 'wind' && !F) {
      c.fillStyle = '#f43f5e';
      c.font = '700 22px sans-serif';
      c.textAlign = 'center';
      c.fillText('!', G.bx, GROUND - 90);
    }
    const bar = (x: number, w: number, v: number, col: string, lbl: string) => {
      c.fillStyle = 'rgba(0,0,0,.55)';
      c.fillRect(x, 10, w, 7);
      c.fillStyle = col;
      c.fillRect(x, 10, w * clamp(v / 100, 0, 1), 7);
      c.fillStyle = '#cbd5e1';
      c.font = '600 9px sans-serif';
      c.textAlign = 'left';
      c.fillText(lbl, x, 28);
    };
    bar(10, 120, G.kHp, '#9db9a5', 'KNIGHT');
    bar(W - 130, 120, G.bHp, '#f43f5e', 'KING');
    if (auto && playing && !F) {
      c.fillStyle = 'rgba(203,213,225,.7)';
      c.font = '600 10px sans-serif';
      c.textAlign = 'center';
      c.fillText('DEMO · press any move to play', W / 2, 46);
    }
    if (G.msgT > 0) {
      c.fillStyle = '#fde68a';
      c.font = '700 20px sans-serif';
      c.textAlign = 'center';
      c.fillText(G.msg, W / 2, 84);
    }
    for (let i = G.sparks.length - 1; i >= 0; i--) {
      const s = G.sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 300 * dt;
      if ((s.life -= dt) <= 0) {
        G.sparks.splice(i, 1);
        continue;
      }
      c.fillStyle = s.col;
      c.fillRect(s.x, s.y, 3, 3);
    }
    if (conScreenCtx && conScreenTex) {
      conScreenCtx.drawImage(stickmanCanvas, 0, 0);
      conScreenTex.needsUpdate = true;
    }
  }

  // ============================================================================
  // DRIVER GAZE CONTROLLER & CAST ANIMATION (SCENE I & SCENE II)
  // ============================================================================
  const rstPose = (c: any) => {
    const j = c.j;
    for (const k in j) {
      if (k === 'mouth' || k[0] === 'b') continue;
      j[k].rotation.set(0, 0, 0);
    }
    j.root.position.set(0, 0.95, 0);
    j.torso.position.set(0, 0.02, 0);
  };

  const GZ: Record<string, { hy: number; hp: number; gx: number; gy: number }> = {
    road: { hy: -0.28, hp: 0.02, gx: 0, gy: 0.05 },
    mirror: { hy: -0.52, hp: -0.10, gx: -0.50, gy: -0.40 },
    window: { hy: 0.12, hp: 0.0, gx: 0.55, gy: 0 },
    dash: { hy: -0.30, hp: 0.22, gx: 0, gy: 0.70 },
    ethan: { hy: -0.22, hp: 0.06, gx: -0.15, gy: 0 },
  };
  const DG: any = {
    key: 'road',
    until: 3,
    clock: 0,
    hy: -0.28,
    vhy: 0,
    hp: 0.02,
    vhp: 0,
    gx: 0,
    vgx: 0,
    gy: 0.05,
    vgy: 0,
    bk: 0,
    blinkT: -1,
    nextBlink: 3,
    engaged: false,
    v: 0,
    px: 0,
    py: 0,
  };

  function setDriverGaze(key: string, hold?: number) {
    if (!GZ[key]) key = 'road';
    if (key !== DG.key && Math.random() < 0.6 && DG.blinkT < 0) DG.blinkT = 0;
    DG.key = key;
    DG.until = DG.clock + (hold || 3);
  }

  function driverGazeStep(t: number, dt: number, engaged: boolean) {
    DG.clock += dt;
    if (engaged !== DG.engaged) {
      DG.engaged = engaged;
      setDriverGaze(engaged ? 'ethan' : 'road', 3);
    } else if (!engaged && DG.clock >= DG.until) {
      if (DG.key !== 'road') setDriverGaze('road', 2.4 + Math.random() * 3.6);
      else {
        const r = Math.random();
        setDriverGaze(r < 0.5 ? 'mirror' : r < 0.78 ? 'window' : 'dash', 0.8 + Math.random() * 0.8);
      }
    }
    const target = GZ[DG.key];
    const sHy = springStep(DG.hy, DG.vhy, target.hy, 7.5, dt);
    DG.hy = sHy.value;
    DG.vhy = sHy.velocity;
    const sHp = springStep(DG.hp, DG.vhp, target.hp, 7.5, dt);
    DG.hp = sHp.value;
    DG.vhp = sHp.velocity;

    const egx = clamp(target.gx + (target.hy - DG.hy) * 2.4, -1, 1) + S(t * 1.9) * 0.03;
    const egy = clamp(target.gy + (target.hp - DG.hp) * 3.0, -1, 1) + S(t * 2.7) * 0.02;
    const sGx = springStep(DG.gx, DG.vgx, egx, 26, dt);
    DG.gx = sGx.value;
    DG.vgx = sGx.velocity;
    const sGy = springStep(DG.gy, DG.vgy, egy, 26, dt);
    DG.gy = sGy.value;
    DG.vgy = sGy.velocity;

    DG.nextBlink -= dt;
    if (DG.nextBlink <= 0 && DG.blinkT < 0) {
      DG.blinkT = 0;
      DG.nextBlink = 2.8 + Math.random() * 3.4;
    }
    if (DG.blinkT >= 0) {
      DG.blinkT += dt;
      DG.bk = S((PI * DG.blinkT) / 0.16);
      if (DG.blinkT > 0.16) {
        DG.blinkT = -1;
        DG.bk = 0;
      }
    }
    const Mref = GZ.mirror;
    const d =
      Math.abs(DG.hy - Mref.hy) * 1.2 +
      Math.abs(DG.hp - Mref.hp) * 1.6 +
      Math.abs(DG.gx - Mref.gx) * 0.25 +
      Math.abs(DG.gy - Mref.gy) * 0.25;
    const u = clamp((0.5 - d) / 0.4, 0, 1);
    DG.v = u * u * (3 - 2 * u);
    DG.px = -(DG.gx - Mref.gx);
    DG.py = DG.gy - Mref.gy;
  }

  let drvBlend = 0;
  let carDriveOffZ = 0;
  let doorOpenBlend = 0;

  function animateCast(t: number, dt: number) {
    if (stateRef.mode === 'studio') {
      if (studioInstance && studioInstance.s && studioInstance.s.an) {
        const fn = studioInstance.s.an[studioPoseName] || studioInstance.s.an.Idle || Object.values(studioInstance.s.an)[0];
        if (studioInstance.j && studioInstance.j.root) rstPose(studioInstance);
        if (fn) fn(studioInstance, t);
        studioInstance.g.rotation.y = S(t * 0.55) * 0.45;
      }
      return;
    }

    // 1. ETHAN'S MOTHER (Always sleeping in Rear-Left Seat of the Car, even as the car drives off in Scene 2 Beat 3!)
    rstPose(mother);
    {
      const j = mother.j;
      mother.g.position.set(0.68, 0.06, -1.02);
      mother.g.rotation.y = -0.64;
      j.root.position.y = 0.66;
      j.lL.rotation.x = -1.24;
      j.lR.rotation.x = -1.24;
      j.kL.rotation.x = 1.28;
      j.kR.rotation.x = 1.28;
      j.torso.rotation.x = -0.06;
      j.torso.rotation.z = 0.09;
      j.head.rotation.x = 0.22;
      j.head.rotation.z = 0.16;
      j.head.rotation.y = -0.20;
      j.aL.rotation.x = -0.45;
      j.aR.rotation.x = -0.45;
      j.eL.rotation.x = -0.65;
      j.eR.rotation.x = -0.65;
      j.aL.rotation.z = 0.14;
      j.aR.rotation.z = -0.14;
      paintFace(mother, { lid: 1.0, sm: -0.04 });
    }

    // 2. THE DRIVER / "SIR"
    rstPose(driver);
    {
      const j = driver.j;
      driver.g.position.set(0.68, 0.04, 0.58);
      j.root.position.y = 0.66;
      j.lL.rotation.x = -1.18;
      j.lR.rotation.x = -1.12;
      j.kL.rotation.x = 1.12;
      j.kR.rotation.x = 1.04;
      const isMoving = stateRef.sceneId === 1 || (stateRef.sceneId === 2 && stateRef.beatIdx >= 3);
      const steerOsc = isMoving ? S(t * 1.6) * 0.07 : 0;
      if (steeringWheel) steeringWheel.rotation.z = steerOsc * 1.8;

      const engaged =
        (stateRef.sceneId === 1 && stateRef.beatIdx === 2) ||
        (stateRef.sceneId === 2 && stateRef.beatIdx <= 1);
      drvBlend += ((engaged ? 1 : 0) - drvBlend) * Math.min(1, dt * 4.5);
      const B = drvBlend;
      const Lp = (x: number, y: number) => x + (y - x) * B;
      driver.g.rotation.y = Lp(-0.32, -2.18);
      j.torso.rotation.x = Lp(0.04, 0.08);
      driverGazeStep(t, dt, engaged);
      j.head.rotation.y = DG.hy + S(t * 0.7) * 0.02 * (1 - B);
      j.head.rotation.x = DG.hp;
      j.aL.rotation.x = Lp(-0.92 + steerOsc, -0.85);
      j.eL.rotation.x = Lp(-0.52, -0.45);
      j.aR.rotation.x = Lp(-0.86 - steerOsc, -0.55);
      j.eR.rotation.x = Lp(-0.56, -0.65);
      const annoyed =
        (stateRef.sceneId === 1 && stateRef.beatIdx === 2 && stateRef.lineIdx >= 1) ||
        (stateRef.sceneId === 2 && stateRef.beatIdx <= 1);
      const talking = engaged && stateRef.curSpeaker === 'Sir';
      const fx: any = { gx: Math.round(DG.gx * 20) / 20, gy: Math.round(DG.gy * 20) / 20 };
      if (B > 0.5 && annoyed) {
        Object.assign(fx, {
          bl: -0.3,
          br: -0.3,
          a: -0.2,
          sm: -0.2,
          op: talking ? 0.2 + Math.abs(S(t * 9.5)) * 0.35 : 0,
        });
      } else if (B > 0.5) fx.lid = 0.1;
      else {
        fx.lid = 0.12;
        fx.sm = 0.02;
      }
      driver.bk = DG.bk;
      paintFace(driver, fx);
      setMirrorState(annoyed && B > 0.5, DG.v, DG.px, DG.py, DG.bk);
    }

    // 3. AUNT MOMMA & SCENE 2 / SCENE 3 PROPS
    if (stateRef.sceneId === 2) {
      rstPose(aunt);
      const aj = aunt.j;
      if (stateRef.beatIdx <= 2) {
        // Standing by the curb catching Ethan ("Ethan dear, be careful.")
        aunt.g.position.set(-3.75, 0.02, -1.05);
        aunt.g.rotation.y = 1.57;
        aj.aL.rotation.x = -0.52;
        aj.aR.rotation.x = -0.52;
        aj.eL.rotation.x = -0.35;
        aj.eR.rotation.x = -0.35;
      } else if (stateRef.beatIdx === 3) {
        // Guiding Ethan away from the departing car ("Let's forget about that dear, come.")
        aunt.g.position.set(-3.65, 0.02, -1.15);
        aunt.g.rotation.y = -1.25;
        aj.aR.rotation.x = -0.55;
        aj.aR.rotation.z = -0.25;
      } else {
        // Standing on the porch opening the stinky door ("Welcome to your new home, Ethan.")
        aunt.g.position.set(-5.85, 0.36, -0.55);
        aunt.g.rotation.y = 0.55;
        aj.aL.rotation.x = -0.75;
        aj.eL.rotation.x = -0.40;
      }
      const auntTalking = stateRef.curSpeaker === 'Aunt Momma';
      paintFace(aunt, {
        sm: 0.28,
        bl: 0.12,
        br: 0.12,
        op: auntTalking ? 0.18 + Math.abs(S(t * 8.5)) * 0.28 : 0,
      });

      // Yard dog tail wag & head look
      if (yardDogGrp) {
        yardDogGrp.rotation.y = 0.65 + S(t * 2.1) * 0.12;
      }
      // Door opening & stink wisps on Beat 4
      const doorGoal = stateRef.beatIdx >= 4 ? -1.18 : 0;
      doorOpenBlend += (doorGoal - doorOpenBlend) * Math.min(1, dt * 3.5);
      if (frontDoorPivot) frontDoorPivot.rotation.y = doorOpenBlend;
      stinkWisps.forEach((w, idx) => {
        w.visible = stateRef.beatIdx >= 4;
        if (w.visible) {
          w.position.x = -6.5 + ((t * 0.45 + idx * 0.22) % 1.4);
          w.position.y = 1.05 + idx * 0.18 + S(t * 2.2 + idx) * 0.12;
        }
      });
    } else if (stateRef.sceneId === 3) {
      // SCENE III: Inside the Stinky House Foyer
      rstPose(aunt);
      const aj = aunt.j;
      const auntTalking = stateRef.curSpeaker === 'Aunt Momma';
      if (stateRef.beatIdx === 0) {
        // Beat 0: Scolding Ethan for saying "It smells like poop." ("wash your mouth with soap!")
        aunt.g.position.set(0.0, 0.02, 0.10);
        aunt.g.rotation.y = PI;
        aj.aR.rotation.x = -1.25 + S(t * 7.5) * 0.14;
        aj.eR.rotation.x = -0.55;
        aj.aL.rotation.z = 0.22;
        paintFace(aunt, {
          sm: -0.26,
          bl: -0.25,
          br: -0.25,
          op: auntTalking ? 0.24 + Math.abs(S(t * 9.5)) * 0.32 : 0.05,
        });
      } else if (stateRef.beatIdx === 1) {
        // Beat 1: Kneeling on one knee like a knight with emotional tears ("You can call me Aunt Momma.")
        aunt.g.position.set(0.0, 0.02, -0.32);
        aunt.g.rotation.y = PI;
        if (aunt.s.an && aunt.s.an['Kneel Like a Knight']) {
          aunt.s.an['Kneel Like a Knight'](aunt, t);
        }
        paintFace(aunt, {
          sm: 0.26,
          bl: 0.24,
          br: 0.24,
          tear: 1.0,
          op: auntTalking ? 0.18 + Math.abs(S(t * 8.0)) * 0.28 : 0,
        });
      } else if (stateRef.beatIdx === 2) {
        // Beat 2: Ethan falls on purpose on the floor; Aunt Momma gasps beside him
        aunt.g.position.set(0.32, 0.02, -0.25);
        aunt.g.rotation.y = -2.92;
        aj.torso.rotation.x = 0.18;
        aj.aL.rotation.x = -0.95;
        aj.aR.rotation.x = -0.95;
        aj.eL.rotation.x = -0.65;
        aj.eR.rotation.x = -0.65;
        paintFace(aunt, {
          sm: -0.18,
          bl: 0.28,
          br: 0.28,
          op: 0.22,
        });
      } else if (stateRef.beatIdx === 3) {
        // Beat 3: Standing by the dining table with hot smelly soup, soap bar & plaster tin
        aunt.g.position.set(1.12, 0.02, 0.42);
        aunt.g.rotation.y = -2.45;
        aj.aL.rotation.x = -0.68;
        aj.eL.rotation.x = -0.45;
        aj.aR.rotation.x = -0.52 + S(t * 4.2) * 0.12;
        paintFace(aunt, {
          sm: 0.30,
          bl: 0.14,
          br: 0.14,
          op: auntTalking ? 0.18 + Math.abs(S(t * 8.5)) * 0.28 : 0,
        });
      } else {
        // Beat 4: Pointing Ethan toward the creaky stairs to go upstairs to bed
        aunt.g.position.set(0.75, 0.02, 0.25);
        aunt.g.rotation.y = -1.95;
        aj.aR.rotation.x = -1.15;
        aj.aR.rotation.z = -0.25;
        paintFace(aunt, { sm: 0.16, lid: 0.12 });
      }

      // Animate rising soup steam & foyer stink wisps
      soupPotSteam.forEach((sp, idx) => {
        sp.position.y = 1.12 + ((t * 0.38 + idx * 0.24) % 0.85);
        sp.position.x = 1.57 + S(t * 2.4 + idx) * 0.06;
      });
      hallStinkWisps.forEach((w, idx) => {
        w.position.y = 0.85 + (idx % 3) * 0.42 + S(t * 1.8 + idx) * 0.14;
        w.position.x = -1.7 + (idx % 4) * 1.1 + C(t * 1.2 + idx) * 0.12;
      });
    } else if (stateRef.sceneId === 4) {
      // SCENE IV: Upstairs Bedroom (Torn Teddy Bear, Mother Memory & Dragon Princeps Outside Window)
      if (danglingEyePivot) {
        danglingEyePivot.rotation.z = S(t * 3.2) * 0.14;
        danglingEyePivot.rotation.x = C(t * 2.5) * 0.08;
      }
      if (teddyGrp) {
        teddyGrp.position.y = 0.60 + S(t * 1.6) * 0.006;
      }

      // Mother's Tearful Memory Apparition (highlighted on Beat 2, softly visible in bedroom)
      rstPose(motherMemory);
      {
        const mj = motherMemory.j;
        motherMemory.g.position.set(1.35, 0.04 + S(t * 1.8) * 0.02, 0.35);
        motherMemory.g.rotation.y = -2.45 + S(t * 0.9) * 0.06;
        mj.head.rotation.x = 0.16;
        mj.head.rotation.z = -0.08;
        mj.aL.rotation.x = -0.95;
        mj.eL.rotation.x = -0.85;
        mj.aR.rotation.x = -0.72 + S(t * 2.4) * 0.08;
        mj.eR.rotation.x = -0.55;
        paintFace(motherMemory, {
          lid: 0.38,
          sm: -0.24,
          bl: 0.28,
          br: 0.28,
          tear: 1.0,
        });
      }

      // Dragon Princeps outside the rainy bedroom window (Beat 4 nightmare foreshadowing)
      if (princeps && princeps.s && princeps.s.an) {
        if (stateRef.beatIdx === 4 && princeps.s.an['Roar Pink-Blue Fire!']) {
          princeps.s.an['Roar Pink-Blue Fire!'](princeps, t);
        } else if (princeps.s.an.Idle) {
          princeps.s.an.Idle(princeps, t);
        }
        princeps.g.position.set(-2.55, 0.25 + S(t * 1.7) * 0.04, 1.15);
        princeps.g.rotation.y = 2.25 + S(t * 0.8) * 0.08;
      }
    }

    // 4. ETHAN (Inside Car in Scene 1 & Scene 2 Beats 0-1; Walking/Acting in Scene 2 Beats 2-4, Scene 3 & Scene 4)
    rstPose(ethan);
    {
      const j = ethan.j;
      const p = (t + 0.7) % 3.4;
      ethan.bk = p < 0.13 ? S((p / 0.13) * PI) : 0;

      // Show tummy plaster bandage from Scene 3 Beat 3 onward (and throughout Scene 4)
      if (ethanBandageMesh) {
        ethanBandageMesh.visible =
          (stateRef.sceneId === 3 && stateRef.beatIdx >= 3) || stateRef.sceneId === 4;
      }

      const inCar = stateRef.sceneId === 1 || (stateRef.sceneId === 2 && stateRef.beatIdx <= 1);
      if (inCar) {
        ethan.g.position.set(-0.68, 0.06, -1.05);
        ethan.g.rotation.y = 0;
        j.root.position.y = 0.68;
        j.lL.rotation.x = -1.22;
        j.lR.rotation.x = -1.22;
        j.kL.rotation.x = 1.32 + S(t * 3.0) * 0.06;
        j.kR.rotation.x = 1.32 - S(t * 3.0) * 0.06;

        if (stateRef.sceneId === 2 && stateRef.beatIdx <= 1) {
          // Scene 2 Beat 0-1: Waking up scratching itchy eyes ("im sorry my eyes hurt.")
          if (ethan.propConsole) ethan.propConsole.visible = false;
          j.aR.rotation.x = -2.15;
          j.aR.rotation.z = -0.28;
          j.eR.rotation.x = -1.12 + S(t * 11) * 0.16;
          j.aL.rotation.x = -0.55;
          j.head.rotation.z = 0.12;
          paintFace(ethan, { lid: 0.65, sm: -0.22, bl: -0.18, br: -0.18 });
        } else {
          if (ethan.propConsole) ethan.propConsole.visible = true;
          if (ethan.propSword) ethan.propSword.visible = false;
          if (ethan.propShield) ethan.propShield.visible = false;
          j.aL.rotation.x = -0.82;
          j.aR.rotation.x = -0.82;
          j.aL.rotation.z = 0.16;
          j.aR.rotation.z = -0.16;
          j.eL.rotation.x = -0.92 + S(t * 9) * 0.04;
          j.eR.rotation.x = -0.92 - S(t * 9) * 0.04;
          j.head.rotation.y = clamp(fpYaw * 0.55, -0.75, 0.75);
          j.head.rotation.x = clamp(-fpPitch * 0.65, -0.35, 0.35);
          paintFace(ethan, { sm: stateRef.beatIdx === 2 ? -0.14 : 0.22, bl: 0.12, br: 0.12 });
        }
      } else {
        // Scene 2 (Beats 2-4), Scene 3 (Hallway), or Scene 4 (Bedroom)
        const showConsoleInHand = stateRef.sceneId === 4 && stateRef.beatIdx === 3;
        if (ethan.propConsole) ethan.propConsole.visible = showConsoleInHand;
        if (ethan.propSword) ethan.propSword.visible = false;
        if (ethan.propShield) ethan.propShield.visible = false;

        ethan.g.position.set(stateRef.walkerX, 0.02, stateRef.walkerZ);
        ethan.g.rotation.y = fpYaw;

        if (stateRef.sceneId === 3 && stateRef.beatIdx === 2) {
          // Scene 3 Beat 2: Ethan deliberately falls on the floorboards clutching his scraped tummy
          j.root.position.y = 0.52;
          j.torso.rotation.x = 0.42;
          j.torso.rotation.z = -0.18;
          j.lL.rotation.x = -1.05;
          j.kL.rotation.x = 1.45;
          j.lR.rotation.x = -0.85;
          j.kR.rotation.x = 1.25;
          j.aL.rotation.x = -0.75;
          j.eL.rotation.x = -0.95;
          j.aR.rotation.x = -0.65;
          paintFace(ethan, { sm: -0.28, lid: 0.35, bl: -0.22, br: -0.22, op: 0.18 });
        } else {
          const walking = stateRef.walkerSpeed > 0.1;
          if (walking && ethan.s.an && ethan.s.an.Walk) {
            ethan.s.an.Walk(ethan, t);
          } else {
            j.root.position.y = 0.95 + Math.abs(S(t * 2.2)) * 0.015;
            j.aL.rotation.z = 0.10;
            j.aR.rotation.z = -0.10;
          }
          const isTearful = stateRef.sceneId === 4 && stateRef.beatIdx === 2;
          paintFace(ethan, {
            sm: stateRef.sceneId === 4 && stateRef.beatIdx === 3 ? 0.08 : -0.14,
            lid: 0.18,
            tear: isTearful ? 0.85 : 0,
          });
        }
      }
    }
  }

  // ============================================================================
  // POST-PROCESSING RENDER TARGETS
  // ============================================================================
  const PP = {
    rt: new T.WebGLRenderTarget(2, 2, {
      minFilter: T.LinearFilter,
      magFilter: T.LinearFilter,
      format: T.RGBAFormat,
    }),
    sc: new T.Scene(),
    sc3d: new T.Scene(),
    cam: new T.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    mat: null as any,
    mat3d: null as any,
  };
  PP.mat = new T.ShaderMaterial({
    uniforms: { t: { value: null }, res: { value: new T.Vector2(2, 2) }, time: { value: 0 } },
    vertexShader: 'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: SK,
    depthTest: false,
    depthWrite: false,
  });
  PP.sc.add(new T.Mesh(new T.PlaneGeometry(2, 2), PP.mat));

  PP.mat3d = new T.ShaderMaterial({
    uniforms: {
      t: { value: null },
      res: { value: new T.Vector2(2, 2) },
      time: { value: 0 },
      styleMode: { value: 0 },
    },
    vertexShader: 'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: SK3D,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  PP.sc3d.add(new T.Mesh(new T.PlaneGeometry(2, 2), PP.mat3d));

  function renderFrame(t: number) {
    if (isSoftwareGl && mode === 3 && shaderStyle < 2) {
      // On SwiftShader software WebGL, render directly to avoid multi-pass FBO stalls while keeping 3D gouache materials
      R.render(sc, cam);
      return;
    }
    if (mode === 2) {
      R.setRenderTarget(PP.rt);
      R.render(sc, cam);
      R.setRenderTarget(null);
      PP.mat.uniforms.t.value = PP.rt.texture;
      PP.mat.uniforms.time.value = t;
      R.render(PP.sc, PP.cam);
    } else if (shaderStyle < 2) {
      R.setRenderTarget(PP.rt);
      R.clear();
      R.render(sc, cam);
      R.setRenderTarget(null);
      PP.mat3d.uniforms.t.value = PP.rt.texture;
      PP.mat3d.uniforms.time.value = t;
      PP.mat3d.uniforms.styleMode.value = shaderStyle;
      R.render(PP.sc3d, PP.cam);
    } else {
      R.render(sc, cam);
    }
  }

  function size() {
    const w = Math.max(1, stageEl.clientWidth);
    const h = Math.max(1, stageEl.clientHeight);
    R.setSize(w, h, false);
    try {
      const pr = R.getPixelRatio();
      PP.rt.setSize(w * pr, h * pr);
      PP.mat.uniforms.res.value.set(w * pr, h * pr);
      PP.mat3d.uniforms.res.value.set(w * pr, h * pr);
    } catch (_) {}
    cam3.aspect = w / h;
    cam3.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(size);
  ro.observe(stageEl);
  size();

  // ============================================================================
  // PROCEDURAL WEB AUDIO ENGINE
  // ============================================================================
  const AUD: any = { ctx: null, master: null, muted: false, vol: 0.6, ready: false, nextPass: 6 };
  try {
    const s = JSON.parse(localStorage.getItem('nc_audio') || '{}');
    if (typeof s.muted === 'boolean') AUD.muted = s.muted;
    if (typeof s.vol === 'number') AUD.vol = clamp(s.vol, 0, 1);
  } catch (_) {}

  function audSave() {
    try {
      localStorage.setItem('nc_audio', JSON.stringify({ muted: AUD.muted, vol: AUD.vol }));
    } catch (_) {}
  }
  function audApply() {
    if (AUD.master && AUD.ctx) {
      AUD.master.gain.setTargetAtTime(AUD.muted ? 0 : AUD.vol * 0.8, AUD.ctx.currentTime, 0.08);
    }
  }
  function audNoise(c: AudioContext, brown: boolean) {
    const n = c.sampleRate * 3;
    const b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0);
    let l = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        l = (l + 0.02 * w) / 1.02;
        d[i] = l * 3.4;
      } else d[i] = w;
    }
    return b;
  }
  function audLayer(c: AudioContext, buf: AudioBuffer, nodes: any[], gain: number, dest: AudioNode) {
    const s = c.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    let n: AudioNode = s;
    nodes.forEach(([type, f, q]) => {
      const x = c.createBiquadFilter();
      x.type = type;
      x.frequency.value = f;
      if (q) x.Q.value = q;
      n.connect(x);
      n = x;
    });
    const g = c.createGain();
    g.gain.value = gain;
    n.connect(g);
    g.connect(dest);
    s.start();
    return g;
  }
  function audInit() {
    if (AUD.ready) {
      if (AUD.ctx && AUD.ctx.state === 'suspended') AUD.ctx.resume();
      return;
    }
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    try {
      const c = (AUD.ctx = new AC());
      AUD.master = c.createGain();
      AUD.master.gain.value = 0;
      const comp = c.createDynamicsCompressor();
      AUD.master.connect(comp);
      comp.connect(c.destination);
      const w = audNoise(c, false);
      const br = audNoise(c, true);
      audLayer(c, w, [['highpass', 1800], ['lowpass', 8000]], 0.055, AUD.master);
      audLayer(c, w, [['bandpass', 700, 0.6]], 0.03, AUD.master);
      audLayer(c, br, [['lowpass', 150]], 0.55, AUD.master);
      audLayer(c, br, [['bandpass', 950, 0.8]], 0.05, AUD.master);
      const wind = audLayer(c, w, [['bandpass', 480, 0.5]], 0.022, AUD.master);
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = 0.13;
      lg.gain.value = 0.012;
      lfo.connect(lg);
      lg.connect(wind.gain);
      lfo.start();
      [48, 96.5].forEach((f, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.frequency.value = f;
        g.gain.value = i ? 0.006 : 0.016;
        o.connect(g);
        g.connect(AUD.master);
        o.start();
      });
      AUD.w = w;
      AUD.br = br;
      AUD.ready = true;
      audApply();
    } catch (_) {
      AUD.ready = false;
    }
  }
  function audBurst(buf: AudioBuffer, ft: BiquadFilterType, f0: number, f1: number, dur: number, gain: number, pan: number) {
    if (!AUD.ready || AUD.muted || !buf) return;
    const c = AUD.ctx;
    const now = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = ft;
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(f0, now);
    f.frequency.exponentialRampToValueAtTime(f1, now + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    s.connect(f);
    f.connect(g);
    let out: AudioNode = g;
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.setValueAtTime(pan, now);
      p.pan.linearRampToValueAtTime(pan * 0.3, now + dur);
      g.connect(p);
      out = p;
    }
    out.connect(AUD.master);
    s.start(now, Math.random() * 2, dur + 0.05);
  }
  function audBlip(f = 560) {
    if (!AUD.ready || AUD.muted) return;
    const c = AUD.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    const n = c.currentTime;
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, n);
    g.gain.exponentialRampToValueAtTime(0.05, n + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, n + 0.09);
    o.connect(g);
    g.connect(AUD.master);
    o.start(n);
    o.stop(n + 0.1);
    o.onended=()=>{o.disconnect();g.disconnect();};
  }
  let wipePrev = 0;
  let wipeDir = 0;
  function audTick(wipeAng: number, dt: number) {
    const d = Math.sign(wipeAng - wipePrev);
    wipePrev = wipeAng;
    if (d && wipeDir && d !== wipeDir) audBurst(AUD.br, 'lowpass', 420, 120, 0.12, 0.12, 0.1);
    if (d) wipeDir = d;
    AUD.nextPass -= dt;
    if (AUD.nextPass <= 0 && stateRef.sceneId === 1) {
      AUD.nextPass = 7 + Math.random() * 9;
      audBurst(AUD.br, 'bandpass', 180, 620, 1.7, 0.22, -0.85);
    }
  }

  // ============================================================================
  // CAMERA, RAYCASTER & INTERACTION STATE
  // ============================================================================
  let fpYaw = 0.08;
  let fpPitch = -0.28;
  let fpYawGoal = 0.08;
  let fpPitchGoal = -0.28;
  let tpYaw = -0.75;
  let tpPitch = 0.20;
  let tpDist = 4.2;
  const tpTarget = new T.Vector3(0.0, 1.05, -0.25);

  let locked = false;
  let lockFailed = false;
  let drag: { x: number; y: number; moved: number } | null = null;
  let hoveredHotspot: HotspotInfo | null = null;
  const raycaster = new T.Raycaster();
  const pointerNDC = new T.Vector2(0, 0);

  const stateRef = {
    mode: 'title' as 'title' | 'playing' | 'studio',
    worldShift: 'sun_down' as 'sun_down' | 'sun_up',
    sceneId: 1 as 1 | 2 | 3 | 4,
    beatIdx: 0,
    lineIdx: 0,
    isFirstPerson: true,
    consoleOpen: false,
    consoleTab: 'chat' as 'game' | 'chat',
    styleIdx: 0,
    curSpeaker: '',
    castleReflection: false,
    walkerX: -2.15,
    walkerZ: -0.95,
    walkerSpeed: 0,
  };

  function lockMouse() {
    if (stateRef.mode !== 'playing' || !stateRef.isFirstPerson || document.pointerLockElement || lockFailed) return;
    try {
      const p = (R.domElement as any).requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (_) {
      lockFailed = true;
      callbacks.onPointerLockChange(false, true);
    }
  }

  const onPointerLockChange = () => {
    locked = document.pointerLockElement === R.domElement;
    callbacks.onPointerLockChange(locked, lockFailed);
  };
  const onPointerLockError = () => {
    lockFailed = true;
    callbacks.onPointerLockChange(false, true);
  };
  document.addEventListener('pointerlockchange', onPointerLockChange);
  document.addEventListener('pointerlockerror', onPointerLockError);

  stageEl.addEventListener('pointerdown', e => {
    if (e.target !== R.domElement) return;
    if(worldPaused||stateRef.consoleOpen)return;
    audInit();
    drag = { x: e.clientX, y: e.clientY, moved: 0 };
    if (!locked) {
      try {
        stageEl.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
  });

  stageEl.addEventListener('pointermove', e => {
    if(worldPaused||stateRef.consoleOpen)return;
    if (locked && stateRef.isFirstPerson && stateRef.mode === 'playing') {
      const delta=lookDelta(e.movementX,e.movementY,lookPreferences,true);
      fpYawGoal = clamp(fpYawGoal - delta.yaw, -PI, PI);
      fpPitchGoal = clamp(fpPitchGoal - delta.pitch, -0.58, 0.48);
      stageEl.dataset.camera=JSON.stringify({yaw:fpYawGoal,pitch:fpPitchGoal,...lookPreferences});
      return;
    }
    const r = stageEl.getBoundingClientRect();
    pointerNDC.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (stateRef.isFirstPerson && stateRef.mode === 'playing') {
      const delta=lookDelta(dx,dy,lookPreferences,false);
      fpYawGoal = clamp(fpYawGoal - delta.yaw, -PI, PI);
      fpPitchGoal = clamp(fpPitchGoal - delta.pitch, -0.58, 0.48);
      stageEl.dataset.camera=JSON.stringify({yaw:fpYawGoal,pitch:fpPitchGoal,...lookPreferences});
    } else {
      tpYaw -= dx * 0.007;
      tpPitch = clamp(tpPitch + dy * 0.005, -0.15, 0.65);
    }
  });

  stageEl.addEventListener('pointerup', e => {
    const bounds=stageEl.getBoundingClientRect();pointerNDC.set(((e.clientX-bounds.left)/bounds.width)*2-1,-((e.clientY-bounds.top)/bounds.height)*2+1);
    if(worldPaused||stateRef.consoleOpen){drag=null;return;}
    if (!drag) return;
    const click = drag.moved < 6;
    drag = null;
    if (!click || stateRef.mode !== 'playing') return;
    if (locked) {
      if (hoveredHotspot) callbacks.onHotspotActivate(hoveredHotspot);
      else callbacks.onAdvanceDialogue();
      return;
    }
    raycaster.setFromCamera(pointerNDC, cam);
    const activeHotspots = hotspotMeshes.filter(
      m => !m.userData.hotspot?.sceneOnly || m.userData.hotspot.sceneOnly === stateRef.sceneId
    );
    const hit = raycaster.intersectObjects(activeHotspots, false)[0];
    if (hit && hit.distance<5.2 && hit.object.userData.hotspot) {
      callbacks.onHotspotActivate(hit.object.userData.hotspot);
    } else if (stateRef.isFirstPerson) {
      lockMouse();
    }
  });

  stageEl.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      if (stateRef.isFirstPerson && stateRef.mode === 'playing') {
        cam3.fov = clamp(cam3.fov + e.deltaY * 0.02, 38, 72);
        cam3.updateProjectionMatrix();
      } else {
        tpDist = clamp(tpDist * (1 + e.deltaY * 0.001), 1.8, 8.5);
      }
    },
    { passive: false }
  );

  const onKeyDown = (e: KeyboardEvent) => {
    if (worldPaused||['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName)||(!stateRef.consoleOpen&&['BUTTON','A'].includes((e.target as HTMLElement)?.tagName))|| (e.target as HTMLElement)?.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k))flushWorldInput(performance.now());
    keys.add(k);
    if (stateRef.mode !== 'playing' || (encounterActive&&encounterPaused)) return;
    const game = stateRef.consoleOpen && stateRef.consoleTab === 'game';
    if (k === 'e' && hoveredHotspot) {
      callbacks.onHotspotActivate(hoveredHotspot);
    } else if (game && (k === '1' || k === 'f')) {
      skAct('slash');
    } else if (game && (k === '2' || k === 'w' || k === 'arrowup')) {
      e.preventDefault();
      skAct('jump');
    } else if (game && (k === '3' || k === 's' || k === 'arrowdown')) {
      e.preventDefault();
      skAct('block');
    } else if (!game && (stateRef.sceneId === 1 || (stateRef.sceneId === 2 && stateRef.beatIdx <= 1))) {
      if (k === 'arrowleft' || k === 'a') fpYawGoal = clamp(fpYawGoal + 0.22, -PI, PI);
      if (k === 'arrowright' || k === 'd') fpYawGoal = clamp(fpYawGoal - 0.22, -PI, PI);
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {const k=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k))flushWorldInput(performance.now());keys.delete(k);stepWorldInput(0);};
  const onBlur = () => {keys.clear();drag=null;};
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  function updateCenterReticleHotspot() {
    if (stateRef.mode !== 'playing' || !stateRef.isFirstPerson) {
      if (hoveredHotspot) {
        hoveredHotspot = null;
        callbacks.onHotspotHover(null);
      }
      return;
    }
    raycaster.setFromCamera(new T.Vector2(0, 0), cam3);
    const activeHotspots = hotspotMeshes.filter(
      m => !m.userData.hotspot?.sceneOnly || m.userData.hotspot.sceneOnly === stateRef.sceneId
    );
    const hit = raycaster.intersectObjects(activeHotspots, false)[0];
    if (hit && hit.distance < 5.2 && hit.object.userData.hotspot) {
      const hs = hit.object.userData.hotspot as HotspotInfo;
      if (!hoveredHotspot || hoveredHotspot.key !== hs.key || hoveredHotspot.title !== hs.title) {
        hoveredHotspot = hs;
        callbacks.onHotspotHover(hs);
      }
    } else if (hoveredHotspot) {
      hoveredHotspot = null;
      callbacks.onHotspotHover(null);
    }
  }

  // ============================================================================
  // SOFTWARE WEBGL FENCE-SYNC FRAME PACING (afterDraw)
  // ============================================================================
  function afterDraw(cb: (now: number) => void) {
    if (typeof (gl as WebGL2RenderingContext).fenceSync !== 'function') {
      setTimeout(() => cb(performance.now()), 80);
      return;
    }
    const gl2 = gl as WebGL2RenderingContext;
    const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0)!;
    gl2.flush();
    const poll = () => {
      const s = gl2.clientWaitSync(sync, 0, 0);
      if (s === gl2.TIMEOUT_EXPIRED) {
        setTimeout(poll, 16);
        return;
      }
      gl2.deleteSync(sync);
      setTimeout(() => cb(performance.now()), 80);
    };
    setTimeout(poll, 16);
  }

  let running = true;
  let last = performance.now();
  let worldTime=performance.now()/1000;
  let lastKnight=performance.now();
  let lastWorldInput=performance.now(),walkerWasMoving=false;
  function stepWorldInput(dt:number) {
    const canWalk=!worldPaused&&!document.hidden&&stateRef.mode==='playing'&&!stateRef.consoleOpen&&((stateRef.sceneId===2&&stateRef.beatIdx>=2)||stateRef.sceneId===3||stateRef.sceneId===4);
    if(!canWalk){if(walkerWasMoving)callbacks.onStepWalker(0,0,fpYaw,0);walkerWasMoving=false;return;}
    const forward=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0),strafe=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
    const axes=normalizedAxes(forward,strafe);
    if(forward||strafe||walkerWasMoving){let remaining=Math.min(1,dt);do{const step=Math.min(.1,remaining);callbacks.onStepWalker(axes.forward,axes.strafe,fpYaw,step);remaining-=step;}while(remaining>1e-6);}
    walkerWasMoving=Boolean(forward||strafe);
  }
  function flushWorldInput(now:number){const elapsed=Math.max(0,(now-lastWorldInput)/1000);lastWorldInput=now;stepWorldInput(elapsed);}
  // Keep playable 2D input/simulation independent of software-GL fence pacing.
  function tickKnight(now:number) {
    if(!running)return;
    if(now-lastWorldInput>=40)flushWorldInput(now);
    const dt=Math.max(0,Math.min(0.05,(now-lastKnight)/1000));lastKnight=now;
    stepAndDrawStickmanGame(reducedMotion?0:now/1000,dt);
    requestAnimationFrame(tickKnight);
  }

  function tick(now: number) {
    if (!running) return;
    const dt = worldPaused?0:Math.max(0, Math.min(0.05, (now - last) / 1000));
    worldTime+=dt;const t=reducedMotion?0:worldTime;
    last = now;

    // World visibility based on mode & scene
    const isStudio = stateRef.mode === 'studio';
    const isOutdoor = stateRef.mode === 'title' || stateRef.sceneId === 1 || stateRef.sceneId === 2;
    studioGrp.visible = isStudio;
    worldGrp.visible = !isStudio && isOutdoor;
    carGrp.visible = !isStudio && isOutdoor;
    houseGrp.visible = !isStudio && stateRef.sceneId === 2;
    hallwayGrp.visible = !isStudio && stateRef.sceneId === 3;
    bedroomGrp.visible = !isStudio && stateRef.sceneId === 4;
    aunt.g.visible = !isStudio && (stateRef.sceneId === 2 || stateRef.sceneId === 3);
    ethan.g.visible = !isStudio && (!stateRef.isFirstPerson || stateRef.mode === 'title');

    porchLight.intensity = !isStudio && stateRef.sceneId === 2 ? 1.15 : 0;
    hallwayLight.intensity = !isStudio && stateRef.sceneId === 3 ? 1.28 : 0;
    bedroomLight.intensity = !isStudio && stateRef.sceneId === 4 ? 0.95 : 0;
    memoryLight.intensity =
      !isStudio && stateRef.sceneId === 4 ? (stateRef.beatIdx === 2 ? 1.55 : 0.42) : 0;
    domeLightRear.intensity = !isStudio && isOutdoor ? 0.54 : 0;
    domeLightFront.intensity = !isStudio && isOutdoor ? 0.28 : 0;
    dashLight.intensity = !isStudio && isOutdoor ? 0.34 : 0;

    // World Shift (Sun Down Katomos 🌙 vs. Sun Up Lóže ☀️)
    const isSunUp = stateRef.worldShift === 'sun_up';
    const fogHex = isSunUp ? 0xd8c39e : 0x0a0b0f;
    if ((sc.fog as THREE.FogExp2).color.getHex() !== fogHex) {
      (sc.fog as THREE.FogExp2).color.setHex(fogHex);
      hl.color.setHex(isSunUp ? 0xfff1d0 : 0x8f97a6);
      hl.groundColor.setHex(isSunUp ? 0x5c4632 : 0x17151b);
      hl.intensity = isSunUp ? 1.05 : 0.72;
      dl.color.setHex(isSunUp ? 0xffdfa0 : 0xaab4c4);
      dl.intensity = isSunUp ? 0.85 : 0.30;
    }

    if (!isStudio) {
      // Scene 1: Car cruises at 15 m/s; Scene 2: Car is stopped at the curb until Beat 3 when it drives away!
      const isScene1 = stateRef.sceneId === 1 || stateRef.mode === 'title';
      const speed = isScene1 ? 15.0 : 0.0;

      if (stateRef.sceneId === 2 && stateRef.beatIdx >= 3) {
        carDriveOffZ = Math.min(48, carDriveOffZ + dt * 9.5);
      } else {
        carDriveOffZ = 0;
      }
      carGrp.position.z = carDriveOffZ;

      roadDashes.forEach(d => {
        d.position.z -= speed * dt;
        if (d.position.z < -80) d.position.z += 160;
      });
      streetLamps.forEach(l => {
        l.position.z -= speed * dt;
        if (l.position.z < -72) l.position.z += 144;
      });
      roadsideTrees.forEach(tr => {
        if (stateRef.sceneId === 2 && tr.position.z > -10 && tr.position.z < 8) {
          tr.visible = false; // Clear trees directly in front of Aunt Momma's house
        } else {
          tr.visible = true;
        }
        tr.position.z -= speed * dt;
        if (tr.position.z < -78) tr.position.z += 156;
      });
      cityBuildings.forEach(b => {
        b.position.z -= speed * 0.28 * dt;
        if (b.position.z < -78) b.position.z += 156;
      });
      oncomingCars.forEach(oc => {
        oc.visible = isScene1;
        oc.position.z -= speed * 1.85 * dt;
        if (oc.position.z < -72) oc.position.z += 144;
      });
      rainDrops.forEach(r => {
        r.position.y -= 9.5 * dt;
        r.position.z -= speed * 0.85 * dt;
        if (r.position.y < 0.1) {
          r.position.y = 4.2;
          r.position.z = -11 + Math.random() * 22;
        }
      });

      const wipeAng = S(t * 2.6) * 0.55 - 0.35;
      audTick(wipeAng, dt);
      if (wiperL) wiperL.rotation.z = wipeAng;
      if (wiperR) wiperR.rotation.z = wipeAng;

      const wheelSpeed = isScene1 ? speed : stateRef.sceneId === 2 && stateRef.beatIdx >= 3 ? 9.5 : 0;
      wheels.forEach(w => {
        w.rotation.x += wheelSpeed * dt * 2.0;
      });
      const vibY = isScene1 ? S(t * 11.5) * 0.002 + S(t * 2.8) * 0.0035 : 0;
      carGrp.position.y = vibY;

      animateCast(t, dt);

      fpYaw += (fpYawGoal - fpYaw) * Math.min(1, dt * 20);
      fpPitch += (fpPitchGoal - fpPitch) * Math.min(1, dt * 20);

      if (stateRef.mode === 'title') {
        // Atmospheric PHERSU-inspired title camera framing Ethan & sleeping Mum inside the rainy Night Car
        const swayX = S(t * 0.45) * 0.08;
        const swayY = C(t * 0.38) * 0.04;
        cam3.position.set(-0.22 + swayX, 1.30 + swayY, 0.35);
        cam3.lookAt(-0.25, 1.04, -1.05);
      } else if (stateRef.isFirstPerson) {
        const inCar = stateRef.sceneId === 1 || (stateRef.sceneId === 2 && stateRef.beatIdx <= 1);
        const isFallenOnFloor = stateRef.sceneId === 3 && stateRef.beatIdx === 2;
        const eyeX = inCar ? -0.68 : stateRef.walkerX;
        const eyeY = inCar
          ? 1.22 + vibY
          : isFallenOnFloor
          ? 0.62
          : 1.18 + Math.abs(S(t * 6.5)) * (stateRef.walkerSpeed > 0.1 ? 0.025 : 0.004);
        const eyeZ = inCar ? -0.92 : stateRef.walkerZ;
        cam3.position.set(eyeX, eyeY, eyeZ);
        const lookDist = 3.5;
        const lx = eyeX + S(fpYaw) * C(fpPitch) * lookDist;
        const ly = eyeY + S(fpPitch) * lookDist;
        const lz = eyeZ + C(fpYaw) * C(fpPitch) * lookDist;
        cam3.lookAt(lx, ly, lz);
        updateCenterReticleHotspot();
      } else {
        if (stateRef.sceneId === 2 && stateRef.beatIdx >= 2) {
          tpTarget.set(stateRef.walkerX - 1.2, 1.25, stateRef.walkerZ);
        } else if (stateRef.sceneId === 3 || stateRef.sceneId === 4) {
          tpTarget.set(stateRef.walkerX, 1.10, stateRef.walkerZ + 0.65);
        } else {
          tpTarget.set(0.0, 1.05, -0.25);
        }
        const cx = tpTarget.x + S(tpYaw) * C(tpPitch) * tpDist;
        const cy = tpTarget.y + S(tpPitch) * tpDist;
        const cz = tpTarget.z + C(tpYaw) * C(tpPitch) * tpDist;
        cam3.position.set(cx, cy, cz);
        cam3.lookAt(tpTarget);
      }
    } else {
      // Studio turntable camera
      animateCast(t, dt);
      tpTarget.set(0, 0.88, 0);
      const dist = 2.65;
      cam3.position.set(S(tpYaw) * C(tpPitch) * dist, 1.05 + S(tpPitch) * 0.6, C(tpYaw) * C(tpPitch) * dist);
      cam3.lookAt(tpTarget);
    }

    if (mode === 2) {
      const asp = stageEl.clientWidth / Math.max(1, stageEl.clientHeight);
      const oh = 1.85;
      cam2.left = -oh * asp;
      cam2.right = oh * asp;
      cam2.top = oh;
      cam2.bottom = -oh;
      cam2.updateProjectionMatrix();
      cam2.position.copy(cam3.position).multiplyScalar(2.5);
      cam2.lookAt(tpTarget);
    }

    renderFrame(t);

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
  requestAnimationFrame(tickKnight);

  return {
    syncState(next: {
      mode: 'title' | 'playing' | 'studio';
      worldShift: 'sun_down' | 'sun_up';
      sceneId: 1 | 2 | 3 | 4;
      beatIdx: number;
      lineIdx: number;
      isFirstPerson: boolean;
      consoleOpen: boolean;
      consoleTab: 'game' | 'chat';
      styleIdx: number;
      curSpeaker: string;
      castleReflection: boolean;
      fpYaw?: number;
      fpPitch?: number;
      walkerX: number;
      walkerZ: number;
      walkerSpeed: number;
    }) {
      const beatChanged =
        next.sceneId !== stateRef.sceneId ||
        next.beatIdx !== stateRef.beatIdx ||
        next.mode !== stateRef.mode;
      Object.assign(stateRef, next);
      if (castleGhostGrp) castleGhostGrp.visible = next.sceneId === 1 && next.castleReflection;
      if (ethan.hd) ethan.hd.visible = !next.isFirstPerson || next.mode !== 'playing';
      if (!next.isFirstPerson && document.pointerLockElement) document.exitPointerLock();

      if (beatChanged && next.fpYaw !== undefined && next.fpPitch !== undefined) {
        fpYawGoal = next.fpYaw;
        fpPitchGoal = next.fpPitch;
        if (isSoftwareGl) {
          fpYaw = next.fpYaw;
          fpPitch = next.fpPitch;
        }
      }

      // Sync shader style
      if (next.styleIdx === 3) {
        mode = 2;
        cam = cam2;
        stageEl.classList.add('m2');
        stageEl.classList.remove('m3');
      } else {
        mode = 3;
        cam = cam3;
        shaderStyle = next.styleIdx;
        PP.mat3d.uniforms.styleMode.value = shaderStyle;
        stageEl.classList.add('m3');
        stageEl.classList.remove('m2');
      }
    },
    lookToward(key: string) {
      const map =
        stateRef.sceneId === 1
          ? LOOK_ANGLES_S1
          : stateRef.sceneId === 2
          ? LOOK_ANGLES_S2
          : stateRef.sceneId === 3
          ? LOOK_ANGLES_S3
          : LOOK_ANGLES_S4;
      const a = map[key];
      if (a) {
        fpYawGoal = a.yaw;
        fpPitchGoal = a.pitch;
        stageEl.dataset.camera=JSON.stringify({yaw:fpYawGoal,pitch:fpPitchGoal,...lookPreferences});
        if (isSoftwareGl) {
          fpYaw = a.yaw;
          fpPitch = a.pitch;
        }
      }
    },
    triggerStickmanAct: skAct,
    applyAudienceAid(value:'shield'|'torch') {
      if(!encounterActive||encounterPaused)return false;
      audienceAid={value,remaining:8};
      audBlip(value==='shield'?330:520);
      say(value==='shield'?'Audience shield · absorbs next hit':'Audience torch · stronger slash',2);
      return true;
    },
    setEncounterActive(active:boolean) {
      if(encounterActive===active)return;
      encounterActive=active;audienceAid=null;keys.clear();
      if(!active){encounterPaused=false;return;}
      Object.assign(G,{wins:0,kx:90,ky:0,kvy:0,kHp:100,bx:270,bHp:100,bState:'walk',bT:0,kAct:'',kT:0,kCd:0,fall:null,sparks:[],idle:0,damageDealt:0,blocks:0,deaths:0,shieldSaves:0,jumps:0,slashes:0,lastHit:null});
      callbacks.onStickmanWinChange(0);
    },
    setEncounterPaused(paused:boolean) {encounterPaused=paused;keys.clear();},
    setReducedMotion(enabled:boolean) {reducedMotion=enabled;},
    getKnightState() {return {health:G.kHp,enemyHealth:G.bHp,wins:G.wins,x:G.kx,jump:G.ky,action:G.kAct,aid:audienceAid?{...audienceAid}:null,damageDealt:G.damageDealt,blocks:G.blocks,deaths:G.deaths,shieldSaves:G.shieldSaves,enemyState:G.bState,jumps:G.jumps,slashes:G.slashes};},
    setPaused(paused:boolean) {worldPaused=paused;keys.clear();drag=null;if(paused&&document.pointerLockElement)document.exitPointerLock();stageEl.dataset.paused=String(paused);},
    applyPreferences(p:Preferences) {lookPreferences={sensitivity:p.sensitivity,invertY:p.invertY};const grades=['saturate(.85) contrast(1.02)','saturate(1.18) contrast(1.02)','saturate(1.3) contrast(1.08)','saturate(1)'];R.domElement.style.filter=`brightness(${p.brightness}) ${grades[p.graphicsStyle]}`;stageEl.dataset.graphics=String(p.graphicsStyle);stageEl.dataset.brightness=String(p.brightness);reducedMotion=p.reducedMotion;AUD.vol=p.volume/100;AUD.muted=p.muted;audApply();stageEl.dataset.controls=JSON.stringify(lookPreferences);stageEl.dataset.audio=JSON.stringify({ready:AUD.ready,muted:AUD.muted,volume:AUD.vol});},
    unlockAudio() {audInit();},
    setHoldKey(k: string, down: boolean) {
      G.idle = 0;
      if (down) keys.add(k);
      else keys.delete(k);
    },
    setStudioCharacter,
    getAudioState() {
      return { muted: AUD.muted, vol: AUD.vol };
    },
    toggleMute() {
      audInit();
      AUD.muted = !AUD.muted;
      audApply();
      audSave();
      return AUD.muted;
    },
    setVolume(vol01: number) {
      audInit();
      AUD.vol = clamp(vol01, 0, 1);
      if (AUD.vol > 0 && AUD.muted) AUD.muted = false;
      audApply();
      audSave();
      return { muted: AUD.muted, vol: AUD.vol };
    },
    playBlip: audBlip,
    dispose() {
      running = false;
      if(AUD.ctx)void AUD.ctx.close();
      ro.disconnect();
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('pointerlockerror', onPointerLockError);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      R.dispose();
    },
  };
}
