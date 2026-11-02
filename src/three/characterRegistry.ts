// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Preserved Full 13-Character & Creature Builder Registry (from index (18).html)
 * Includes: ethan, sofi, wren, aunt, driver, mother, worker, doctor,
 *           fox (Blue Fox), princeps (Fire Dog), dragon (Purple Dragon), wolf (Green Wolf), bird (Lóže Bird)
 * Plus 768x768 Ink-and-Gouache Face Painter & Finite-Safe Nose Geometry.
 */
import * as THREE from "three";
import { computeNoseVertex } from "../core/engine";

const T = THREE, S = Math.sin, C = Math.cos, PI = Math.PI;
const APP_STATE = { _data: { chapter: 0 } };
let CS = null, NOL = 0, shaderStyle = 0; // 0 = Ink & Gouache 2.5D, 1 = Rich Painterly, 2 = Classic Toon
const GM = {}, GK = { value: 0.68 };

// Procedural 512x512 Aged Gouache Impasto & Scratchy Ink Micro-Bump Texture
const GOUACHE_BUMP = (() => {
  const can = document.createElement('canvas');
  can.width = can.height = 512;
  const ctx = can.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 512, 512);
  let seed = 1337;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  // 1. Layered opaque gouache flat-bristle brush strokes
  for (let i = 0; i < 1400; i++) {
    const x = rnd() * 512, y = rnd() * 512;
    const len = 18 + rnd() * 44, w = 4 + rnd() * 12;
    const ang = -0.45 + (rnd() - 0.5) * 0.55;
    const v = Math.round(96 + rnd() * 64);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = `rgba(${v},${v},${v},0.22)`;
    ctx.fillRect(-len / 2, -w / 2, len, w);
    // Dry-brush bristle ridges inside each gouache stroke
    ctx.strokeStyle = `rgba(${v > 128 ? 225 : 40},${v > 128 ? 225 : 40},${v > 128 ? 225 : 40},0.18)`;
    ctx.lineWidth = 1.1;
    for (let b = -w / 2; b <= w / 2; b += 2.4) {
      ctx.beginPath(); ctx.moveTo(-len / 2, b); ctx.lineTo(len / 2, b); ctx.stroke();
    }
    ctx.restore();
  }
  // 2. Scratchy fountain-pen cross-hatching & aged paper tooth
  for (let i = 0; i < 900; i++) {
    const x = rnd() * 512, y = rnd() * 512, l = 10 + rnd() * 26;
    const a = (i % 2 ? 0.68 : -0.68) + (rnd() - 0.5) * 0.2;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(240,240,240,0.16)' : 'rgba(25,20,30,0.20)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  const tex = new T.CanvasTexture(can);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
})();

const grad = (steps, soft) => {
  const k = steps.join(',') + (soft ? 'S' : 'H');
  if (GM[k]) return GM[k];
  // Build a richer 64-texel gouache wash ramp with subtle paint-edge pooling between steps
  const W = 64, data = new Uint8Array(W * 4);
  for (let x = 0; x < W; x++) {
    const u = x / (W - 1);
    const idx = Math.min(steps.length - 1, Math.floor(u * steps.length));
    const frac = (u * steps.length) - idx;
    let v = steps[idx];
    if (soft && idx < steps.length - 1) {
      v = steps[idx] + (steps[idx + 1] - steps[idx]) * frac;
    } else if (!soft && frac < 0.14 && idx > 0) {
      // Subtle gouache wet-edge pigment darkening at band boundaries
      v = Math.max(0, v - 0.055);
    }
    const byte = Math.round(Math.min(1, Math.max(0, v)) * 255);
    data[x * 4] = data[x * 4 + 1] = data[x * 4 + 2] = byte;
    data[x * 4 + 3] = 255;
  }
  const t = new T.DataTexture(data, W, 1, T.RGBAFormat);
  t.minFilter = t.magFilter = T.LinearFilter;
  t.needsUpdate = true;
  return (GM[k] = t);
};

// Scratchy Hand-Inked Inverted-Hull Outline Shaders (varying nib pressure + dry-ink edge)
const OLV = `
  uniform float w, k;
  varying vec3 vPos;
  varying vec3 vN;
  void main() {
    vPos = position;
    vN = normal;
    float nib = 0.78 + 0.38 * sin(dot(position.xy, vec2(23.1, 31.7)) + position.z * 19.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normalize(normal) * w * k * nib, 1.0);
  }
`;
const OLF = `
  uniform vec3 c;
  varying vec3 vPos;
  varying vec3 vN;
  void main() {
    float grain = fract(sin(dot(gl_FragCoord.xy * 0.42 + vPos.xy * 15.0, vec2(12.9898, 78.233))) * 43758.5453);
    vec3 inkCol = c + vec3(0.06, 0.04, 0.08) * step(0.76, grain);
    gl_FragColor = vec4(inkCol, 1.0);
  }
`;

function addOutline(mesh, geo, mult = 1.0) {
  if (!CS || NOL || mult <= 0) return;
  geo.computeBoundingSphere();
  const r = geo.boundingSphere ? geo.boundingSphere.radius : 0.1;
  if (r <= 0.020) return;
  const wVal = Math.min(0.0085, Math.max(0.0022, r * 0.042)) * CS.w * mult;
  const ol = new T.Mesh(geo, new T.ShaderMaterial({
    uniforms: { w: { value: wVal }, k: GK, c: { value: CS.oc } },
    vertexShader: OLV,
    fragmentShader: OLF,
    side: T.BackSide
  }));
  ol.renderOrder = -1;
  mesh.add(ol);
}

// Inject 2.5D Ink-and-Gouache Painterly Rim, Warm/Cool Pigment Shift & Scratchy Hatching into 3D Toon Materials
function enhanceGouacheMaterial(mat) {
  if (!mat || mat.userData?.gouacheEnhanced) return mat;
  mat.userData = mat.userData || {};
  mat.userData.gouacheEnhanced = true;
  if (!mat.bumpMap) {
    mat.bumpMap = GOUACHE_BUMP;
    mat.bumpScale = 0.0095;
  }
  mat.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vObjPos;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvObjPos = position;'
    );
    shader.fragmentShader = 'varying vec3 vObjPos;\n' + shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      // 2.5D Gouache Pigment Mottling & Warm/Cool Painterly Tone Shift
      vec3 viewDir = normalize(vViewPosition);
      float ndv = clamp(dot(normal, viewDir), 0.0, 1.0);
      float brush = sin(vObjPos.x * 38.0 + sin(vObjPos.y * 27.0) * 2.2) * cos(vObjPos.y * 44.0 + vObjPos.z * 31.0);
      float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
      // Shift darks toward rich indigo/burnt-umber gouache shadow, lights toward warm aged parchment gouache
      vec3 coolShadow = vec3(-0.035, -0.022, 0.048) * (1.0 - smoothstep(0.15, 0.58, lum));
      vec3 warmLight = vec3(0.042, 0.028, -0.018) * smoothstep(0.45, 0.92, lum);
      gl_FragColor.rgb = clamp(gl_FragColor.rgb + coolShadow + warmLight + brush * 0.024, 0.0, 1.0);
      // Creamy Gouache Rim Highlight on lit grazing angles + Scratchy Ink Contour on dark grazing angles
      float rim = pow(1.0 - ndv, 2.65);
      float hatchScratch = step(0.48, fract((gl_FragCoord.x + gl_FragCoord.y * 1.15) * 0.22 + brush * 0.35));
      vec3 gouacheRim = vec3(1.0, 0.95, 0.84) * smoothstep(0.45, 0.82, rim) * smoothstep(0.25, 0.75, lum) * 0.38;
      float inkEdge = smoothstep(0.58, 0.88, rim) * (1.0 - smoothstep(0.22, 0.55, lum)) * hatchScratch * 0.62;
      gl_FragColor.rgb = mix(gl_FragColor.rgb + gouacheRim, vec3(0.11, 0.08, 0.15), inkEdge);
      #include <dithering_fragment>
      `
    );
  };
  return mat;
}

const M = (geo, colOrMat, pos, par, sc, olMult = 1.0) => {
  const mat = (colOrMat && colOrMat.isMaterial)
    ? enhanceGouacheMaterial(colOrMat)
    : (CS ? enhanceGouacheMaterial(new T.MeshToonMaterial({ color: colOrMat, gradientMap: CS.gm })) : new T.MeshLambertMaterial({ color: colOrMat }));
  const m = new T.Mesh(geo, mat);
  m.position.set(pos[0], pos[1], pos[2]);
  if (sc) m.scale.set(sc[0], sc[1], sc[2]);
  par.add(m);
  addOutline(m, geo, olMult);
  return m;
};

const Cy = (rt, rb, h, seg = 20) => new T.CylinderGeometry(rt, rb, h, seg);
const Sp = (r, ws = 20, hs = 16) => new T.SphereGeometry(r, ws, hs);
const Cn = (r, h, seg = 16) => new T.ConeGeometry(r, h, seg);
const Bx = (x, y, z) => new T.BoxGeometry(x, y, z);
const Tr = (r, t, a = PI * 2, rs = 8, ts = 20) => new T.TorusGeometry(r, t, rs, ts, a);
const J = (par, x, y, z = 0) => { const g = new T.Group(); g.position.set(x, y, z); par.add(g); return g; };

const hexStr = hex => '#' + new T.Color(hex).getHexString();
const shiftHex = (hex, f) => {
  const c = new T.Color(hex);
  c.r = Math.min(1, Math.max(0, c.r * f));
  c.g = Math.min(1, Math.max(0, c.g * f));
  c.b = Math.min(1, Math.max(0, c.b * f));
  return '#' + c.getHexString();
};

// ============================================================================
// 2. ANATOMICALLY SCULPTED 3D HEAD, NOSE & TAPERED S-CURVE HAIR LOCKS
// ============================================================================
function createSculptedHeadGeo(F) {
  const [sx, sy, sz] = F.hs || [0.95, 1.02, 0.98];
  const isKid = !!F.isEthan;
  const jawW = F.jawW || (isKid ? 0.86 : 0.78);
  const chinW = F.chinW || (isKid ? 0.30 : 0.34);
  const cheekW = F.cheekW || (isKid ? 1.10 : 1.02);
  const rx = (isKid ? 0.148 : 0.140) * sx;
  const ry = (isKid ? 0.148 : 0.160) * sy;
  const rz = (isKid ? 0.148 : 0.146) * sz;

  const geo = new T.SphereGeometry(1, 48, 36);
  const pos = geo.attributes.position, uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i), uy = pos.getY(i), uz = pos.getZ(i);
    const hr = Math.hypot(ux, uz);
    let x, y, z;

    if (hr < 1e-6) {
      x = 0;
      y = (uy < -0.80 ? (-0.80 - (-uy - 0.80) * (isKid ? 0.32 : 0.45)) : uy) * ry;
      z = 0;
    } else {
      const nx = ux / hr, nz = uz / hr, front = Math.max(0, nz);
      let rFront, rSide, rBack;
      if (uy >= 0) {
        rFront = hr * (1.0 + (isKid ? 0.055 : 0.04) * Math.exp(-Math.pow((uy - 0.22) / 0.20, 2)));
        rSide = hr * (1.0 + (isKid ? 0.045 : 0.03) * S(uy * PI));
        rBack = hr * (1.0 + (isKid ? 0.08 : 0.06) * S(uy * PI * 0.85));
      } else {
        const t = -uy;
        if (isKid) {
          // 10-year-old boy cheek fullness (Sheet 001 Turnaround: soft rounded lower cheeks + compact chin)
          const cheekBulge = 0.065 * Math.sin(Math.min(1, t / 0.56) * PI);
          if (t < 0.56) {
            rSide = (cheekW + cheekBulge) - ((cheekW + cheekBulge) - jawW) * Math.pow(t / 0.56, 1.85);
          } else if (t < 0.88) {
            rSide = jawW - (jawW - chinW) * Math.pow((t - 0.56) / 0.32, 1.25);
          } else {
            rSide = chinW * (1.0 - 0.88 * Math.pow((t - 0.88) / 0.12, 1.4));
          }
          if (t < 0.80) {
            const s = t / 0.80;
            rFront = 1.0 + 0.052 * S(s * PI) - 0.05 * s * s;
          } else {
            rFront = 0.95 * (1.0 - 0.82 * Math.pow((t - 0.80) / 0.20, 1.5));
          }
        } else {
          if (t < 0.58) {
            rSide = cheekW - (cheekW - jawW) * Math.pow(t / 0.58, 1.6);
          } else if (t < 0.92) {
            rSide = jawW - (jawW - chinW) * Math.pow((t - 0.58) / 0.34, 1.2);
          } else {
            rSide = chinW * (1.0 - 0.85 * Math.pow((t - 0.92) / 0.08, 1.5));
          }
          if (t < 0.84) {
            const s = t / 0.84;
            rFront = 1.0 + 0.03 * S(s * PI) - 0.04 * s * s;
          } else {
            rFront = 0.96 * (1.0 - 0.78 * Math.pow((t - 0.84) / 0.16, 1.6));
          }
        }
        rBack = hr * (1.0 - 0.45 * Math.min(1.0, t / 0.65));
      }
      const xRad = rSide * (1.0 - (isKid ? 0.08 : 0.11) * front * front * (uy < -0.2 ? 1.0 : 0.0));
      const zRad = nz >= 0 ? rFront : rBack;
      x = nx * xRad * rx;
      z = nz * zRad * rz;
      y = (uy < -0.80 ? (-0.80 - (-uy - 0.80) * (isKid ? 0.32 : 0.45)) : uy) * ry;
    }

    pos.setXYZ(i, x, y, z);
    if (uz > 0.05) {
      uv.setXY(
        i,
        Math.min(0.97, Math.max(0.03, 0.5 + x / ((isKid ? 0.298 : 0.285) * sx))),
        Math.min(0.97, Math.max(0.03, (isKid ? 0.50 : 0.52) + y / ((isKid ? 0.288 : 0.305) * sy)))
      );
    } else {
      uv.setXY(i, 0.02, 0.98);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function createNoseGeo(wScale = 1.0, lScale = 1.0, isKid = false) {
  const geo = new T.ConeGeometry((isKid ? 0.0135 : 0.016) * wScale, (isKid ? 0.038 : 0.050) * lScale, 12, 6);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = computeNoseVertex(pos.getX(i), pos.getY(i), pos.getZ(i), wScale, lScale, isKid);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function addLock(parent, pts, rRoot, rMid, rTip, col, flatZ = 0.75, olMult = 0) {
  const curve = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], p[1], p[2])));
  const segs = 12, radSegs = 7;
  const geo = new T.TubeGeometry(curve, segs, 1.0, radSegs, false);
  const pos = geo.attributes.position, ring = radSegs + 1;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, c = curve.getPointAt(t);
    const rad = t < 0.35
      ? rRoot + (rMid - rRoot) * (t / 0.35)
      : rMid * (1.0 - Math.pow((t - 0.35) / 0.65, 1.35)) + rTip * Math.pow((t - 0.35) / 0.65, 1.35);
    for (let j = 0; j < ring; j++) {
      const idx = i * ring + j;
      pos.setXYZ(
        idx,
        c.x + (pos.getX(idx) - c.x) * rad,
        c.y + (pos.getY(idx) - c.y) * rad,
        c.z + (pos.getZ(idx) - c.z) * rad * flatZ
      );
    }
  }
  geo.computeVertexNormals();
  const p = NOL; if (olMult <= 0) NOL = 1;
  const m = M(geo, col, [0, 0, 0], parent, null, olMult);
  NOL = p;
  return m;
}

// Sculpted Flat-Planed Painterly Hair Blade (for Ethan's thick triangular/feathered gouache hair tufts)
function addBladeLock(parent, pts, wRoot, wMid, wTip, col, flatRatio = 0.42, olMult = 0.55) {
  const curve = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], p[1], p[2])));
  const segs = 14, radSegs = 6;
  const geo = new T.TubeGeometry(curve, segs, 1.0, radSegs, false);
  const pos = geo.attributes.position, ring = radSegs + 1;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, c = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    let radDir = new T.Vector3(c.x, c.y * 0.35, c.z);
    if (radDir.lengthSq() < 1e-5) radDir.set(0, 0, 1);
    radDir.addScaledVector(tan, -radDir.dot(tan)).normalize();
    const binorm = new T.Vector3().crossVectors(tan, radDir).normalize();
    const w = t < 0.38
      ? wRoot + (wMid - wRoot) * (t / 0.38)
      : wMid * (1.0 - Math.pow((t - 0.38) / 0.62, 1.22)) + wTip * Math.pow((t - 0.38) / 0.62, 1.22);
    const th = w * flatRatio;
    for (let j = 0; j < ring; j++) {
      const idx = i * ring + j;
      const vx = pos.getX(idx) - c.x, vy = pos.getY(idx) - c.y, vz = pos.getZ(idx) - c.z;
      const v = new T.Vector3(vx, vy, vz);
      const bComp = v.dot(binorm);
      const rComp = v.dot(radDir);
      // Diamond/blade ridge profile
      pos.setXYZ(
        idx,
        c.x + binorm.x * bComp * w + radDir.x * rComp * th,
        c.y + binorm.y * bComp * w + radDir.y * rComp * th,
        c.z + binorm.z * bComp * w + radDir.z * rComp * th
      );
    }
  }
  geo.computeVertexNormals();
  const p = NOL; if (olMult <= 0) NOL = 1;
  const m = M(geo, col, [0, 0, 0], parent, null, olMult);
  NOL = p;
  return m;
}

// ============================================================================
// 3. HIGH-RESOLUTION PAINTERLY FACE CANVAS ENGINE (768x768)
// ============================================================================
function createFaceSystem() {
  const can = document.createElement('canvas');
  can.width = 768; can.height = 768;
  const ctx = can.getContext('2d');
  const tex = new T.CanvasTexture(can);
  tex.minFilter = T.LinearFilter;
  tex.magFilter = T.LinearFilter;
  return { can, ctx, tex, lastKey: '' };
}

function paintFace(c, f) {
  const fs = c.faceSys;
  if (!fs) return;
  const s = c.s, F = s.F, E = F.eye, B = F.brow, N = F.nose, Mo = F.mo;
  const bl = f.bl || 0, br = f.br || 0, a = f.a || 0;
  const sm = f.sm || 0, op = f.op || 0, lid = f.lid || 0, bk = c.bk || 0;
  const gx = f.gx || 0, gy = f.gy || 0, tear = f.tear || 0;

  const key = [bl, br, a, sm, op, lid, bk, gx, gy, tear, c.outfitIdx || 0].map(v => Math.round(v * 120)).join('|');
  if (key === fs.lastKey) return;
  fs.lastKey = key;

  const ctx = fs.ctx, W = fs.can.width, H = fs.can.height;
  const skinBase = hexStr(s.skin);
  const skinHi = shiftHex(s.skin, 1.12);
  const skinMidSh = shiftHex(s.skin, 0.85);
  const skinDeepSh = shiftHex(s.skin, 0.68);

  // 1. Base Skin & Rich Gouache Brush Planes (2.5D Painterly Faceting)
  ctx.fillStyle = skinBase;
  ctx.fillRect(0, 0, W, H);

  const hiGrad = ctx.createRadialGradient(W * 0.5, H * 0.42, W * 0.04, W * 0.5, H * 0.44, W * 0.36);
  hiGrad.addColorStop(0, skinHi);
  hiGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hiGrad;
  ctx.fillRect(0, 0, W, H);

  const jawGrad = ctx.createRadialGradient(W * 0.5, H * 0.46, W * 0.22, W * 0.5, H * 0.50, W * 0.49);
  jawGrad.addColorStop(0, 'rgba(0,0,0,0)');
  jawGrad.addColorStop(0.72, 'rgba(42,18,14,0.11)');
  jawGrad.addColorStop(1, 'rgba(32,12,18,0.28)');
  ctx.fillStyle = jawGrad;
  ctx.fillRect(0, 0, W, H);

  // Opaque Gouache Brush Facets on Forehead, Cheekbones & Chin (Arcane / Ink-and-Gouache 2.5D look)
  ctx.save();
  ctx.fillStyle = skinHi;
  ctx.globalAlpha = 0.28;
  // Forehead gouache highlight plane
  ctx.beginPath();
  ctx.roundRect(W * 0.37, H * 0.20, W * 0.26, H * 0.075, 16);
  ctx.fill();
  // Cheekbone gouache highlight planes
  [-1, 1].forEach(sd => {
    ctx.save();
    ctx.translate(W * (0.5 + sd * 0.195), H * 0.495);
    ctx.rotate(-sd * 0.22);
    ctx.beginPath();
    ctx.roundRect(-36, -12, 72, 24, 10);
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();

  // Warm Gouache Cheek & Nose-Bridge Blush Wash + Scratchy Ink Hatching
  const blushA = F.blush !== undefined ? F.blush : 0.16;
  [-1, 1].forEach(sd => {
    const cx = W * (0.5 + sd * 0.205), cy = H * 0.535;
    const bg = ctx.createRadialGradient(cx, cy, 4, cx, cy, W * 0.115);
    bg.addColorStop(0, `rgba(212, 76, 64, ${blushA})`);
    bg.addColorStop(1, 'rgba(212, 76, 64, 0)');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(cx, cy, W * 0.115, 0, PI * 2); ctx.fill();
    // Scratchy red-ochre ink blush hash marks on cheeks (for Ethan, Sofi, Wren)
    if (s.id === 'ethan' || s.id === 'sofi' || s.id === 'wren') {
      ctx.strokeStyle = 'rgba(175, 58, 48, 0.32)';
      ctx.lineWidth = 2.1;
      for (let h = -2; h <= 2; h++) {
        ctx.beginPath();
        ctx.moveTo(cx + h * 11 - 5, cy + 6);
        ctx.lineTo(cx + h * 11 + 5, cy - 7);
        ctx.stroke();
      }
    }
  });

  // Stubble / Beard jaw blend + Scratchy Ink Stubble Strokes for Driver & Hospital Worker
  if (F.stubble) {
    const bGrad = ctx.createLinearGradient(0, H * 0.54, 0, H * 0.94);
    bGrad.addColorStop(0, 'rgba(30,24,22,0)');
    bGrad.addColorStop(0.4, `rgba(32,25,22,${F.stubble * 0.48})`);
    bGrad.addColorStop(1, `rgba(22,18,16,${F.stubble * 0.82})`);
    ctx.fillStyle = bGrad;
    ctx.beginPath(); ctx.arc(W * 0.5, H * 0.68, W * 0.34, 0, PI); ctx.fill();
    ctx.strokeStyle = 'rgba(20, 16, 15, 0.38)';
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 48; i++) {
      const a = 0.15 * PI + (i / 48) * 0.7 * PI;
      const r = W * (0.20 + (i % 5) * 0.026);
      const sx = W * 0.5 + C(a) * r, sy = H * 0.63 + S(a) * r * 0.68;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + (i % 2 ? 2 : -2), sy + 7); ctx.stroke();
    }
  }

  // Signature Plaster Band-Aid for Wren (Nose Bridge / Cheek from Sheet 005)
  if (F.bandaid) {
    ctx.save();
    ctx.translate(W * 0.63, H * 0.53);
    ctx.rotate(-0.20);
    ctx.fillStyle = '#e6b896';
    ctx.strokeStyle = '#3b2318';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.roundRect(-38, -14, 76, 28, 8);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f5d9c4';
    ctx.fillRect(-13, -12, 26, 24);
    ctx.strokeStyle = 'rgba(59,35,24,0.45)';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(-13, -12, 26, 24);
    ctx.restore();
  }

  // Gaunt Cheekbone & Nasolabial Scratchy Ink Lines for Driver & Aunt Momma
  if (F.lines) {
    ctx.strokeStyle = '#2b1612';
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 2.8;
    [-1, 1].forEach(sd => {
      ctx.beginPath();
      ctx.moveTo(W * (0.5 + sd * 0.085), H * 0.585);
      ctx.quadraticCurveTo(W * (0.5 + sd * 0.145), H * 0.66, W * (0.5 + sd * 0.132), H * 0.745);
      ctx.stroke();
      // Scratchy cheekbone hollow hatching for Aunt Momma & Driver
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(W * (0.5 + sd * (0.24 + k * 0.015)), H * (0.56 + k * 0.018));
        ctx.lineTo(W * (0.5 + sd * (0.20 + k * 0.015)), H * (0.59 + k * 0.018));
        ctx.stroke();
      }
    });
    ctx.globalAlpha = 1.0;
  }

  // 2. Nose Gouache Shading, Scratchy Ink Contour, Nostrils & Bridge Highlight
  const isEthan = s.id === 'ethan';
  const nw = (N.w || 1) * (isEthan ? 0.039 : 0.044) * W;
  const ny = H * (isEthan ? 0.562 : 0.580);

  if (isEthan) {
    // Ethan's signature warm terracotta nose-bridge blush band & upturned button nose gouache triangle (Sheet 001)
    const nbGrad = ctx.createRadialGradient(W * 0.5, ny - H * 0.04, 4, W * 0.5, ny - H * 0.04, W * 0.14);
    nbGrad.addColorStop(0, 'rgba(204, 88, 66, 0.24)');
    nbGrad.addColorStop(1, 'rgba(204, 88, 66, 0)');
    ctx.fillStyle = nbGrad;
    ctx.fillRect(W * 0.34, ny - H * 0.10, W * 0.32, H * 0.14);
    // Warm amber-terracotta triangular button-nose shadow underneath & on left plane
    ctx.fillStyle = 'rgba(158, 86, 62, 0.58)';
    ctx.beginPath();
    ctx.moveTo(W * 0.5 - nw * 0.18, H * 0.455);
    ctx.quadraticCurveTo(W * 0.5 - nw * 0.68, H * 0.525, W * 0.5 - nw * 0.85, ny + 2);
    ctx.quadraticCurveTo(W * 0.5, ny + H * 0.022, W * 0.5 + nw * 0.72, ny + 2);
    ctx.lineTo(W * 0.5 + nw * 0.12, ny - H * 0.012);
    ctx.closePath();
    ctx.fill();
    // Crisp dark-ink L-contour on nose tip & nostril
    ctx.strokeStyle = '#24120d';
    ctx.lineWidth = 3.0;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(W * 0.5 - nw * 0.35, H * 0.485);
    ctx.quadraticCurveTo(W * 0.5 - nw * 0.74, H * 0.535, W * 0.5 - nw * 0.65, ny + 4);
    ctx.quadraticCurveTo(W * 0.5, ny + H * 0.016, W * 0.5 + nw * 0.55, ny + 3);
    ctx.stroke();
    // Creamy gouache button-nose tip highlight dot
    ctx.fillStyle = '#fce5cf';
    ctx.beginPath();
    ctx.ellipse(W * 0.5 + nw * 0.14, ny - H * 0.016, nw * 0.34, H * 0.010, -0.18, 0, PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = skinMidSh;
    ctx.beginPath();
    ctx.moveTo(W * 0.5 - nw * 0.28, H * 0.40);
    ctx.quadraticCurveTo(W * 0.5 - nw * 0.76, H * 0.53, W * 0.5 - nw * 0.94, ny);
    ctx.lineTo(W * 0.5, ny + H * 0.016);
    ctx.lineTo(W * 0.5, H * 0.40);
    ctx.closePath();
    ctx.fill();

    // Scratchy ink contour along left side of nose bridge & under nose tip
    ctx.strokeStyle = '#24120e';
    ctx.lineWidth = 2.6;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(W * 0.5 - nw * 0.34, H * 0.415);
    ctx.quadraticCurveTo(W * 0.5 - nw * 0.72, H * 0.52, W * 0.5 - nw * 0.90, ny);
    ctx.stroke();
    ctx.lineWidth = 1.6;
    for (let h = 0; h < 5; h++) {
      const hy = H * (0.44 + h * 0.026);
      ctx.beginPath();
      ctx.moveTo(W * 0.5 - nw * 0.58, hy);
      ctx.lineTo(W * 0.5 - nw * 0.18, hy + 5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    ctx.fillStyle = skinDeepSh;
    ctx.beginPath();
    ctx.moveTo(W * 0.5 - nw * 0.95, ny + 2);
    ctx.quadraticCurveTo(W * 0.5, ny + H * 0.025, W * 0.5 + nw * 0.95, ny + 2);
    ctx.quadraticCurveTo(W * 0.5, ny + H * 0.010, W * 0.5 - nw * 0.95, ny + 2);
    ctx.fill();

    ctx.fillStyle = '#2a1510';
    [-1, 1].forEach(sd => {
      ctx.beginPath();
      ctx.ellipse(W * 0.5 + sd * nw * 0.52, ny + 3, nw * 0.22, 3.2, sd * 0.35, 0, PI * 2);
      ctx.fill();
    });

    ctx.strokeStyle = skinHi;
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(W * 0.5 + 2, H * 0.425);
    ctx.lineTo(W * 0.5 + 2, ny - H * 0.016);
    ctx.stroke();
  }

  // 3. Expressive Painterly Eyes (with Ethan's Sheet 001 DETAILS Close-Up Iris & Spiky Outer Lashes)
  const eyeSp = (E.sp || 0.06) * (isEthan ? 2.92 : 2.85);
  const eyeY = H * ((isEthan ? 0.454 : 0.428) - (E.y - 0.02) * 0.9);
  const ew = W * (E.w || (isEthan ? 0.128 : 0.114));
  const eh = H * (E.eh || (isEthan ? 0.074 : 0.058));
  const openAmt = Math.max(0.02, 1.0 - Math.min(1.0, (E.ld || 0) * 0.65 + lid * 0.78 + bk * 0.98));

  [-1, 1].forEach(sd => {
    const ex = W * (0.5 + sd * eyeSp);
    ctx.save();
    ctx.translate(ex, eyeY);
    ctx.rotate(-sd * (E.tilt || 0) * 0.55);

    if (E.bag || isEthan) {
      // Subtle warm gouache lower-lid / aegyo-sal contour for Ethan
      ctx.strokeStyle = isEthan ? 'rgba(152, 82, 62, 0.38)' : hexStr(E.bag);
      ctx.lineWidth = isEthan ? 2.6 : 3.2;
      ctx.globalAlpha = isEthan ? 0.65 : 0.50;
      ctx.beginPath();
      ctx.moveTo(-ew * 0.68, eh * 0.58);
      ctx.quadraticCurveTo(0, eh * 0.88, ew * 0.66, eh * 0.50);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    const topY = -eh * (0.88 * openAmt - 0.14);
    const botY = eh * (0.66 - Math.max(0, sm) * 0.18);

    if (openAmt > 0.08) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-ew, eh * 0.08);
      ctx.bezierCurveTo(-ew * 0.48, topY * 1.34, ew * 0.48, topY * 1.34, ew, -eh * 0.02);
      ctx.bezierCurveTo(ew * 0.48, botY * 1.28, -ew * 0.48, botY * 1.28, -ew, eh * 0.08);
      ctx.closePath();
      ctx.fillStyle = '#f8f4ed';
      ctx.fill();
      ctx.clip();

      const ir = ew * (isEthan ? 0.59 : 0.55);
      const ix = gx * ew * 0.35, iy = -eh * 0.03 + gy * eh * 0.3;
      const irisCol = hexStr(E.iris), irisHi = shiftHex(E.iris, 1.55), irisDark = shiftHex(E.iris, 0.42);

      // Dark outer limbal ring
      ctx.fillStyle = irisDark;
      ctx.beginPath(); ctx.arc(ix, iy, ir, 0, PI * 2); ctx.fill();

      // Warm chestnut-to-honey amber iris gradient
      const ig = ctx.createRadialGradient(ix, iy + ir * 0.28, ir * 0.08, ix, iy, ir * 0.92);
      ig.addColorStop(0, isEthan ? '#e69b4c' : irisHi);
      ig.addColorStop(0.58, irisCol);
      ig.addColorStop(1, irisDark);
      ctx.fillStyle = ig;
      ctx.beginPath(); ctx.arc(ix, iy, ir * 0.90, 0, PI * 2); ctx.fill();

      if (isEthan) {
        // Sheet 001 DETAILS Close-Up: Cool slate-blue/cyan window-reflection crescent on side of iris!
        ctx.fillStyle = 'rgba(104, 158, 194, 0.58)';
        ctx.beginPath();
        ctx.arc(ix - ir * 0.36, iy - ir * 0.06, ir * 0.48, PI * 0.65, PI * 1.38);
        ctx.fill();
        // Warm golden-amber lower iris glow arc
        ctx.strokeStyle = 'rgba(245, 172, 78, 0.72)';
        ctx.lineWidth = 4.2;
        ctx.beginPath();
        ctx.arc(ix, iy + ir * 0.06, ir * 0.62, PI * 0.18, PI * 0.82);
        ctx.stroke();
      }

      // Deep espresso pupil
      ctx.fillStyle = '#0d0808';
      ctx.beginPath(); ctx.arc(ix, iy, ir * 0.42, 0, PI * 2); ctx.fill();

      // Upper eyelid cast shadow across sclera & top of iris
      const lidSh = ctx.createLinearGradient(0, topY, 0, topY + eh * 0.78);
      lidSh.addColorStop(0, 'rgba(36, 18, 14, 0.55)');
      lidSh.addColorStop(1, 'rgba(36, 18, 14, 0)');
      ctx.fillStyle = lidSh;
      ctx.fillRect(-ew * 1.2, topY - 10, ew * 2.4, eh * 0.88);

      // Crisp painter's catchlights
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ix + ir * 0.32, iy - ir * 0.28, ir * (isEthan ? 0.24 : 0.22), 0, PI * 2); ctx.fill();
      ctx.globalAlpha = 0.82;
      ctx.beginPath(); ctx.arc(ix - ir * 0.28, iy + ir * 0.30, ir * 0.12, 0, PI * 2); ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.restore();

      // Crisp double-eyelid ink crease (Sheet 001 DETAILS)
      ctx.strokeStyle = isEthan ? '#381c14' : skinDeepSh;
      ctx.lineWidth = isEthan ? 3.2 : 2.5;
      ctx.beginPath();
      ctx.moveTo(-ew * 0.86, topY * 0.82 - eh * 0.22);
      ctx.quadraticCurveTo(0, topY * 1.34 - eh * 0.25, ew * 0.94, topY * 0.68 - eh * 0.18);
      ctx.stroke();

      // Lower lash line + subtle outer lower lash ticks
      ctx.strokeStyle = 'rgba(42, 22, 18, 0.60)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-ew * 0.90, eh * 0.08);
      ctx.bezierCurveTo(-ew * 0.42, botY * 1.25, ew * 0.42, botY * 1.25, ew * 0.96, -eh * 0.02);
      ctx.stroke();

      // Hand-Inked Upper Lash Arch + Spiky Outer Corner Lash Ticks
      ctx.strokeStyle = '#140c0a';
      ctx.lineWidth = isEthan ? 7.4 : (F.wing ? 6.8 : 6.0);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-ew * 1.02, eh * 0.10);
      ctx.bezierCurveTo(-ew * 0.45, topY * 1.36, ew * 0.48, topY * 1.36, ew * (F.wing || isEthan ? 1.12 : 1.04), -eh * (F.wing ? 0.16 : 0.02));
      ctx.stroke();

      if (isEthan) {
        // Signature spiky outer eyelash ticks from Sheet 001 DETAILS eye close-up
        ctx.lineWidth = 3.8;
        ctx.beginPath();
        ctx.moveTo(sd * ew * 0.86, topY * 0.52);
        ctx.lineTo(sd * ew * 1.16, topY * 0.72 - 4);
        ctx.moveTo(sd * ew * 0.96, -eh * 0.02);
        ctx.lineTo(sd * ew * 1.20, -eh * 0.12);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = '#160e0d';
      ctx.lineWidth = 5.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-ew, eh * 0.06);
      ctx.quadraticCurveTo(0, eh * 0.45, ew * 1.05, eh * 0.02);
      ctx.stroke();
    }

    if (tear > 0.05) {
      ctx.fillStyle = 'rgba(125, 211, 252, 0.85)';
      ctx.beginPath();
      ctx.arc(sd * ew * 0.55, eh * 0.65, 6.5 * tear, 0, PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });

  // 4. Sculpted Eyebrows (with scratchy inner hair strokes for Ethan)
  const browYBase = H * (isEthan ? 0.334 : 0.318);
  [-1, 1].forEach(sd => {
    const lift = (sd < 0 ? bl : br) * H * 0.036;
    const bx = W * (0.5 + sd * eyeSp * 1.02);
    const by = browYBase - lift + a * H * 0.015;
    const bw = W * (B.w || 0.07) * (isEthan ? 1.95 : 1.85);
    const bt = H * (B.t || 0.012) * (isEthan ? 1.55 : 1.45);

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(sd * ((B.arch || -0.05) + a * 0.38));
    ctx.fillStyle = hexStr(B.col);
    ctx.beginPath();
    ctx.moveTo(-sd * bw * 0.52, bt * 0.32);
    ctx.quadraticCurveTo(sd * bw * 0.08, -bt * 1.15, sd * bw * 0.56, bt * 0.15);
    ctx.quadraticCurveTo(sd * bw * 0.08, -bt * 0.15, -sd * bw * 0.52, bt * 0.85);
    ctx.closePath();
    ctx.fill();
    if (isEthan) {
      // Individual inner brow hair strokes (Sheet 001 DETAILS)
      ctx.strokeStyle = hexStr(B.col);
      ctx.lineWidth = 2.2;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(-sd * (bw * 0.48 - k * 6), bt * 0.8);
        ctx.lineTo(-sd * (bw * 0.42 - k * 6), -bt * 0.5);
        ctx.stroke();
      }
    }
    ctx.restore();
  });

  // 5. Sculpted Lips, Smile / Teeth Grin & Open Mouth (higher, compact boyish placement for Ethan)
  const my = H * (isEthan ? 0.692 : 0.735);
  const mw = W * (Mo.w || 0.035) * (isEthan ? 2.95 : 3.1);
  const cornerDY = -sm * H * 0.026;
  const upCol = hexStr(Mo.col);
  const lowCol = shiftHex(Mo.col, 1.18);
  const toothGrin = (sm > 0.32 && op < 0.14);

  if (op > 0.04 || toothGrin) {
    const openH = toothGrin ? (H * 0.028 * Math.min(1, sm * 1.35)) : (H * 0.075 * op);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(W * 0.5 - mw, my + cornerDY);
    ctx.quadraticCurveTo(W * 0.5, my - openH * 0.35, W * 0.5 + mw, my + cornerDY);
    ctx.quadraticCurveTo(W * 0.5, my + openH * 1.35 + cornerDY * 0.4, W * 0.5 - mw, my + cornerDY);
    ctx.closePath();

    ctx.fillStyle = '#2d0e10';
    ctx.fill();
    ctx.clip();

    ctx.fillStyle = '#f6f2ea';
    ctx.fillRect(W * 0.5 - mw * 0.88, my - openH * 0.4, mw * 1.76, openH * (toothGrin ? 0.95 : 0.52));

    if (!toothGrin) {
      ctx.fillStyle = '#9e4240';
      ctx.beginPath();
      ctx.arc(W * 0.5, my + openH * 1.05, mw * 0.62, PI, 0);
      ctx.fill();
    }
    ctx.restore();

    ctx.strokeStyle = upCol;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(W * 0.5 - mw, my + cornerDY);
    ctx.quadraticCurveTo(W * 0.5, my - openH * 0.35, W * 0.5 + mw, my + cornerDY);
    ctx.quadraticCurveTo(W * 0.5, my + openH * 1.35 + cornerDY * 0.4, W * 0.5 - mw, my + cornerDY);
    ctx.stroke();
  } else {
    ctx.fillStyle = upCol;
    ctx.beginPath();
    ctx.moveTo(W * 0.5 - mw, my + cornerDY);
    ctx.quadraticCurveTo(W * 0.5 - mw * 0.35, my - H * 0.015, W * 0.5, my - H * 0.008);
    ctx.quadraticCurveTo(W * 0.5 + mw * 0.35, my - H * 0.015, W * 0.5 + mw, my + cornerDY);
    ctx.quadraticCurveTo(W * 0.5, my + H * 0.004 + cornerDY * 0.35, W * 0.5 - mw, my + cornerDY);
    ctx.fill();

    ctx.fillStyle = lowCol;
    ctx.beginPath();
    ctx.moveTo(W * 0.5 - mw * 0.92, my + cornerDY);
    ctx.quadraticCurveTo(W * 0.5, my + H * 0.004 + cornerDY * 0.35, W * 0.5 + mw * 0.92, my + cornerDY);
    ctx.quadraticCurveTo(W * 0.5, my + H * 0.026 + cornerDY * 0.45, W * 0.5 - mw * 0.92, my + cornerDY);
    ctx.fill();

    ctx.strokeStyle = '#2d1210';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(W * 0.5 - mw * 1.02, my + cornerDY);
    ctx.quadraticCurveTo(W * 0.5, my + H * 0.004 + cornerDY * 0.32, W * 0.5 + mw * 1.02, my + cornerDY);
    ctx.stroke();
  }

  ctx.strokeStyle = skinDeepSh;
  ctx.lineWidth = 2.6;
  ctx.globalAlpha = 0.42;
  ctx.beginPath();
  ctx.moveTo(W * 0.5 - mw * 0.45, my + H * 0.042);
  ctx.quadraticCurveTo(W * 0.5, my + H * 0.034, W * 0.5 + mw * 0.45, my + H * 0.042);
  ctx.stroke();
  ctx.globalAlpha = 1.0;

  fs.tex.needsUpdate = true;
}

// ============================================================================
// 4. PROCEDURAL FABRIC & EMBLEM TEXTURES (FROM REFERENCE SHEETS)
// ============================================================================
function makePatternTex(type) {
  const can = document.createElement('canvas');
  can.width = 256; can.height = 256;
  const ctx = can.getContext('2d');

  if (type === 'aunt_floral') {
    // Aunt Momma's dark botanical/floral kimono cardigan & patchwork skirt
    ctx.fillStyle = '#2e2430';
    ctx.fillRect(0, 0, 256, 256);
    const cols = ['#d87a56', '#e6b85c', '#82a67d', '#c96578'];
    for (let y = 24; y < 256; y += 48) {
      for (let x = 24; x < 256; x += 48) {
        ctx.fillStyle = cols[((x + y) / 48) % cols.length | 0];
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * PI * 2;
          ctx.beginPath();
          ctx.arc(x + C(a) * 8, y + S(a) * 8, 6, 0, PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#f5e1a4';
        ctx.beginPath(); ctx.arc(x, y, 4, 0, PI * 2); ctx.fill();
      }
    }
  } else if (type === 'mom_floral') {
    // Ethan's Mother's warm cream & dusty-blue botanical cardigan
    ctx.fillStyle = '#3a4659';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 28; y < 256; y += 52) {
      for (let x = 28; x < 256; x += 52) {
        ctx.fillStyle = '#e8d5b7';
        ctx.beginPath(); ctx.arc(x, y, 10, 0, PI * 2); ctx.fill();
        ctx.fillStyle = '#7fa6c4';
        ctx.beginPath(); ctx.arc(x + 12, y - 8, 6, 0, PI * 2); ctx.fill();
      }
    }
  } else if (type === 'driver_plaid') {
    // Driver's weathered flannel plaid shirt
    ctx.fillStyle = '#5e4334';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(30, 42, 38, 0.55)';
    for (let i = 0; i < 256; i += 32) {
      ctx.fillRect(i, 0, 12, 256);
      ctx.fillRect(0, i, 256, 12);
    }
    ctx.strokeStyle = '#c89b6e';
    ctx.lineWidth = 2;
    for (let i = 16; i < 256; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
    }
  } else if (type === 'sofi_pastel') {
    // Sofi's oversized pastel mint / cream / pink gaming jacket
    ctx.fillStyle = '#9fd8cb';
    ctx.fillRect(0, 0, 256, 110);
    ctx.fillStyle = '#f5ebd6';
    ctx.fillRect(0, 110, 256, 70);
    ctx.fillStyle = '#f2a6b8';
    ctx.fillRect(0, 180, 256, 76);
  }
  const t = new T.CanvasTexture(can);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  return t;
}
const TEX_AUNT = makePatternTex('aunt_floral');
const TEX_MOM = makePatternTex('mom_floral');
const TEX_PLAID = makePatternTex('driver_plaid');
const TEX_SOFI = makePatternTex('sofi_pastel');

// ============================================================================
// 5. SCULPTED 3D HAIRSTYLES, CAPS, HEADPHONES & BEARDS (NO SPHERE BLOBS)
// ============================================================================
const buildBaseSkullcap = (hd, hs, col, yCut = 0.095) => {
  const geo = new T.SphereGeometry(0.150, 28, 20);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i) * hs[0] * 1.03;
    let y = pos.getY(i) * hs[1] * 1.05 + 0.020;
    let z = pos.getZ(i) * hs[2] * 1.04 - 0.016;
    // Carve away the entire front forehead/face hemisphere below yCut so eyes & brows are 100% unobstructed
    if (z > -0.015 && y < yCut) {
      const f = Math.min(1, (z + 0.015) / 0.055);
      y = y + (yCut - y) * (0.96 * f);
      z *= (1.0 - 0.26 * f);
    }
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  M(geo, col, [0, 0, 0], hd, null, 0.85);
};

const FX = {
  ethan: (hd, s, hs, outfitIdx = 0) => {
    // Cohesive rich espresso & warm chestnut gouache hair palette (no orange shader overshoot)
    const hDark = 0x2c1b13, h1 = s.hair, h2 = 0x4a3124, hRim = 0x5c3e2e;
    // High hairline skullcap (yCut = 0.108 keeps forehead, eyebrows & big eyes 100% open!)
    buildBaseSkullcap(hd, [hs[0] * 1.05, hs[1] * 1.04, hs[2] * 1.05], h1, 0.108);

    // 1. High-Parted Forehead Bangs framing the upper forehead ABOVE the eyebrows (y >= 0.066)
    const frontBlades = [
      // Center-parted V-bangs (tips end at y = 0.066..0.072, well above eyebrows at y = 0.044!)
      [[-0.012, 0.165, 0.06], [-0.024, 0.128, 0.136], [-0.036, 0.066, 0.144]],
      [[0.018, 0.165, 0.06], [0.032, 0.130, 0.136], [0.046, 0.070, 0.142]],
      // Mid-forehead parted gouache blades (tips at y = 0.074..0.078)
      [[-0.042, 0.162, 0.05], [-0.072, 0.126, 0.128], [-0.092, 0.074, 0.132]],
      [[0.048, 0.162, 0.05], [0.080, 0.126, 0.128], [0.102, 0.076, 0.130]],
      // Outer upper-temple blades sweeping outward above the brow ridge
      [[-0.078, 0.154, 0.04], [-0.124, 0.116, 0.108], [-0.152, 0.072, 0.098]],
      [[0.078, 0.154, 0.04], [0.126, 0.116, 0.108], [0.154, 0.070, 0.096]],
      // Subtle warm chestnut center-crown wisp
      [[0.004, 0.172, 0.05], [0.008, 0.138, 0.140], [-0.004, 0.082, 0.146]]
    ];
    frontBlades.forEach((pts, i) => {
      const col = i === 6 ? hRim : (i % 2 === 0 ? h1 : h2);
      addBladeLock(hd, pts, 0.028, 0.035, 0.005, col, 0.36, 0.50);
    });

    // 2. Signature Wide Flared Side-Tufts & Ear-Level Spikes (strictly outside |x| > 0.135 so face is clear)
    [-1, 1].forEach(sd => {
      // Upper-side horizontal flared spike (wide star-like silhouette!)
      addBladeLock(hd, [[sd * 0.085, 0.158, 0.00], [sd * 0.168, 0.142, 0.01], [sd * 0.232, 0.118, -0.01]], 0.036, 0.046, 0.006, sd > 0 ? hRim : h2, 0.38, 0.72);
      // Mid-temple outward spike above ear
      addBladeLock(hd, [[sd * 0.105, 0.132, 0.01], [sd * 0.182, 0.092, 0.02], [sd * 0.224, 0.045, 0.005]], 0.034, 0.044, 0.006, h1, 0.40, 0.72);
      // Slender sideburn tuft tucked right in front of ear (at |x| = 0.146)
      addBladeLock(hd, [[sd * 0.125, 0.092, 0.025], [sd * 0.148, 0.042, 0.042], [sd * 0.145, -0.012, 0.036]], 0.018, 0.022, 0.004, hDark, 0.36, 0.45);
      // Lower rear-ear kick tuft behind ear
      addBladeLock(hd, [[sd * 0.112, 0.082, -0.04], [sd * 0.175, 0.028, -0.06], [sd * 0.202, -0.032, -0.08]], 0.032, 0.040, 0.006, h2, 0.40, 0.68);
    });

    // 3. Tousled Crown Spikes, Swept-Up Cowlick & Back Nape Mane
    const crownAndBack = [
      [[0.0, 0.168, 0.01], [0.035, 0.232, -0.01], [0.088, 0.264, -0.04]],
      [[-0.02, 0.170, -0.01], [-0.065, 0.228, -0.03], [-0.118, 0.245, -0.08]],
      [[0.03, 0.165, -0.04], [0.082, 0.212, -0.09], [0.128, 0.218, -0.14]],
      [[0.0, 0.14, -0.10], [0.0, 0.12, -0.185], [0.0, 0.075, -0.232]],
      [[-0.06, 0.11, -0.10], [-0.10, 0.06, -0.178], [-0.12, -0.01, -0.215]],
      [[0.06, 0.11, -0.10], [0.10, 0.06, -0.178], [0.12, -0.01, -0.215]],
      [[0.0, 0.06, -0.11], [0.0, -0.01, -0.168], [0.0, -0.070, -0.195]]
    ];
    crownAndBack.forEach((pts, i) => {
      addBladeLock(hd, pts, 0.034, 0.042, 0.006, i === 0 ? hRim : (i % 2 ? h2 : h1), 0.40, 0.68);
    });

    // Outfit 2: Father's Khaki Bucket Hat with Chin-Cord & Dark Wayfarer Sunglasses (Sheet 001 C. Later Outfit)
    if (outfitIdx === 2) {
      M(Cy(0.155, 0.175, 0.115, 24), 0xd4be98, [0, 0.162, -0.005], hd, null, 0.85);
      M(Cy(0.242, 0.268, 0.024, 28), 0xc7af87, [0, 0.108, -0.005], hd, [1, 1, 0.95], 0.85);
      M(Tr(0.166, 0.011, PI * 2), 0x3b6e8c, [0, 0.122, -0.005], hd, null, 0).rotation.x = PI / 2;
      [-1, 1].forEach(sd => {
        M(Bx(0.068, 0.044, 0.015), 0x111318, [sd * 0.050, 0.014, 0.152], hd, null, 0.55);
        M(Bx(0.056, 0.034, 0.017), 0x1e293b, [sd * 0.050, 0.014, 0.153], hd, null, 0);
        M(Bx(0.012, 0.010, 0.11), 0x181a20, [sd * 0.084, 0.020, 0.09], hd, null, 0);
      });
      M(Bx(0.038, 0.009, 0.012), 0x181a20, [0, 0.022, 0.154], hd, null, 0);
    }
  },

  sofi: (hd, s, hs, outfitIdx = 0) => {
    const h1 = s.hair, h2 = 0x63402c;
    buildBaseSkullcap(hd, hs, h1, 0.080);
    // Sofi's voluminous wavy twin-tails, parted bangs, Fox Hairclips & Pastel Gamer Headset with Boom Mic (Sheet 006)
    [-1, 1].forEach(sd => {
      addLock(hd, [[0, 0.162, 0.085], [sd * 0.068, 0.132, 0.142], [sd * 0.112, 0.062, 0.128]], 0.028, 0.036, 0.006, h1);
      addLock(hd, [[sd * 0.035, 0.160, 0.09], [sd * 0.042, 0.118, 0.148], [sd * 0.065, 0.075, 0.142]], 0.020, 0.026, 0.004, h2);
      // Long flowing wavy twin-tails bound with cyan & pink ties
      M(Tr(0.028, 0.009, PI * 2), sd < 0 ? 0x38bdf8 : 0xf472b6, [sd * 0.135, 0.035, -0.03], hd, null, 0.4).rotation.y = sd * 0.5;
      addLock(hd, [[sd * 0.125, 0.04, -0.02], [sd * 0.175, -0.04, 0.02], [sd * 0.185, -0.17, 0.04], [sd * 0.155, -0.31, 0.05]], 0.034, 0.046, 0.010, h1);
      addLock(hd, [[sd * 0.115, 0.04, -0.05], [sd * 0.162, -0.06, -0.06], [sd * 0.155, -0.21, -0.07], [sd * 0.130, -0.34, -0.05]], 0.030, 0.042, 0.009, h2);
      // Crossed Pastel Hairpins on temple
      M(Bx(0.032, 0.009, 0.010), sd < 0 ? 0xf97316 : 0x38bdf8, [sd * 0.116, 0.088, 0.116], hd, null, 0).rotation.z = sd * 0.25;
      M(Bx(0.030, 0.008, 0.010), 0xfef08a, [sd * 0.118, 0.074, 0.118], hd, null, 0).rotation.z = -sd * 0.18;
    });
    // Chunky Pastel Gaming Headset with glowing Green Wolf / Fox ears & curved boom mic
    if (outfitIdx !== 1) {
      M(Tr(0.164, 0.016, PI, 10, 24), 0xf8fafc, [0, 0.022, 0], hd, null, 0.75);
      [-1, 1].forEach(sd => {
        M(Cy(0.046, 0.046, 0.032, 18), 0x282c37, [sd * 0.160, 0.005, 0.008], hd, null, 0.75).rotation.z = PI / 2;
        M(Cy(0.032, 0.032, 0.036, 16), 0x4ade80, [sd * 0.164, 0.005, 0.008], hd, null, 0).rotation.z = PI / 2;
        const ear = M(Cn(0.028, 0.055, 4), 0xf472b6, [sd * 0.112, 0.182, 0], hd, null, 0.65);
        ear.rotation.z = -sd * 0.35;
      });
      // Headset boom microphone curving toward mouth
      addLock(hd, [[-0.158, -0.01, 0.02], [-0.145, -0.055, 0.095], [-0.075, -0.075, 0.152]], 0.007, 0.006, 0.010, 0x334155);
    }
  },

  wren: (hd, s, hs, outfitIdx = 0) => {
    const h1 = s.hair, h2 = 0x422c22;
    buildBaseSkullcap(hd, hs, h1, 0.078);
    // Wren's wild, jagged anime/comic superhero spikes jutting out (Sheet 005)
    const locks = [
      [[0, 0.165, 0.06], [-0.032, 0.135, 0.148], [-0.058, 0.065, 0.152]],
      [[0.025, 0.165, 0.06], [0.052, 0.132, 0.146], [0.085, 0.068, 0.146]],
      [[-0.055, 0.152, 0.04], [-0.105, 0.112, 0.128], [-0.132, 0.048, 0.118]],
      [[0.055, 0.152, 0.04], [0.105, 0.112, 0.128], [0.132, 0.048, 0.118]],
      [[0, 0.175, 0.01], [0.015, 0.225, -0.02], [0.035, 0.260, -0.05]],
      [[-0.03, 0.172, -0.02], [-0.075, 0.220, -0.06], [-0.115, 0.245, -0.10]]
    ];
    locks.forEach((pts, i) => addLock(hd, pts, 0.030, 0.038, 0.005, i % 2 ? h2 : h1));
    [-1, 1].forEach(sd => {
      addLock(hd, [[sd * 0.08, 0.15, 0.0], [sd * 0.162, 0.105, 0.03], [sd * 0.182, 0.025, 0.01]], 0.032, 0.040, 0.006, h1);
      addLock(hd, [[sd * 0.06, 0.17, -0.03], [sd * 0.142, 0.195, -0.06], [sd * 0.178, 0.148, -0.09]], 0.030, 0.038, 0.006, h2);
    });
    // Outfit 1: Star Emblem Cap (Casual outside from 8f1faa9e)
    if (outfitIdx === 1) {
      M(Sp(0.154, 20, 14), 0x7f1d1d, [0, 0.062, -0.005], hd, [1.03, 0.85, 1.05], 0.8);
      M(Bx(0.172, 0.016, 0.115), 0x1f242d, [0, 0.095, 0.138], hd, null, 0.7);
      M(Sp(0.022), 0xfef08a, [0, 0.125, 0.145], hd, [1, 1, 0.3], 0);
    }
    // Outfit 3: Alt Concept 005 (50eee43f) Twin Buns & Bunny Clip
    if (outfitIdx === 3) {
      [-1, 1].forEach(sd => {
        M(Sp(0.062), h1, [sd * 0.118, 0.168, -0.03], hd, null, 0.85);
      });
      M(Sp(0.020), 0xfef2f2, [-0.108, 0.112, 0.108], hd, [1.2, 0.8, 0.6], 0);
    }
  },

  aunt: (hd, s, hs, outfitIdx = 0) => {
    const h1 = s.hair, h2 = 0x3b261e;
    buildBaseSkullcap(hd, hs, h1, 0.088);
    // Aunt Momma's towering messy top-knot bun, coral floral scrunchie, chopsticks, wavy tendrils & gold hoops (Sheet 004)
    [-1, 1].forEach(sd => {
      addLock(hd, [[0, 0.158, 0.09], [sd * 0.078, 0.138, 0.130], [sd * 0.128, 0.080, 0.098]], 0.026, 0.034, 0.006, h1);
      // Long wavy loose emotional tendrils framing hollow cheeks
      addLock(hd, [[sd * 0.118, 0.095, 0.07], [sd * 0.144, 0.015, 0.078], [sd * 0.130, -0.065, 0.065], [sd * 0.145, -0.135, 0.045]], 0.017, 0.024, 0.003, h2);
      // Large dangling gold hoop earrings
      M(Tr(0.022, 0.004, PI * 2), 0xeab308, [sd * 0.138 * hs[0], -0.038, 0.006], hd, null, 0).rotation.y = PI / 2;
    });
    // High messy bun, coral floral scrunchie & crossed gold hairpins
    M(Tr(0.062, 0.020, PI * 2), 0xd97757, [0, 0.180, -0.075], hd, null, 0.65).rotation.x = PI * 0.42;
    M(Sp(0.084), h1, [0, 0.222, -0.092], hd, [1.15, 1.05, 1.02], 0.88);
    [-1, 1].forEach(sd => {
      const pin = M(Cy(0.004, 0.002, 0.22, 6), 0xfbbf24, [sd * 0.02, 0.22, -0.09], hd, null, 0);
      pin.rotation.z = sd * 1.1;
    });
    // Outfit 2: Monster Costume Hood ("I am Aunt Momma the monster! Roar!")
    if (outfitIdx === 2) {
      M(Sp(0.170), 0x22c55e, [0, 0.04, -0.02], hd, [1.05, 1.08, 1.05], 0.85);
      [-1, 1].forEach(sd => M(Cn(0.028, 0.070, 8), 0xfacc15, [sd * 0.082, 0.215, 0.02], hd, null, 0.7));
    }
  },

  driver: (hd, s, hs, outfitIdx = 0) => {
    const g1 = 0x282320, g2 = 0x57524e;
    buildBaseSkullcap(hd, hs, g1, 0.100);
    // Sculpted 3D Heavy Salt-and-Pepper Full Beard, Sideburns & Walrus Moustache (Sheet 003)
    [-1, 1].forEach(sd => {
      addLock(hd, [[0, -0.048, 0.154], [sd * 0.038, -0.056, 0.150], [sd * 0.066, -0.078, 0.135]], 0.019, 0.024, 0.008, g1, 0.88);
      addLock(hd, [[sd * 0.126, -0.005, 0.045], [sd * 0.120, -0.075, 0.092], [sd * 0.074, -0.138, 0.125], [sd * 0.025, -0.162, 0.138]], 0.028, 0.038, 0.014, g1, 0.92);
      addLock(hd, [[sd * 0.090, -0.078, 0.116], [sd * 0.058, -0.135, 0.138], [sd * 0.018, -0.165, 0.145]], 0.026, 0.035, 0.012, g2, 0.92);
    });
    addLock(hd, [[0, -0.088, 0.146], [0, -0.138, 0.152], [0, -0.168, 0.138]], 0.032, 0.042, 0.018, g1, 0.95);

    if (outfitIdx === 1) {
      // Vintage Brown Tweed Flat Cap ("Sir" from Sheet 5b2304a0)
      M(Sp(0.160), 0x4a3b32, [0, 0.112, 0.012], hd, [1.06, 0.56, 1.20], 0.85);
      M(Bx(0.166, 0.016, 0.095), 0x382c25, [0, 0.084, 0.136], hd, null, 0.75);
    } else {
      // Low-pulled Dark Work Baseball Cap (Sheet a97669b8)
      M(Sp(0.155), 0x1e2229, [0, 0.076, -0.005], hd, [1.03, 0.82, 1.05], 0.85);
      const visor = M(Bx(0.168, 0.015, 0.120), 0x15181e, [0, 0.080, 0.144], hd, null, 0.75);
      visor.rotation.x = 0.14;
    }
  },

  mother: (hd, s, hs) => {
    const h1 = s.hair, h2 = 0x38251e;
    buildBaseSkullcap(hd, hs, h1, 0.088);
    // Ethan's Mother: Soft wavy dark-chestnut hair, shoulder curls & Puffy Sky-Blue Scrunchie Bun (Sheet 002)
    [-1, 1].forEach(sd => {
      addLock(hd, [[0, 0.158, 0.09], [sd * 0.074, 0.134, 0.132], [sd * 0.124, 0.076, 0.100]], 0.026, 0.034, 0.006, h1);
      addLock(hd, [[sd * 0.118, 0.09, 0.06], [sd * 0.142, 0.00, 0.072], [sd * 0.132, -0.11, 0.065], [sd * 0.115, -0.19, 0.05]], 0.022, 0.028, 0.006, h2);
    });
    M(Tr(0.058, 0.019, PI * 2), 0x3b82f6, [0, 0.135, -0.118], hd, null, 0.65).rotation.x = PI * 0.35;
    M(Sp(0.078), h1, [0, 0.155, -0.145], hd, [1.08, 0.98, 0.98], 0.85);
  },

  worker: (hd, s, hs) => {
    // Hospital Worker (Sheets 013 & 014 — High-top curly sponge-twist fade + neat boxed beard + wire glasses)
    const h1 = 0x141214, h2 = 0x221e22;
    buildBaseSkullcap(hd, hs, h1, 0.094);
    for (let ix = -2; ix <= 2; ix++) {
      for (let iz = -1; iz <= 1; iz++) {
        M(Sp(0.034), (ix + iz) % 2 ? h1 : h2, [ix * 0.030, 0.168 + (2 - Math.abs(ix)) * 0.008, iz * 0.036 + 0.01], hd, [1, 1.15, 1], 0.55);
      }
    }
    // Neat sculpted boxed jawline beard & moustache
    [-1, 1].forEach(sd => {
      addLock(hd, [[0, -0.050, 0.150], [sd * 0.032, -0.055, 0.146], [sd * 0.052, -0.072, 0.134]], 0.013, 0.016, 0.006, h1, 0.85);
      addLock(hd, [[sd * 0.120, -0.018, 0.05], [sd * 0.108, -0.080, 0.098], [sd * 0.058, -0.134, 0.128], [0, -0.150, 0.138]], 0.019, 0.025, 0.013, h1, 0.88);
    });
  },

  doctor: (hd, s, hs) => {
    // Dr. A. Nakamura (Sheet 012 — Sleek side-parted jet-black hair + silver medical glasses)
    const h1 = s.hair, h2 = 0x262228;
    buildBaseSkullcap(hd, hs, h1, 0.086);
    const bangs = [
      [[-0.045, 0.162, 0.06], [0.025, 0.140, 0.145], [0.082, 0.080, 0.140]],
      [[-0.055, 0.160, 0.05], [-0.088, 0.126, 0.135], [-0.115, 0.072, 0.124]],
      [[0.055, 0.152, 0.04], [0.098, 0.120, 0.128], [0.122, 0.065, 0.118]]
    ];
    bangs.forEach((pts, i) => addLock(hd, pts, 0.026, 0.034, 0.005, i % 2 ? h2 : h1));
    [-1, 1].forEach(sd => {
      addLock(hd, [[sd * 0.09, 0.14, 0.01], [sd * 0.144, 0.07, 0.03], [sd * 0.142, -0.02, 0.01]], 0.026, 0.032, 0.005, h1);
      // Silver-framed medical glasses
      M(Bx(0.056, 0.032, 0.008), 0x64748b, [sd * 0.048, 0.024, 0.148], hd, null, 0.35);
    });
    M(Bx(0.032, 0.006, 0.008), 0x64748b, [0, 0.028, 0.150], hd, null, 0);
  }
};

// ============================================================================
// 6. FULL BODY, MULTI-OUTFIT, FOOTWEAR, PROP & CREATURE BUILDER
// ============================================================================
const rg = (p, r, t, c, y, z = 0) => {
  const m = M(Tr(r, t, PI * 2), c, [0, y, z], p, [1, 0.7, 1], 0.5);
  m.rotation.x = PI / 2;
  return m;
};

const conScreenCan = document.createElement('canvas');
conScreenCan.width = 360; conScreenCan.height = 200;
const conScreenCtx = conScreenCan.getContext('2d');
conScreenCtx.fillStyle = '#111728'; conScreenCtx.fillRect(0, 0, 360, 200);
const conScreenTex = new T.CanvasTexture(conScreenCan);

function buildHandheldConsole(parent, pos, rot) {
  const g = J(parent, pos[0], pos[1], pos[2]);
  if (rot) g.rotation.set(rot[0], rot[1], rot[2]);
  const blk = 0x0d0f15, Z = 0.011;
  M(Bx(0.205, 0.09, 0.014), 0x1b1f2a, [0, 0, 0], g, null, 0.6);                 // body
  M(Bx(0.03, 0.092, 0.018), 0x16b8e8, [-0.1175, 0, 0], g, null, 0.5);           // left grip (blue)
  M(Bx(0.03, 0.092, 0.018), 0xff4a5e, [0.1175, 0, 0], g, null, 0.5);            // right grip (red)
  M(Bx(0.134, 0.078, 0.004), 0x05070b, [0, 0, 0.009], g, null, 0);              // bezel
  const scr = new T.Mesh(new T.PlaneGeometry(0.122, 0.068), new T.MeshBasicMaterial({ map: conScreenTex }));
  scr.position.set(0, 0, 0.0116); g.add(scr);                                   // live game screen
  const dot = (r, x, y) => { M(Cy(r, r, 0.006, 12), blk, [x, y, Z], g, null, 0).rotation.x = PI / 2; };
  dot(0.0075, -0.1175, 0.022); dot(0.0075, 0.1175, -0.022);                     // analog sticks
  [[0, 1], [0, -1], [-1, 0], [1, 1e-9]].forEach(([dx, dy], i) => {
    dot(0.0042, -0.1175 + dx * 0.0095, -0.02 + dy * 0.0095);                    // d-pad
    dot(0.0042, 0.1175 + dx * 0.0095, 0.02 + dy * 0.0095);                      // A B X Y
  });
  return g;
}

function buildHuman(s, outfitIdx = 0) {
  const a = s.art;
  CS = { gm: grad(a.g, a.soft), w: a.w, oc: new T.Color(a.ol) };

  const o = new T.Group(), c = { g: o, j: {}, s, bk: 0, outfitIdx }, w = s.w || 1, j = c.j;
  const body = J(o, 0, 0);
  body.scale.setScalar(s.h || 1);

  const root = J(body, 0, 0.95);
  j.root = root;

  // Resolve outfit overrides
  const ov = (s.outfits && s.outfits[outfitIdx]) || {};
  const topCol = ov.top !== undefined ? ov.top : s.top;
  const sleeveCol = ov.sleeve !== undefined ? ov.sleeve : (s.sleeve || topCol);
  const pantsCol = ov.pants !== undefined ? ov.pants : s.pants;
  const skirtCol = ov.skirt !== undefined ? ov.skirt : s.skirt;
  const isShortPants = ov.shorts !== undefined ? ov.shorts : s.shorts;
  const isShortSleeve = ov.short !== undefined ? ov.short : s.short;

  // Pelvis & Belt / Waistband
  M(Cy(0.158 * w, 0.148 * w, 0.15), skirtCol || pantsCol, [0, -0.02, 0], root, [1, 1, 0.68], 0.85);

  // Legs, Cargo Pockets, Striped Socks, Bandages & Character-Specific Footwear
  [-1, 1].forEach(sd => {
    const isEthan = s.id === 'ethan';
    const hip = J(root, sd * (isEthan ? 0.092 : 0.096) * w, -0.04), kn = J(hip, 0, -0.44);
    const legW = s.long ? 0.72 : 1.0;

    if (isShortPants) {
      // Baggy cargo shorts with 3D side cargo pockets + exposed knee + crew socks
      const shTop = (isEthan ? 0.088 : 0.084) * w;
      const shBot = (isEthan ? 0.082 : 0.076) * w;
      M(Cy(shTop, shBot, 0.34), pantsCol, [0, -0.16, 0], hip, null, 0.95);
      // Dark inner hem shadow under baggy shorts
      M(Cy(shBot * 0.94, shBot * 0.94, 0.02, 16), 0x181520, [0, -0.325, 0], hip, null, 0);
      M(Bx(0.028, 0.125, 0.088), pantsCol, [sd * (shBot * 0.92), -0.17, 0.01], hip, null, 0.65);
      // Center seam crease on shorts
      const shinR = (isEthan ? 0.046 : 0.054) * w;
      M(Cy(shinR * 1.04, shinR * 0.96, 0.16), s.skin, [0, -0.37, 0], hip, null, 0.75);
      // Signature Knee Band-Aid for Ethan & Wren ("often injured" — Sheet 001 Turnaround)
      if (s.kneeBandage && sd > 0) {
        M(Bx(0.058 * w, 0.025, 0.022), 0xd8a882, [0, -0.405, shinR * 0.95], hip, null, 0.45);
        M(Bx(0.022 * w, 0.023, 0.024), 0xc48c68, [0, -0.405, shinR * 0.98], hip, null, 0);
      }
      M(Cy(shinR * 0.95, shinR * 0.84, 0.21), s.skin, [0, -0.10, 0], kn, null, 0.75);
      M(Cy(shinR * 0.98, shinR * 0.90, 0.23), s.sock || 0x1c1b22, [0, -0.30, 0], kn, null, 0.75);
      // Twin white athletic sock stripes
      M(Tr(shinR * 0.97, 0.005, PI * 2), 0xf8fafc, [0, -0.205, 0], kn, null, 0).rotation.x = PI / 2;
      M(Tr(shinR * 0.97, 0.005, PI * 2), 0xf8fafc, [0, -0.230, 0], kn, null, 0).rotation.x = PI / 2;
    } else if (s.id === 'sofi' && outfitIdx === 0) {
      // Sofi's gamer pleated skirt/shorts + striped thigh-high socks
      M(Cy(0.074 * w, 0.062 * w, 0.44), 0x1e2230, [0, -0.21, 0], hip, null, 0.9);
      M(Tr(0.068 * w, 0.006, PI * 2), 0xf472b6, [0, -0.32, 0], hip, null, 0).rotation.x = PI / 2;
      M(Cy(0.062 * w, 0.052 * w, 0.41), 0x1e2230, [0, -0.205, 0], kn, null, 0.9);
      M(Tr(0.058 * w, 0.006, PI * 2), 0x38bdf8, [0, -0.12, 0], kn, null, 0).rotation.x = PI / 2;
    } else {
      // Tailored trousers / cargo pants with ankle cuffs
      M(Cy(0.080 * w * legW, 0.068 * w * legW, 0.45), pantsCol, [0, -0.21, 0], hip, null, s.long ? 0 : 0.92);
      M(Cy(0.068 * w * legW, 0.056 * w * legW, 0.41), pantsCol, [0, -0.205, 0], kn, null, s.long ? 0 : 0.92);
      if (s.id === 'driver' || s.id === 'worker') {
        M(Bx(0.024, 0.13, 0.09), pantsCol, [sd * 0.074 * w, -0.20, 0.01], hip, null, 0.55);
      }
    }

    const foot = J(kn, 0, -0.42, 0.035);
    if (s.boot) {
      // Heavy lug-soled work boots (The Driver)
      M(Cy(0.060 * w, 0.064 * w, 0.12), s.shoe, [0, 0.048, -0.02], foot, null, 0.85);
      M(Bx(0.100 * w, 0.058, 0.20), s.shoe, [0, -0.005, 0.02], foot, null, 0.95);
      M(Bx(0.106 * w, 0.024, 0.21), 0x100f12, [0, -0.034, 0.02], foot, null, 0.5);
    } else if (isEthan) {
      // ETHAN'S TURNAROUND FOOTWEAR: Chunky 1.22x Retro Grey & White High-Top Skater Sneakers (Sheet 001)
      const sk = 1.20;
      // High-top padded ankle collar + tongue
      M(Cy(0.056 * w * sk, 0.060 * w * sk, 0.075, 16), 0xd8dde6, [0, 0.038, -0.012], foot, null, 0.85);
      M(Bx(0.064 * w * sk, 0.062, 0.024), 0xf8fafc, [0, 0.044, 0.032], foot, null, 0.5);
      // Sneaker body (light warm grey with charcoal side quarter panels)
      M(Bx(0.098 * w * sk, 0.056, 0.195 * sk), 0xd8dde6, [0, -0.002, 0.024], foot, null, 0.95);
      M(Bx(0.102 * w * sk, 0.034, 0.115 * sk), 0x2f323b, [0, 0.002, 0.010], foot, null, 0.45);
      // Chunky off-white rubber midsole + dark outsole tread + rounded white rubber toe cap
      M(Bx(0.106 * w * sk, 0.024, 0.208 * sk), 0xf5f2eb, [0, -0.030, 0.025], foot, null, 0.55);
      M(Sp(0.052 * w * sk), 0xf8fafc, [0, -0.006, 0.106], foot, [0.96, 0.56, 0.78], 0.4);
      // White laces across vamp
      M(Bx(0.072 * w * sk, 0.012, 0.058), 0xf8fafc, [0, 0.024, 0.042], foot, null, 0);
    } else if (s.sneaker) {
      // Chunky 2.5D Skater / Platform Sneakers with toe cap, sole & tongue tag
      const shoeCol = s.shoe || 0x1c1b20;
      const accentShoe = s.id === 'wren' ? 0xfef2f2 : (s.id === 'sofi' ? 0x9fd8cb : 0x38bdf8);
      M(Bx(0.100 * w, 0.056, 0.195), shoeCol, [0, -0.004, 0.02], foot, null, 0.95);
      M(Bx(0.106 * w, 0.022, 0.206), 0xf5f0e6, [0, -0.031, 0.022], foot, null, 0.45);
      M(Sp(0.050 * w), 0xf5f0e6, [0, -0.008, 0.095], foot, [0.95, 0.55, 0.75], 0);
      M(Bx(0.098 * w, 0.016, 0.068), accentShoe, [0, 0.018, -0.01], foot, null, 0);
    } else {
      // Loafer / Vintage Ankle Boot (Mother, Aunt Momma, Dr. Nakamura)
      M(Sp(0.060 * w), s.shoe, [0, -0.005, 0.015], foot, [0.94, 0.70, 1.78], 0.85);
      M(Bx(0.092 * w, 0.020, 0.18), 0x181312, [0, -0.030, 0.015], foot, null, 0);
    }

    j[sd < 0 ? 'lL' : 'lR'] = hip;
    j[sd < 0 ? 'kL' : 'kR'] = kn;
    j[sd < 0 ? 'fL' : 'fR'] = foot;
  });

  // Character-Specific Torso Silhouette & Tailored Upper Garments
  const to = J(root, 0, 0.02);
  j.torso = to;
  const isPuffy = (s.id === 'ethan' || s.id === 'sofi' || s.id === 'wren');
  const torsoTopR = (s.id === 'ethan' ? 0.210 : (isPuffy ? 0.204 : 0.192)) * w;
  const torsoBotR = (s.id === 'ethan' ? 0.184 : (isPuffy ? 0.172 : 0.156)) * w;
  M(Cy(torsoTopR, torsoBotR, 0.54, 24), topCol, [0, 0.28, 0], to, [1, 1, isPuffy ? 0.70 : 0.64], 1.0);
  // Ribbed hem band on hoodies/jackets
  if (isPuffy) {
    M(Cy(torsoBotR * 1.02, torsoBotR * 0.98, 0.065, 24), topCol, [0, 0.04, 0], to, [1, 1, 0.71], 0.7);
  }
  M(Cy(0.058, 0.052, 0.10), s.skin, [0, 0.52, 0.065], to, [1, 1, 0.5], 0);

  if (skirtCol) {
    const L = s.long ? 0.80 : 0.48;
    const skMat = (s.id === 'aunt' && outfitIdx === 0) ? new T.MeshToonMaterial({ map: TEX_AUNT, gradientMap: CS.gm }) : skirtCol;
    const sk = M(Cy(0.164 * w, (s.long ? 0.33 : 0.26) * w, L, 24), skMat, [0, -L / 2 + 0.02, 0], root, [1, 1, 0.76], 1.0);
    // Tiered bohemian skirt ruffle for Aunt Momma
    if (s.long) {
      M(Tr(0.28 * w, 0.022, PI * 2, 10, 28), skirtCol, [0, -L * 0.62, 0], root, [1, 0.75, 1], 0.6).rotation.x = PI / 2;
      M(Tr(0.32 * w, 0.024, PI * 2, 10, 28), 0xd87a56, [0, -L + 0.04, 0], root, [1, 0.75, 1], 0.6).rotation.x = PI / 2;
    }
    c.skirtMesh = sk;
  }

  // Shoulders, Custom Sleeves (Drop-Shoulder Boxy Tee / Bell / Puffy / Scrub / Coat), Forearms & Hands
  [-1, 1].forEach(sd => {
    const isEthan = s.id === 'ethan';
    const sh = J(to, sd * (isEthan ? 0.220 : 0.232) * w, 0.49), el = J(sh, 0, -0.29);
    const isBellSleeve = (s.id === 'aunt' && outfitIdx === 0);
    const isBoxyTee = isEthan && isShortSleeve;
    M(Sp((isBoxyTee ? 0.056 : 0.064) * w), sleeveCol, [0, -0.01, 0], sh, null, 0.75);
    M(Cy((isBoxyTee ? 0.055 : 0.056) * w, (isBellSleeve ? 0.082 : (isBoxyTee ? 0.082 : 0.050)) * w, 0.28), sleeveCol, [0, -0.14, 0], sh, null, 0.90);
    if (isShortSleeve) {
      M(Tr((isBoxyTee ? 0.082 : 0.052) * w, 0.012, PI * 2), sleeveCol, [0, -0.275, 0], sh, null, 0.50).rotation.x = PI / 2;
      if (isBoxyTee) {
        // Dark hollow inside Ethan's wide drop-shoulder short sleeve
        M(Cy(0.076 * w, 0.076 * w, 0.018, 14), 0x1a281c, [0, -0.275, 0], sh, null, 0);
      }
    }
    // Hospital Worker wears white thermal long sleeves under navy V-neck scrub short sleeves!
    const forearmCol = (s.id === 'aunt' && outfitIdx === 1)
      ? 0xfacc15
      : ((s.id === 'worker' && outfitIdx === 0) ? 0xf1f5f9 : (isShortSleeve ? s.skin : sleeveCol));
    const faTop = (isBellSleeve ? 0.078 : (isEthan && isShortSleeve ? 0.039 : 0.047)) * w;
    const faBot = (isBellSleeve ? 0.095 : (isEthan && isShortSleeve ? 0.033 : 0.039)) * w;
    M(Cy(faTop, faBot, 0.26), forearmCol, [0, -0.13, 0], el, null, 0.85);
    if (!isShortSleeve && !isBellSleeve) {
      M(Tr(0.040 * w, 0.010, PI * 2), forearmCol, [0, -0.25, 0], el, null, 0.4).rotation.x = PI / 2;
    }

    const hand = J(el, 0, -0.28, 0);
    const palmCol = (s.id === 'aunt' && outfitIdx === 1) ? 0xfacc15 : s.skin;
    M(Sp(0.042 * w), palmCol, [0, 0, 0], hand, [0.82, 1.18, 0.58], 0.6);
    M(Sp(0.016 * w), palmCol, [-sd * 0.028, 0.008, 0.022], hand, [0.8, 1.5, 0.8], 0);

    j[sd < 0 ? 'aL' : 'aR'] = sh;
    j[sd < 0 ? 'eL' : 'eR'] = el;
  });

  // Neck & Unified Sculpted Head with Live 768x768 Ink-and-Gouache Face CanvasTexture
  const g0 = CS.gm;
  CS.gm = grad([0.76, 0.92, 1.0], true);

  const nk = J(to, 0, 0.57);
  j.head = nk;
  const isEthanHead = s.id === 'ethan';
  M(Cy(isEthanHead ? 0.042 : 0.048, isEthanHead ? 0.048 : 0.055, 0.12), s.skin, [0, 0.03, -0.006], nk, null, 0.7);

  const hd = J(nk, 0, isEthanHead ? 0.165 : 0.17), F = s.F, [sx, sy, sz] = F.hs, N = F.nose;
  // Juvenile 10-year-old boy head-to-body ratio for Ethan (matches Sheet 001 Turnaround)
  hd.scale.setScalar(s.hdScale || (isEthanHead ? 1.13 : 1.0));
  c.faceSys = createFaceSystem();
  paintFace(c, {});

  const headGeo = createSculptedHeadGeo(F);
  const headMat = new T.MeshToonMaterial({ color: 0xffffff, map: c.faceSys.tex, gradientMap: CS.gm });
  M(headGeo, headMat, [0, 0, 0], hd, null, 1.0);

  NOL = 1;
  const noseGeo = createNoseGeo(N.w || 1, N.l || 1, isEthanHead);
  const noseMesh = M(noseGeo, s.nc || s.skin, [0, (isEthanHead ? -0.001 : -0.008) * sy, (isEthanHead ? 0.138 : 0.144) * sz], hd, null, 0);
  noseMesh.rotation.x = isEthanHead ? 0.03 : 0.12;
  const nM = new T.MeshLambertMaterial({ color: s.nc || s.skin }), nz = (isEthanHead ? 0.138 : 0.144) * sz;
  M(Sp((isEthanHead ? 0.010 : 0.0125) * (N.w || 1)), nM, [0, isEthanHead ? -0.022 : -0.031, nz + 0.011 * (N.l || 1)], hd, [1.1, 0.9, 1], 0);
  if (!isEthanHead) {
    [-1, 1].forEach(sd => M(Sp(0.0085 * (N.w || 1)), nM, [sd * 0.0125 * (N.w || 1), -0.03, nz + 0.003], hd, null, 0));
  }

  [-1, 1].forEach(sd => {
    const earX = (isEthanHead ? 0.144 : 0.136) * sx;
    const earY = isEthanHead ? -0.012 : -0.004;
    const ear = M(Sp(isEthanHead ? 0.035 : 0.032), s.skin, [sd * earX, earY, -0.006], hd, [0.46 * (F.ear || 1), 1.14 * (F.ear || 1), 0.80], isEthanHead ? 0.55 : 0);
    ear.rotation.y = -sd * (isEthanHead ? 0.14 : 0.25);
    if (isEthanHead) {
      // Warm terracotta inner ear concha shadow matching Sheet 001 turnaround
      M(Sp(0.018), 0xc27b60, [sd * (earX + 0.005), earY, 0.006], hd, [0.35, 0.85, 0.55], 0).rotation.y = -sd * 0.14;
    }
  });

  j.bL = J(hd, 0, 0, 0); j.bR = J(hd, 0, 0, 0); j.mouth = J(hd, 0, 0, 0);
  c.op = J(hd, 0, 0, 0); c.lids = []; c.by = 0; c.my = 0;

  CS.gm = g0;
  NOL = 0;
  FX[F.hair](hd, s, F.hs, outfitIdx);

  c.hd = hd;
  c.to = to;
  if (s.acc) s.acc(c, outfitIdx);
  CS = null;
  return c;
}

// ============================================================================
// 7. CHARACTER-SPECIFIC OUTFIT DETAILS & PROPS (FROM 19 CONCEPT SHEETS)
// ============================================================================
const accEthan = (c, outfitIdx) => {
  const to = c.to, j = c.j;
  // Sculpted 3D Hoodie Neck Ring + Draped Back Hood + White Drawstrings (Sheet 001)
  const hoodCol = outfitIdx === 1 ? 0x6b5b45 : (outfitIdx === 3 ? 0x60a5fa : 0x3f6844);
  M(Tr(0.112, 0.032, PI * 1.55, 10, 22), hoodCol, [0, 0.53, -0.01], to, [1.05, 0.85, 1.0], 0.8).rotation.x = PI * 0.46;
  M(Sp(0.145), hoodCol, [0, 0.48, -0.125], to, [1.22, 0.78, 0.90], 0.8);
  // White Hoodie Drawstrings with metal aglets
  [-1, 1].forEach(sd => {
    M(Cy(0.005, 0.005, 0.16, 6), 0xf8fafc, [sd * 0.042, 0.42, 0.126], to, null, 0);
    M(Cy(0.006, 0.006, 0.022, 6), 0x94a3b8, [sd * 0.042, 0.335, 0.126], to, null, 0);
  });
  // Front Kangaroo Hoodie Pocket
  if (outfitIdx !== 3) {
    M(Bx(0.21, 0.14, 0.032), hoodCol, [0, 0.14, 0.118], to, null, 0.65);
  }
  // Glowing Cyan Blue Fox Emblem on Chest (Head + Pointed Ears + Twin Tails)
  M(Sp(0.054), 0x38bdf8, [0, 0.35, 0.124], to, [1.05, 0.92, 0.26], 0);
  M(Sp(0.028), 0xe0f2fe, [0, 0.335, 0.134], to, [0.9, 0.7, 0.2], 0);
  [-1, 1].forEach(sd => M(Cn(0.024, 0.048, 4), 0x38bdf8, [sd * 0.034, 0.405, 0.126], to, null, 0));
  // Outfit B: Open Tan Travel Jacket lapels + Messenger Bag Strap
  if (outfitIdx === 1) {
    [-1, 1].forEach(sd => M(Bx(0.082, 0.50, 0.032), 0x594a38, [sd * 0.115, 0.28, 0.118], to, null, 0.75));
  }
  // Tummy side gauze bandage (when he fell on purpose / stabbed Dragon Princeps)
  if (outfitIdx === 3 || APP_STATE._data.chapter >= 1) {
    M(Bx(0.095, 0.062, 0.034), 0xfef3c7, [0.135, 0.15, 0.082], to, null, 0.5);
  }
  // Handheld Console in left hand + Knight Shield on left forearm & Scissor-Pencil Level-1000 Sword in right hand
  c.propConsole = buildHandheldConsole(j.eL, [0.04, -0.27, 0.08], [-0.4, 0, 0]);
  // Ethan's Knight Shield with Blue Fox Crest ("I then use my shield")
  const shd = J(j.eL, -0.05, -0.18, 0.06);
  M(Cy(0.145, 0.145, 0.022, 18), 0x1e293b, [0, 0, 0], shd, [0.88, 1, 1.12], 0.85).rotation.z = PI / 2;
  M(Tr(0.138, 0.014, PI * 2, 8, 20), 0xfbbf24, [-0.012, 0, 0], shd, [1.12, 0.88, 1], 0.5).rotation.y = PI / 2;
  M(Sp(0.046), 0x38bdf8, [-0.018, 0, 0], shd, [0.3, 0.95, 0.95], 0);
  shd.visible = false;
  c.propShield = shd;

  const sw = J(j.eR, 0, -0.28, 0.04);
  M(Cy(0.009, 0.009, 0.25, 8), 0xfacc15, [0, 0.10, 0], sw, null, 0.55); // Yellow pencil shaft
  M(Bx(0.058, 0.018, 0.018), 0xef4444, [0, 0.19, 0], sw, null, 0.5);   // Taped crossguard
  M(Cn(0.022, 0.26, 4), 0xe2e8f0, [0, 0.32, 0], sw, [0.42, 1, 1], 0.75); // Broken silver scissor blade
  // Glowing Cyan-Gold Level-1000 Magic Sword Aura ("my sword had magic level 1000")
  const aura = M(Cn(0.036, 0.38, 6), 0x38bdf8, [0, 0.36, 0], sw, [0.38, 1, 1], 0);
  aura.material = new T.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.48 });
  aura.visible = false;
  sw.rotation.x = PI / 2;
  c.propSword = sw;
  c.propSwordAura = aura;
};

const accSofi = (c, outfitIdx) => {
  const to = c.to, j = c.j;
  // Pleated Gamer Mini-Skirt under Pastel Windbreaker (Sheet 006)
  if (outfitIdx === 0) {
    M(Cy(0.165, 0.235, 0.24, 20), 0x2d3142, [0, -0.08, 0], c.j.root, [1, 1, 0.76], 0.85);
    const pMat = new T.MeshToonMaterial({ map: TEX_SOFI, gradientMap: CS.gm });
    // Puffy Pastel Color-Blocked Open Jacket Panels + Popped Collar
    [-1, 1].forEach(sd => M(Bx(0.094, 0.52, 0.036), pMat, [sd * 0.112, 0.28, 0.116], to, null, 0.8));
    M(Tr(0.105, 0.026, PI * 1.35, 10, 20), 0x9fd8cb, [0, 0.53, -0.01], to, null, 0.7).rotation.x = PI * 0.45;
    // Collectible Purple Dragon, Green Wolf & Blue Fox Enamel Pins on Jacket Lapel
    M(Sp(0.020), 0xa855f7, [-0.112, 0.42, 0.138], to, null, 0);
    M(Sp(0.020), 0x22c55e, [-0.112, 0.365, 0.138], to, null, 0);
    M(Sp(0.020), 0x38bdf8, [-0.112, 0.31, 0.138], to, null, 0);
  }
  buildHandheldConsole(j.eR, [-0.03, -0.27, 0.07], [-0.35, 0, 0]);
};

const accWren = (c, outfitIdx) => {
  const to = c.to, j = c.j;
  // Bold Superhero Star/Kitsune Shield Crest on Chest + Unzipped Charcoal Hoodie Vest + Flowing Superhero Cape (Sheet 005)
  M(Sp(0.062), 0xfef08a, [0, 0.35, 0.124], to, [1.08, 0.95, 0.25], 0);
  M(Sp(0.042), 0xdc2626, [0, 0.35, 0.132], to, [1.0, 0.9, 0.25], 0);
  [-1, 1].forEach(sd => {
    M(Cn(0.026, 0.052, 4), 0xfef2f2, [sd * 0.038, 0.405, 0.128], to, null, 0);
    // Open zip charcoal vest/hoodie panels with silver zipper track
    M(Bx(0.074, 0.52, 0.032), 0x1e1d24, [sd * 0.118, 0.28, 0.116], to, null, 0.8);
    M(Bx(0.010, 0.50, 0.035), 0xcbd5e1, [sd * 0.082, 0.28, 0.118], to, null, 0);
  });
  M(Sp(0.135), 0x1e1d24, [0, 0.49, -0.12], to, [1.15, 0.72, 0.85], 0.75);
  // Makeshift Crimson Superhero Cape draped from shoulders ("I'm not a kid, I'm a superhero!")
  if (outfitIdx === 0) {
    const cape = M(Cy(0.14, 0.28, 0.68, 16), 0xb91c1c, [0, 0.16, -0.145], to, [1.15, 1, 0.18], 0.85);
    cape.rotation.x = 0.16;
  }
  // Wooden School Ruler held like a sword ("pointed a ruler at me")
  const rul = M(Bx(0.032, 0.42, 0.009), 0xfbbf24, [0, -0.28, 0.12], j.eR, null, 0.7);
  rul.rotation.x = PI * 0.42;
};

const accAunt = (c, outfitIdx) => {
  const to = c.to, j = c.j;
  // Layered Beaded Gold Necklace around collarbone (Sheet 004)
  M(Tr(0.078, 0.009, PI * 1.3, 8, 20), 0xeab308, [0, 0.49, 0.055], to, null, 0.4).rotation.x = PI * 0.42;
  if (outfitIdx === 0) {
    // Draped Dark Botanical Floral Kimono Cardigan + Wide Cinched Leather Waist Belt & Brass Buckle
    const kMat = new T.MeshToonMaterial({ map: TEX_AUNT, gradientMap: CS.gm });
    M(Cy(0.222, 0.248, 0.54, 24), kMat, [0, 0.27, -0.01], to, [1.06, 1, 0.70], 0.9);
    [-1, 1].forEach(sd => M(Bx(0.055, 0.54, 0.032), 0xd87a56, [sd * 0.095, 0.27, 0.122], to, null, 0.6));
    rg(c.j.root, 0.168, 0.028, 0x7c2d12, 0.05);
    M(Bx(0.052, 0.048, 0.025), 0xfbbf24, [0, 0.05, 0.132], c.j.root, null, 0.5);
  } else if (outfitIdx === 1) {
    // Stinky House Apron with Front Pocket + Steaming Soup Pot Lid in hand
    M(Bx(0.25, 0.58, 0.028), 0xd97706, [0, 0.16, 0.124], to, null, 0.8);
    M(Bx(0.16, 0.14, 0.032), 0xb45309, [0, 0.08, 0.130], to, null, 0.5);
    M(Cy(0.145, 0.145, 0.020, 20), 0x94a3b8, [0, -0.28, 0.08], j.eL, null, 0.75).rotation.x = PI / 2;
  } else if (outfitIdx === 2) {
    // Monster Costume Tail (the dragon tail Ethan saw under the bathroom door!)
    addLock(c.j.root, [[0, -0.05, -0.12], [0, -0.22, -0.35], [0.12, -0.30, -0.58], [0, -0.18, -0.78]], 0.058, 0.044, 0.014, 0x16a34a);
  }
};

const accDriver = (c, outfitIdx) => {
  const to = c.to, j = c.j;
  // Weathered Buffalo-Plaid Flannel Shirt + Plush Cream Shearling Fleece Collar & Heavy Work Jacket (Sheet 003)
  const pMat = new T.MeshToonMaterial({ map: TEX_PLAID, gradientMap: CS.gm });
  M(Bx(0.15, 0.50, 0.026), pMat, [0, 0.29, 0.120], to, null, 0);
  // Thick Cream Shearling Collar & Lapel Trim
  M(Tr(0.122, 0.042, PI * 1.45, 12, 24), 0xe7dec8, [0, 0.54, -0.01], to, [1.05, 0.90, 1.05], 0.85).rotation.x = PI * 0.45;
  [-1, 1].forEach(sd => {
    const jCol = outfitIdx === 1 ? 0x5c4028 : 0x26292e;
    M(Bx(0.092, 0.52, 0.034), jCol, [sd * 0.122, 0.28, 0.118], to, null, 0.85);
    M(Bx(0.032, 0.22, 0.038), 0xe7dec8, [sd * 0.082, 0.40, 0.122], to, null, 0.5);
    // Work jacket chest pocket flap
    M(Bx(0.062, 0.028, 0.038), jCol, [sd * 0.125, 0.36, 0.126], to, null, 0.4);
  });
  // Takeaway Coffee Cup with dark lid in right hand
  M(Cy(0.035, 0.027, 0.098, 14), 0xf8fafc, [0, -0.28, 0.05], j.eR, null, 0.65);
  M(Cy(0.036, 0.032, 0.038, 14), 0xb45309, [0, -0.28, 0.05], j.eR, null, 0);
  M(Cy(0.038, 0.038, 0.016, 14), 0x1e293b, [0, -0.228, 0.05], j.eR, null, 0.4);
};

const accMother = (c) => {
  const to = c.to;
  // Ribbed Turtleneck Collar + Warm Botanical Knit Cardigan with Wooden Buttons + Leather Crossbody Bag (Sheet 002)
  M(Cy(0.068, 0.074, 0.08, 18), 0x242834, [0, 0.54, 0.02], to, null, 0.65);
  const mMat = new T.MeshToonMaterial({ map: TEX_MOM, gradientMap: CS.gm });
  [-1, 1].forEach(sd => {
    M(Bx(0.092, 0.54, 0.032), mMat, [sd * 0.112, 0.26, 0.116], to, null, 0.8);
    if (sd > 0) {
      [0.14, 0.24, 0.34].forEach(by => M(Sp(0.012), 0x78350f, [0.072, by, 0.134], to, null, 0));
    }
  });
  const st = M(Bx(0.028, 0.72, 0.024), 0x5c3a24, [0.05, 0.20, 0.128], to, null, 0.5);
  st.rotation.z = 0.48;
  // Leather Crossbody Handbag with brass clasp at hip
  M(Bx(0.065, 0.15, 0.18), 0x6b4226, [-0.175, -0.04, 0.04], c.j.root, null, 0.8);
  M(Sp(0.016), 0xfbbf24, [-0.195, -0.02, 0.04], c.j.root, null, 0);
};

const accWorker = (c) => {
  const to = c.to, j = c.j;
  // White Thermal Undershirt Crewneck under Navy V-Neck Scrubs + Sky-Blue Lanyard & ID Badge + Pens in Pocket (Sheets 013/014)
  M(Cy(0.072, 0.085, 0.09, 18), 0xf8fafc, [0, 0.50, 0.06], to, [1, 1, 0.65], 0);
  M(Tr(0.078, 0.009, PI * 2), 0x38bdf8, [0, 0.48, 0.062], to, [0.85, 1.32, 1], 0).rotation.x = PI * 0.35;
  M(Bx(0.052, 0.068, 0.016), 0xf8fafc, [0, 0.33, 0.130], to, null, 0.45);
  M(Bx(0.040, 0.018, 0.018), 0x0284c7, [0, 0.35, 0.132], to, null, 0);
  // Scrub breast pocket with pens
  M(Bx(0.062, 0.072, 0.018), 0x1e324e, [-0.095, 0.36, 0.122], to, null, 0.5);
  M(Cy(0.004, 0.004, 0.04, 6), 0xef4444, [-0.085, 0.40, 0.126], to, null, 0);
  M(Cy(0.004, 0.004, 0.04, 6), 0x38bdf8, [-0.102, 0.40, 0.126], to, null, 0);
  buildHandheldConsole(j.eR, [0, -0.28, 0.06], [-0.3, 0, 0]);
  // Coffee cup with orange cat sleeve
  M(Cy(0.033, 0.026, 0.092, 14), 0xfef3c7, [0, -0.28, 0.05], j.eL, null, 0.65);
  M(Cy(0.035, 0.030, 0.040, 14), 0xf97316, [0, -0.28, 0.05], j.eL, null, 0.4);
};

const accDoctor = (c, outfitIdx) => {
  const to = c.to, j = c.j;
  if (outfitIdx !== 1) {
    // Full Tailored Knee-Length White Doctor's Lab Coat with Notched Lapels, Buttons, Coat Skirt & Hospital ID (Sheet 012)
    M(Cy(0.172, 0.215, 0.42, 22), 0xf4f6f8, [0, -0.15, -0.01], c.j.root, [1.02, 1, 0.72], 0.85);
    [-1, 1].forEach(sd => {
      M(Bx(0.096, 0.68, 0.034), 0xf4f6f8, [sd * 0.114, 0.18, 0.116], to, null, 0.85);
      // Notched coat lapel
      const lap = M(Bx(0.048, 0.22, 0.038), 0xe2e8f0, [sd * 0.068, 0.41, 0.122], to, null, 0.6);
      lap.rotation.z = -sd * 0.22;
    });
    M(Bx(0.050, 0.062, 0.016), 0x38bdf8, [-0.114, 0.40, 0.136], to, null, 0.4);
  }
  // Medical Stethoscope with silver chestpiece
  M(Tr(0.090, 0.010, PI * 1.45), 0x1e293b, [0, 0.49, 0.042], to, null, 0.55).rotation.x = PI * 0.42;
  M(Cy(0.018, 0.018, 0.010, 12), 0xcbd5e1, [0.065, 0.34, 0.132], to, null, 0.4).rotation.x = PI / 2;
  // Section 152 Child Protection Medical/Legal Clipboard
  M(Bx(0.165, 0.23, 0.015), 0x92400e, [0, -0.26, 0.08], j.eL, null, 0.75);
  M(Bx(0.145, 0.20, 0.017), 0xf8fafc, [0, -0.26, 0.085], j.eL, null, 0);
};

// ============================================================================
// 8. FULL 3D ARTICULATED CREATURE BUILDER (NOT 2D CUTOUTS!)
// ============================================================================
function buildCreature(s) {
  const a = s.art;
  CS = { gm: grad(a.g, a.soft), w: a.w, oc: new T.Color(a.ol) };
  const o = new T.Group(), c = { g: o, j: {}, s, bk: 0, isCreature: true }, j = c.j;
  const body = J(o, 0, 0);
  body.scale.setScalar(s.h || 1);

  const root = J(body, 0, s.rootY || 0.72);
  const to = J(root, 0, 0);
  const hd = J(to, 0, 0.25, 0.35);
  j.root = root; j.torso = to; j.head = hd;
  j.aL = J(to, -0.22, 0.12, 0.15); j.aR = J(to, 0.22, 0.12, 0.15);
  j.eL = J(j.aL, 0, -0.22, 0);     j.eR = J(j.aR, 0, -0.22, 0);
  j.lL = J(root, -0.18, -0.1, -0.2); j.lR = J(root, 0.18, -0.1, -0.2);
  j.kL = J(j.lL, 0, -0.25, 0);       j.kR = J(j.lR, 0, -0.25, 0);

  if (s.id === 'fox' || s.id === 'wolf') {
    const isFox = s.id === 'fox';
    const mainCol = isFox ? 0x162238 : 0x2b7a4b;
    const glowCol = isFox ? 0x38bdf8 : 0x86efac;
    const ruffCol = isFox ? 0xf0f6ff : 0xecfdf5;

    // Sleek quadruped torso & chest ruff
    const torsoMesh = M(Cy(0.16, 0.19, 0.68, 20), mainCol, [0, 0, 0], to, [0.95, 1, 1], 1.0);
    torsoMesh.rotation.x = PI / 2;
    M(Sp(0.21, 18, 16), ruffCol, [0, 0.04, 0.28], to, [1.05, 1.1, 0.95], 0.9);

    // Sculpted Canine Head, Muzzle, Glowing Eyes & Pointed Ears
    hd.position.set(0, 0.26, 0.38);
    M(Sp(0.155, 22, 18), mainCol, [0, 0, 0], hd, [1.02, 0.95, 1.12], 1.0);
    const muz = M(Cn(0.095, 0.22, 16), ruffCol, [0, -0.035, 0.18], hd, [1.0, 0.78, 1], 0.85);
    muz.rotation.x = PI / 2;
    M(Sp(0.024), 0x0f172a, [0, -0.015, 0.29], hd, null, 0); // Nose tip

    [-1, 1].forEach(sd => {
      // Glowing eyes & brow markings
      M(Sp(0.028), glowCol, [sd * 0.068, 0.025, 0.125], hd, [1.1, 0.75, 0.5], 0);
      M(Sp(0.016), 0xffffff, [sd * 0.068, 0.03, 0.138], hd, null, 0);
      // Tall pointed Fox/Wolf ears
      const ear = M(Cn(0.058, 0.21, 12), mainCol, [sd * 0.095, 0.17, -0.02], hd, [0.8, 1, 0.5], 0.9);
      ear.rotation.z = -sd * 0.24;
      M(Cn(0.036, 0.15, 10), glowCol, [sd * 0.095, 0.16, 0.0], hd, [0.7, 1, 0.3], 0).rotation.z = -sd * 0.24;
    });

    // 4 Articulated Legs & Paws
    j.aL.position.set(-0.13, -0.08, 0.22); j.aR.position.set(0.13, -0.08, 0.22);
    j.lL.position.set(-0.14, -0.08, -0.24); j.lR.position.set(0.14, -0.08, -0.24);
    [[j.aL, j.eL], [j.aR, j.eR], [j.lL, j.kL], [j.lR, j.kR]].forEach(([up, lo]) => {
      M(Cy(0.055, 0.042, 0.28, 14), mainCol, [0, -0.14, 0], up, null, 0.85);
      lo.position.set(0, -0.28, 0);
      M(Cy(0.042, 0.034, 0.26, 14), glowCol, [0, -0.13, 0], lo, null, 0.85);
      M(Sp(0.046), ruffCol, [0, -0.26, 0.02], lo, [0.9, 0.65, 1.3], 0.7);
    });

    // Swirling Multi-Plume Magical Tail (56d008a5 & eddd5065)
    const tailGrp = J(to, 0, 0.08, -0.32);
    c.tailGrp = tailGrp;
    const plumes = isFox
      ? [
          [[0, 0, 0], [0, 0.18, -0.28], [0.08, 0.42, -0.48], [0, 0.62, -0.62]],
          [[0, 0, 0], [-0.12, 0.14, -0.26], [-0.16, 0.36, -0.45], [-0.06, 0.56, -0.58]],
          [[0, 0, 0], [0.12, 0.14, -0.26], [0.16, 0.36, -0.45], [0.06, 0.56, -0.58]]
        ]
      : [
          [[0, 0, 0], [0, 0.12, -0.26], [0, 0.28, -0.48], [0, 0.38, -0.64]],
          [[0, 0, 0], [-0.08, 0.10, -0.24], [-0.10, 0.24, -0.44], [-0.04, 0.34, -0.58]]
        ];
    plumes.forEach((pts, idx) => {
      addLock(tailGrp, pts, 0.065, 0.115, 0.018, idx === 0 ? glowCol : (idx === 1 ? mainCol : ruffCol), 0.95);
    });
  } else if (s.id === 'princeps' || s.id === 'dragon') {
    const isP = s.id === 'princeps';
    const scaleCol = isP ? 0x13161f : 0x7e3af2;
    const veinCol = isP ? 0x22c55e : 0xf472b6;
    const accentCol = isP ? 0x38bdf8 : 0x60a5fa;

    root.position.y = isP ? 1.08 : 0.95;
    // Powerful Draconic Torso & Segmented Chest Plates
    M(Cy(0.22, 0.26, 0.72, 20), scaleCol, [0, 0.12, 0], to, [1.0, 1.0, 0.85], 1.0);
    for (let i = 0; i < 5; i++) {
      M(Bx(0.22, 0.085, 0.04), veinCol, [0, -0.10 + i * 0.11, 0.19], to, null, 0.5);
      // Dorsal spikes along spine
      M(Cn(0.035, 0.14, 6), veinCol, [0, -0.10 + i * 0.12, -0.22], to, null, 0.7).rotation.x = -PI * 0.42;
    }

    // Elongated Neck & Sculpted Horned Draconic Head
    hd.position.set(0, 0.62, 0.18);
    M(Cy(0.11, 0.15, 0.34, 16), scaleCol, [0, -0.14, -0.06], hd, null, 0.9).rotation.x = 0.35;
    M(Sp(0.16, 22, 18), scaleCol, [0, 0.05, 0.02], hd, [0.98, 0.92, 1.18], 1.0);

    // Lowered Predatory Snout, Nostrils, Fangs & Articulated Roaring Jaw (clear of the eyes!)
    M(Cn(0.105, 0.25, 14), scaleCol, [0, -0.042, 0.21], hd, [0.96, 0.58, 1], 0.9).rotation.x = PI / 2;
    [-1, 1].forEach(sd => {
      M(Sp(0.014), 0x090d16, [sd * 0.032, -0.020, 0.29], hd, null, 0); // Nostrils
      M(Cn(0.014, 0.048, 6), 0xf8fafc, [sd * 0.048, -0.072, 0.22], hd, null, 0.4).rotation.x = PI; // Upper fangs
    });
    const jaw = J(hd, 0, -0.075, 0.09);
    c.jaw = jaw;
    M(Cn(0.088, 0.22, 12), veinCol, [0, -0.025, 0.11], jaw, [0.88, 0.42, 1], 0.85).rotation.x = PI * 0.56;
    // Glowing Dragon Breath Core tucked deep inside open mouth
    c.breathOrb = M(Sp(0.038), isP ? 0xf43f5e : 0x38bdf8, [0, -0.055, 0.15], hd, null, 0);

    if (isP) {
      // DRAGON PRINCEPS: Iconic Single Abyssal Cyclops Eye on Forehead + Armored Brow Ridge
      M(Tr(0.068, 0.016, PI, 8, 18), 0x22c55e, [0, 0.095, 0.165], hd, null, 0.6).rotation.z = -0.08;
      M(Sp(0.058, 18, 16), 0xf43f5e, [0, 0.085, 0.172], hd, [1.05, 0.98, 0.55], 0.65); // Crimson sclera
      M(Sp(0.036, 16, 14), 0x4ade80, [0, 0.085, 0.194], hd, [1.0, 0.95, 0.35], 0);     // Neon-green iris
      M(Sp(0.018, 12, 12), 0x090d16, [0, 0.085, 0.205], hd, [0.42, 1.35, 0.30], 0);    // Vertical slit pupil
      M(Sp(0.010), 0xffffff, [0.016, 0.102, 0.208], hd, null, 0);                      // Catchlight
    } else {
      // SOFI'S PURPLE DRAGON: Two Distinct Expressive Eyes — Right Gleaming Eye + Left Black Dragon Eye-Patch!
      // Diagonal Black Eye-Patch Strap wrapping across the head
      const strap = M(Tr(0.162, 0.013, PI * 2, 8, 28), 0x110c18, [0, 0.065, 0.02], hd, [0.99, 0.94, 1.18], 0.5);
      strap.rotation.set(0.35, 0.22, -0.52);
      // Left Eye (sd = -1): Black Leather Dragon Eye-Patch with Glowing Pink Battle X-Scar
      M(Sp(0.048, 16, 14), 0x110c18, [-0.078, 0.068, 0.166], hd, [1.15, 0.95, 0.48], 0.7);
      [-1, 1].forEach(d => {
        const scar = M(Bx(0.046, 0.009, 0.010), 0xf472b6, [-0.080, 0.068, 0.188], hd, null, 0);
        scar.rotation.z = d * 0.68;
      });
      // Right Eye (sd = +1): Wide Expressive Golden-Amber & Violet Dragon Eye with Brow Crest
      M(Sp(0.044, 16, 14), 0xfef08a, [0.078, 0.068, 0.166], hd, [1.10, 0.95, 0.48], 0.55);
      M(Sp(0.028, 14, 12), 0xa855f7, [0.080, 0.068, 0.184], hd, [0.95, 0.95, 0.35], 0);
      M(Sp(0.015, 12, 10), 0x110c18, [0.082, 0.068, 0.193], hd, [0.48, 1.25, 0.30], 0);
      M(Sp(0.009), 0xffffff, [0.090, 0.080, 0.196], hd, null, 0);
      // Expressive fierce eyebrow ridge over right eye
      const brow = M(Bx(0.068, 0.016, 0.022), 0xf472b6, [0.078, 0.106, 0.168], hd, null, 0.5);
      brow.rotation.z = 0.28;
    }

    [-1, 1].forEach(sd => {
      // Swept-back draconic horns + frill spikes
      addLock(hd, [[sd * 0.085, 0.13, -0.01], [sd * 0.155, 0.25, -0.14], [sd * 0.21, 0.38, -0.32]], 0.044, 0.028, 0.005, veinCol);
      addLock(hd, [[sd * 0.12, 0.05, -0.04], [sd * 0.19, 0.09, -0.15], [sd * 0.24, 0.14, -0.26]], 0.026, 0.018, 0.004, accentCol);
    });

    // Sculpted Scalloped Draconic Wing Membranes (Custom Extruded Bat/Dragon Wing Shapes, NOT flat boxes!)
    const makeWingGeo = (sd, span, drop) => {
      const sh = new T.Shape();
      sh.moveTo(0, 0);
      sh.quadraticCurveTo(sd * span * 0.45, 0.15, sd * span, 0.06);
      sh.quadraticCurveTo(sd * span * 0.82, -drop * 0.45, sd * span * 0.68, -drop * 0.92);
      sh.quadraticCurveTo(sd * span * 0.45, -drop * 0.55, sd * span * 0.32, -drop);
      sh.quadraticCurveTo(sd * span * 0.15, -drop * 0.58, 0, -drop * 0.72);
      sh.closePath();
      return new T.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: false, curveSegments: 10 });
    };

    j.aL.position.set(-0.22, 0.34, -0.08); j.aR.position.set(0.22, 0.34, -0.08);
    [-1, 1].forEach(sd => {
      const wUp = sd < 0 ? j.aL : j.aR;
      const wLo = sd < 0 ? j.eL : j.eR;
      wLo.position.set(sd * 0.38, 0.18, 0);
      // Wing bone struts & claw thumb
      addLock(wUp, [[0, 0, 0], [sd * 0.20, 0.14, -0.01], [sd * 0.40, 0.19, -0.02]], 0.036, 0.028, 0.018, scaleCol);
      addLock(wLo, [[0, 0, 0], [sd * 0.26, 0.08, -0.02], [sd * 0.52, -0.06, -0.03]], 0.026, 0.020, 0.006, scaleCol);
      addLock(wLo, [[0, 0, 0], [sd * 0.18, -0.14, -0.02], [sd * 0.34, -0.32, -0.03]], 0.018, 0.012, 0.004, veinCol);
      M(Cn(0.018, 0.07, 6), veinCol, [0, 0.05, 0], wLo, null, 0.5).rotation.z = -sd * 0.4;
      // Scalloped inner & outer wing membranes
      M(makeWingGeo(sd, 0.42, 0.36), veinCol, [0, 0.12, -0.03], wUp, null, 0.75);
      M(makeWingGeo(sd, 0.52, 0.38), accentCol, [0, 0.04, -0.035], wLo, null, 0.75);
    });

    // Clawed Hind Legs & Long Whip-Tail ("saw a tail under the door hole")
    j.lL.position.set(-0.18, -0.22, 0); j.lR.position.set(0.18, -0.22, 0);
    [[j.lL, j.kL], [j.lR, j.kR]].forEach(([hip, kn]) => {
      M(Cy(0.085, 0.065, 0.36, 14), scaleCol, [0, -0.18, 0], hip, null, 0.9);
      kn.position.set(0, -0.36, 0);
      M(Cy(0.065, 0.048, 0.32, 14), scaleCol, [0, -0.16, 0], kn, null, 0.9);
      M(Bx(0.12, 0.05, 0.20), veinCol, [0, -0.32, 0.04], kn, null, 0.7);
    });

    const tailGrp = J(root, 0, -0.16, -0.18);
    c.tailGrp = tailGrp;
    addLock(tailGrp, [[0, 0, 0], [0, -0.18, -0.36], [0.14, -0.24, -0.72], [-0.10, -0.12, -1.05], [0, 0.08, -1.28]], 0.095, 0.058, 0.012, scaleCol);
    M(Cn(0.065, 0.16, 4), veinCol, [0, 0.08, -1.32], tailGrp, null, 0.7).rotation.x = -PI / 2;
  } else if (s.id === 'bird') {
    // The Weak Bird / "Worriblin" (923efed9 — Golden-brown spiky-crested runner bird with loose feather)
    const bodyCol = 0xc88a36, wingCol = 0x7c4d25, beakCol = 0xf59e0b;
    root.position.y = 0.58;
    M(Sp(0.20, 20, 16), bodyCol, [0, 0, 0], to, [0.92, 0.95, 1.25], 1.0);
    // Signature single loose feather protruding from back!
    addLock(to, [[0.02, 0.16, -0.05], [0.06, 0.28, -0.14], [0.10, 0.35, -0.24]], 0.008, 0.024, 0.004, 0xfbbf24);

    // Head, Spiky Crest, Wide Worried Eyes & Curved Beak
    hd.position.set(0, 0.26, 0.18);
    M(Sp(0.135, 18, 16), bodyCol, [0, 0, 0], hd, null, 1.0);
    M(Cn(0.055, 0.16, 12), beakCol, [0, -0.01, 0.17], hd, [0.85, 0.7, 1], 0.85).rotation.x = PI * 0.54;
    // Spiky golden crest feathers
    [-0.04, 0, 0.04].forEach((dx, idx) => {
      addLock(hd, [[dx, 0.11, 0], [dx * 1.4, 0.22 + (idx === 1 ? 0.04 : 0), -0.06], [dx * 1.8, 0.27, -0.14]], 0.018, 0.028, 0.004, idx === 1 ? beakCol : wingCol);
    });
    [-1, 1].forEach(sd => {
      M(Sp(0.036), 0xffffff, [sd * 0.078, 0.025, 0.095], hd, null, 0.4);
      M(Sp(0.018), 0x111827, [sd * 0.082, 0.025, 0.122], hd, null, 0);
    });

    // Fluttering Wings & Runner Legs
    j.aL.position.set(-0.18, 0.05, 0); j.aR.position.set(0.18, 0.05, 0);
    [-1, 1].forEach(sd => {
      const wg = sd < 0 ? j.aL : j.aR;
      M(Sp(0.14), wingCol, [sd * 0.05, -0.04, -0.04], wg, [0.35, 0.85, 1.35], 0.85);
    });
    j.lL.position.set(-0.08, -0.14, 0); j.lR.position.set(0.08, -0.14, 0);
    [[j.lL, j.kL], [j.lR, j.kR]].forEach(([hip, kn]) => {
      M(Cy(0.024, 0.020, 0.22, 10), beakCol, [0, -0.11, 0], hip, null, 0.7);
      kn.position.set(0, -0.22, 0);
      M(Cy(0.018, 0.016, 0.20, 10), beakCol, [0, -0.10, 0], kn, null, 0.7);
      M(Bx(0.07, 0.02, 0.12), beakCol, [0, -0.20, 0.03], kn, null, 0.6);
    });
  }

  CS = null;
  return c;
}

function build(s, outfitIdx = 0) {
  return s.isCreature ? buildCreature(s) : buildHuman(s, outfitIdx);
}

// ============================================================================
// 9. BIOMECHANICAL GAIT ENGINE & ALL 13 CHARACTER / CREATURE DEFINITIONS
// ============================================================================
// Multi-Harmonic 4-Phase Biomechanical Gait Cycle (Contact -> Recoil -> Passing -> High-Point)
const walk = o => (c, t) => {
  const j = c.j, p = t * o.sp;
  const s1 = S(p), c1 = C(p), s2 = S(2 * p - 0.38), c2 = C(2 * p - 0.38);

  // Asymmetric hip flexion/extension: brisk forward swing + extended stance push-off
  const hipL = s1 + 0.18 * S(2 * p - 0.45);
  const hipR = -s1 + 0.18 * S(2 * (p + PI) - 0.45);
  j.lL.rotation.x = hipL * o.sw + (o.hipBias || 0);
  j.lR.rotation.x = hipR * o.sw + (o.hipBias || 0);

  // Stride stance width & subtle hip abduction during swing clearance
  const stanceZ = o.stance || 0.025;
  j.lL.rotation.z = -stanceZ - Math.max(0, -c1) * 0.035;
  j.lR.rotation.z = stanceZ + Math.max(0, c1) * 0.035;

  // Dual-peak biomechanical knee flexion:
  // Peak 1: High swing-phase toe clearance | Peak 2: Weight-acceptance heel-strike recoil absorption
  const swK_L = Math.pow(Math.max(0, -C(p - 0.22)), 1.35) * o.kn;
  const rcK_L = Math.pow(Math.max(0, S(p - 0.32)), 2.0) * (o.kn * 0.24);
  const swK_R = Math.pow(Math.max(0, C(p - 0.22)), 1.35) * o.kn;
  const rcK_R = Math.pow(Math.max(0, -S(p - 0.32)), 2.0) * (o.kn * 0.24);
  j.kL.rotation.x = swK_L + rcK_L;
  j.kR.rotation.x = swK_R + rcK_R;

  // Ankle dorsiflexion (heel strike toe-up) & plantarflexion (push-off toe-down)
  if (j.fL && j.fR) {
    j.fL.rotation.x = -0.22 * Math.max(0, S(p + 0.35)) + 0.30 * Math.max(0, -S(p - 0.25));
    j.fR.rotation.x = -0.22 * Math.max(0, -S(p + 0.35)) + 0.30 * Math.max(0, S(p - 0.25));
  }

  // Pelvis 3-axis kinematics: double-frequency vertical bounce + lateral weight shift + Trendelenburg hip drop
  j.root.position.y += (0.5 + 0.5 * c2) * o.bn;
  j.root.position.x = c1 * (o.lat !== undefined ? o.lat : 0.022);
  j.root.rotation.z = -s1 * (o.hipZ !== undefined ? o.hipZ : 0.045);
  j.root.rotation.y = s1 * o.tw;

  // Counter-rotated spine & contrapposto chest tilt
  j.torso.rotation.y = -s1 * o.tw * 1.65;
  j.torso.rotation.z = s1 * (o.hipZ !== undefined ? o.hipZ : 0.045) * 0.72;
  j.torso.rotation.x = o.ln + s2 * (o.bobX || 0.018);

  // Delayed phase-lagged arm & forearm pendulum (or custom arm pose override)
  const armLag = S(p - 0.22);
  const elLagL = S(p - 0.58), elLagR = -S(p - 0.58);
  j.aL.rotation.x = (o.aL0 || 0) - armLag * (o.arL !== undefined ? o.arL : o.ar);
  j.aR.rotation.x = (o.aR0 || 0) + armLag * (o.arR !== undefined ? o.arR : o.ar);
  j.aL.rotation.z = (o.azL !== undefined ? o.azL : -0.08) - Math.abs(s1) * 0.03;
  j.aR.rotation.z = (o.azR !== undefined ? o.azR : 0.08) + Math.abs(s1) * 0.03;
  j.eL.rotation.x = (o.eL0 !== undefined ? o.eL0 : -0.28) - (o.elL !== undefined ? o.elL : o.el) * (0.35 + 0.65 * Math.max(0, elLagL));
  j.eR.rotation.x = (o.eR0 !== undefined ? o.eR0 : -0.28) - (o.elR !== undefined ? o.elR : o.el) * (0.35 + 0.65 * Math.max(0, elLagR));

  // Head stabilization & character personality cadence
  j.head.rotation.x = (o.hd || 0) - s2 * 0.022;
  j.head.rotation.z = C(p - 0.3) * (o.hz || 0);
  j.head.rotation.y = s1 * (o.tw * 0.45) + (o.hy ? S(t * 1.45) * o.hy : 0);

  if (c.tailGrp) c.tailGrp.rotation.y = s1 * 0.32;
  if (o.custom) o.custom(c, t, p, s1, c1, s2);
  return o.f || {};
};

const idle = o => (c, t) => {
  const j = c.j, b = S(t * o.sp);
  j.torso.rotation.x = o.ln + b * 0.015; j.root.position.y += b * 0.005;
  j.head.rotation.z = S(t * 0.7) * (o.sw || 0); j.head.rotation.x = o.hd || 0;
  j.aL.rotation.x = b * 0.03; j.aR.rotation.x = -b * 0.03;
  j.eL.rotation.x = j.eR.rotation.x = -0.15;
  if (c.tailGrp) c.tailGrp.rotation.y = S(t * 1.8) * 0.22;
  return o.f || {};
};

const exprPose = (hdRot, fObj) => (c, t) => {
  const j = c.j, b = S(t * 1.3);
  j.torso.rotation.x = b * 0.01;
  j.head.rotation.set(hdRot[0] + b * 0.015, hdRot[1], hdRot[2]);
  j.eL.rotation.x = j.eR.rotation.x = -0.16;
  return fObj;
};

// All 19 Reference Sheets Catalog
const SHEETS = [
  { id: 'ethan1', title: '001 · Ethan (Main Concept Sheet)', file: 'References/7170efb3-727b-4792-b3a6-9595f20b0f55.png' },
  { id: 'ethan2', title: '001B · Ethan (Alternate Sheet)', file: 'References/2205d881-b3fb-4a7b-a3c0-39da24312048.png' },
  { id: 'mother', title: '002 · Ethan’s Mother', file: 'References/0d70cf64-78e9-41cb-8765-db014faa05ec.png' },
  { id: 'driver1', title: '003 · The Driver (Taxi / Work Sheet)', file: 'References/a97669b8-b105-4736-934a-00fc52acca0f.png' },
  { id: 'driver2', title: '003B · The Driver / "Sir" (Flat Cap Sheet)', file: 'References/5b2304a0-d145-469b-8749-8ce3b8d209b8.png' },
  { id: 'aunt', title: '004 · Aunt Momma (Mrs. Flebilis)', file: 'References/8d0d8b77-ac70-4238-9910-84847a1c6585.png' },
  { id: 'wren1', title: '005 · Wren (Superhero Boy Sheet)', file: 'References/b73b95c9-41b7-49e2-9ddc-e3e0f4113952.png' },
  { id: 'wren2', title: '005B · Wren (Kitsune Hoodie Sheet)', file: 'References/8f1faa9e-0c96-47ff-9f23-8fc56f8eb5ce.png' },
  { id: 'wren3', title: '005C · Wren (Bunny Clip Alt Variant)', file: 'References/50eee43f-5436-44f0-bae7-18b6725de537.png' },
  { id: 'sofi', title: '006 · Sofi (Online Friend & Gamer)', file: 'References/bcd433b9-43dc-4dcf-9972-1afcbeca7b01.png' },
  { id: 'fox', title: '007 · Blue Fox (Ethan’s Pet)', file: 'References/56d008a5-54e7-461f-9652-41a895326f9e.png' },
  { id: 'princeps', title: '008 · Dragon Princeps (The Dragon of All Dragons)', file: 'References/76d699dd-0be0-4d41-bbf5-c93fe42863c2.png' },
  { id: 'wolf', title: '009 · Green Wolf (Sofi’s Pet)', file: 'References/eddd5065-4e8a-4f93-ae5f-1431a6769c3d.png' },
  { id: 'dragon', title: '010 · Sofi’s Purple Dragon', file: 'References/e95421d9-207c-46e6-be41-f57522fb9cdb.png' },
  { id: 'console', title: '011 · Ethan’s Handheld Game Console', file: 'References/854a9cf4-8cf4-4b26-9566-f30641a5ff1d.png' },
  { id: 'doctor', title: '012 · Hospital Doctor (Dr. A. Nakamura)', file: 'References/bda23bee-0846-43c5-8d58-4a54f256aeef.png' },
  { id: 'worker1', title: '013 · Hospital Worker (Account Recovery Sheet)', file: 'References/8323e5b2-471d-41f3-89a3-e846e7609774.png' },
  { id: 'worker2', title: '014 · Hospital Worker (Renamed from Ethan Jereq)', file: 'References/559f615c-fac1-4469-bad0-1e1ab0761ed0-keep-design-change-name-to-hostpital-worker.png' },
  { id: 'bird', title: '015 · The Weak Bird / "Worriblin" Concept', file: 'References/923efed9-e201-473c-9c42-9a7ec324b17e.png' }
];

const defs = [
  {
    id: 'ethan',
    n: 'Ethan',
    traits: ['IMAGINATIVE', 'KIND', 'CURIOUS', 'DETERMINED', 'SENSITIVE'],
    quote: '“I’m not a princess. I’m a knight. Game = my world.”',
    r: 'Age 10 · Primary Protagonist · Knight12123',
    sheet: 'References/7170efb3-727b-4792-b3a6-9595f20b0f55.png',
    pal: ['#4e7c52', '#38bdf8', '#5c4674', '#dca884', '#3b261d'],
    outfits: [
      { label: 'A. Olive Fox Tee', top: 0x4e7c52, sleeve: 0x4e7c52, pants: 0x5c4674, shorts: 1, short: 1 },
      { label: 'B. Tan Car Jacket', top: 0x7c684e, sleeve: 0x6b5840, pants: 0xa89274, shorts: 1, short: 0 },
      { label: 'C. Dad’s Hat & Shades', top: 0x4e7c52, sleeve: 0x4e7c52, pants: 0x5c4674, shorts: 1, short: 1 },
      { label: 'D. Cream Hoodie & Band-Aid', top: 0xe8dfd1, sleeve: 0xe8dfd1, pants: 0x475569, shorts: 1, short: 0 }
    ],
    F: {
      isEthan: true,
      hair: 'ethan', hs: [1.00, 0.96, 0.99], jawW: 0.84, chinW: 0.30, ear: 1.08, blush: 0.24,
      eye: { w: 0.128, eh: 0.074, sp: 0.062, y: 0.012, tilt: 0.02, iris: 0x5c3824, ld: 0.06 },
      brow: { w: 0.074, t: 0.014, arch: 0.02, col: 0x2b1b14 },
      nose: { w: 0.82, l: 0.78, y: -0.02 },
      mo: { w: 0.033, y: -0.080, col: 0x9e4b42 }
    },
    skin: 0xdca884, top: 0x4e7c52, sleeve: 0x4e7c52, pants: 0x5c4674, shoe: 0xd8dde6, hair: 0x3b261d,
    shorts: 1, short: 1, sneaker: 1, kneeBandage: 1, h: 0.77, w: 0.88, hdScale: 1.13,
    art: { n: 'Hybrid 2.5D Painterly', ol: 0x141018, w: 1.05, g: [0.38, 0.72, 1.0] },
    acc: accEthan,
    an: {
      Idle: idle({ sp: 1.8, ln: 0.02, hd: 0.02, sw: 0.05, f: { sm: 0.18, lid: 0.06 } }),
      // Ethan's Curious 10-Year-Old Boy Sneaker Bounce Stride (Left hand carries console, Right arm swings pencil-sword!)
      Walk: walk({
        sp: 5.8, sw: 0.50, kn: 0.96, ar: 0.48, arL: 0.22, arR: 0.56, aL0: -0.34, eL0: -0.76, elL: 0.18, elR: 0.44,
        bn: 0.044, lat: 0.028, hipZ: 0.055, tw: 0.10, ln: 0.02, hz: 0.055, hy: 0.12,
        custom: (c, t) => {
          // Keep head upright looking ahead so his eyes & expressions shine clearly
          c.j.head.rotation.x = -0.04 + S(t * 1.4) * 0.03;
        },
        f: { sm: 0.24, bl: 0.15, br: 0.15 }
      }),
      // Walking while glued to his handheld console screen ("I played my game, then looked out the window")
      'Console Walk': walk({
        sp: 4.6, sw: 0.36, kn: 0.68, ar: 0.10, aL0: -0.78, aR0: -0.78, azL: 0.20, azR: -0.20, eL0: -1.12, eR0: -1.12, el: 0.06,
        bn: 0.024, lat: 0.020, hipZ: 0.038, tw: 0.04, ln: 0.14, hd: 0.32, hz: 0.04,
        custom: (c, t) => {
          c.j.eL.rotation.x = -1.12 + S(t * 9) * 0.06;
          c.j.eR.rotation.x = -1.12 + C(t * 9) * 0.06;
        },
        f: { sm: 0.28, lid: 0.14, gy: 0.35, gx: 0.12 }
      }),
      'Play Console': (c, t) => {
        const j = c.j;
        j.torso.rotation.x = 0.14; j.head.rotation.x = 0.34 + S(t * 2.5) * 0.03;
        j.aL.rotation.x = j.aR.rotation.x = -0.82;
        j.aL.rotation.z = 0.22; j.aR.rotation.z = -0.22;
        j.eL.rotation.x = -1.15 + S(t * 9) * 0.08; j.eR.rotation.x = -1.15 + C(t * 9) * 0.08;
        return { sm: 0.32, lid: 0.15, gy: 0.35, gx: S(t * 3) * 0.25 };
      },
      'Knight Sword Attack': (c, t) => {
        const j = c.j, k = S(t * 5);
        j.torso.rotation.y = k * 0.35; j.torso.rotation.x = 0.12;
        j.aR.rotation.x = -1.65 + k * 0.75; j.aR.rotation.z = 0.35;
        j.eR.rotation.x = -0.45; j.aL.rotation.x = -0.65;
        j.lL.rotation.x = 0.32; j.lR.rotation.x = -0.32;
        return { a: 0.55, op: 0.55, sm: -0.15 };
      },
      // ---- ETHAN'S 7-MOVE KNIGHT FIGHTING PACK (Action RPG / Sword & Shield Pack) ----
      'Fight: Combat Stance': (c, t) => {
        const j = c.j, b = S(t * 4.2), b2 = C(t * 8.4);
        j.root.position.y += b2 * 0.022;
        j.root.rotation.y = -0.38;
        j.torso.rotation.y = 0.28 + b * 0.05;
        j.torso.rotation.x = 0.12;
        j.lL.rotation.x = -0.26; j.kL.rotation.x = 0.42;
        j.lR.rotation.x = 0.28;  j.kR.rotation.x = 0.48;
        j.lL.rotation.z = -0.09; j.lR.rotation.z = 0.09;
        // Left arm raises Knight Shield in guard; Right arm poises Level-1000 Sword
        j.aL.rotation.x = -0.78 + b * 0.06; j.aL.rotation.z = -0.28; j.eL.rotation.x = -1.08;
        j.aR.rotation.x = -0.45 - b * 0.08; j.aR.rotation.z = 0.36;  j.eR.rotation.x = -0.82;
        j.head.rotation.y = 0.12; j.head.rotation.x = -0.06;
        return { a: 0.42, sm: 0.25, bl: 0.2, br: 0.2 };
      },
      'Fight: 3-Hit Sword Combo': (c, t) => {
        const j = c.j, cyc = (t * 1.35) % 1.0;
        j.lL.rotation.z = -0.10; j.lR.rotation.z = 0.10;
        if (cyc < 0.33) {
          // Hit 1: Wide horizontal diagonal cleave (Right -> Left)
          const u = cyc / 0.33, swp = S(u * PI);
          j.root.rotation.y = -0.45 + u * 0.95;
          j.torso.rotation.y = -0.50 + u * 1.15;
          j.torso.rotation.x = 0.18;
          j.lL.rotation.x = -0.38 * swp; j.kL.rotation.x = 0.55 * swp;
          j.lR.rotation.x = 0.36 * swp;  j.kR.rotation.x = 0.35;
          j.aR.rotation.x = -1.35; j.aR.rotation.z = 1.15 - u * 1.85; j.eR.rotation.x = -0.25;
          j.aL.rotation.x = -0.55; j.aL.rotation.z = -0.42; j.eL.rotation.x = -0.95;
        } else if (cyc < 0.66) {
          // Hit 2: Rising reverse backhand cross-slash (Left -> Upper Right)
          const u = (cyc - 0.33) / 0.33, swp = S(u * PI);
          j.root.rotation.y = 0.50 - u * 0.95;
          j.torso.rotation.y = 0.65 - u * 1.25;
          j.torso.rotation.x = 0.08 - swp * 0.12;
          j.lL.rotation.x = 0.32 * swp;  j.kL.rotation.x = 0.38;
          j.lR.rotation.x = -0.38 * swp; j.kR.rotation.x = 0.52 * swp;
          j.aR.rotation.x = -0.85 - u * 1.10; j.aR.rotation.z = -0.65 + u * 1.65; j.eR.rotation.x = -0.32;
          j.aL.rotation.x = -0.72; j.aL.rotation.z = -0.35; j.eL.rotation.x = -1.05;
        } else {
          // Hit 3: Heavy overhead lunging Knight Finisher!
          const u = (cyc - 0.66) / 0.34, slam = Math.min(1, u * 1.45);
          j.root.position.y += S(u * PI) * 0.14 - slam * 0.08;
          j.root.rotation.y = 0.15;
          j.torso.rotation.x = -0.22 + slam * 0.52;
          j.torso.rotation.y = -0.25 + slam * 0.55;
          j.lR.rotation.x = -0.52 * slam; j.kR.rotation.x = 0.78 * slam;
          j.lL.rotation.x = 0.48 * slam;  j.kL.rotation.x = 0.42;
          j.aR.rotation.x = -2.65 + slam * 2.15; j.aR.rotation.z = 0.18; j.eR.rotation.x = -0.15;
          j.aL.rotation.x = -0.45; j.aL.rotation.z = -0.52; j.eL.rotation.x = -0.88;
        }
        return { a: 0.72, op: 0.62, sm: -0.20 };
      },
      'Fight: Jump Sky Slash': (c, t) => {
        // "I AM KNIGHT ETHAN. I WILL ATTACK YOU! I run so fast to it and then I jump so high"
        const j = c.j, u = (t * 1.25) % 1.0, arc = S(u * PI);
        j.root.position.y += arc * 0.72;
        j.torso.rotation.x = -0.25 + u * 0.68;
        j.torso.rotation.y = -0.35 + u * 0.75;
        j.lL.rotation.x = -0.68 * arc; j.kL.rotation.x = 1.25 * arc;
        j.lR.rotation.x = -0.42 * arc; j.kR.rotation.x = 1.05 * arc;
        j.aR.rotation.x = -2.75 + Math.pow(u, 1.4) * 2.35; j.aR.rotation.z = 0.22; j.eR.rotation.x = -0.18;
        j.aL.rotation.x = -0.95; j.aL.rotation.z = -0.58; j.eL.rotation.x = -0.92;
        return { a: 0.80, op: 0.75, sm: -0.18 };
      },
      'Fight: Knight Spin Slash': (c, t) => {
        // 360-degree Whirlwind Level-1000 Magic Sword Spin
        const j = c.j, u = (t * 1.8) % 1.0;
        j.root.rotation.y = u * PI * 2;
        j.root.position.y -= 0.06;
        j.torso.rotation.x = 0.18;
        j.lL.rotation.x = -0.28; j.kL.rotation.x = 0.55;
        j.lR.rotation.x = 0.28;  j.kR.rotation.x = 0.55;
        j.aR.rotation.x = -1.45; j.aR.rotation.z = 1.38;  j.eR.rotation.x = -0.12;
        j.aL.rotation.x = -1.15; j.aL.rotation.z = -1.15; j.eL.rotation.x = -0.45;
        return { a: 0.68, op: 0.55, sm: 0.20 };
      },
      'Fight: Shield Block': (c, t) => {
        // "I then use my shield" — Braces Blue Fox Knight Shield against impact
        const j = c.j, b = S(t * 6.0);
        j.root.position.y -= 0.08;
        j.root.rotation.y = 0.35;
        j.torso.rotation.x = 0.16; j.torso.rotation.y = -0.32;
        j.lL.rotation.x = -0.42; j.kL.rotation.x = 0.72;
        j.lR.rotation.x = 0.38;  j.kR.rotation.x = 0.58;
        j.aL.rotation.x = -1.18 + b * 0.04; j.aL.rotation.z = 0.42; j.eL.rotation.x = -1.12;
        j.aR.rotation.x = -0.35; j.aR.rotation.z = 0.48; j.eR.rotation.x = -0.95;
        j.head.rotation.x = 0.08; j.head.rotation.y = 0.25;
        return { a: 0.58, sm: -0.25, lid: 0.18 };
      },
      'Fight: Dodge Roll': (c, t) => {
        // Quick evasive side-dash & low combat roll
        const j = c.j, u = (t * 1.9) % 1.0, s = S(u * PI * 2);
        j.root.position.x = s * 0.42;
        j.root.position.y -= Math.abs(S(u * PI)) * 0.18;
        j.torso.rotation.z = -s * 0.28;
        j.torso.rotation.x = 0.28;
        j.lL.rotation.x = -0.45; j.kL.rotation.x = 0.88;
        j.lR.rotation.x = 0.35;  j.kR.rotation.x = 0.82;
        j.aL.rotation.x = -0.75; j.aR.rotation.x = -0.55;
        return { a: 0.45, sm: 0.15, gx: s * 0.3 };
      },
      'Fight: Cast Magic Dust ✨': (c, t) => {
        // "I use power of magic dust to blind her eye so I can steal her emerald"
        const j = c.j, u = (t * 1.5) % 1.0, swp = S(u * PI);
        j.torso.rotation.y = 0.45 - u * 0.90;
        j.torso.rotation.x = 0.10;
        j.lL.rotation.x = -0.32; j.kL.rotation.x = 0.48;
        j.lR.rotation.x = 0.28;  j.kR.rotation.x = 0.38;
        j.aL.rotation.x = -1.45; j.aL.rotation.z = 0.55 - u * 1.35; j.eL.rotation.x = -0.18 * (1 - swp);
        j.aR.rotation.x = -0.58; j.aR.rotation.z = 0.42; j.eR.rotation.x = -0.75;
        return { sm: 0.48, bl: 0.35, br: 0.35, op: 0.42 };
      },
      'Scratch Itchy Eyes': (c, t) => {
        const j = c.j;
        j.head.rotation.z = 0.10; j.head.rotation.x = 0.15;
        j.aR.rotation.x = -1.55; j.eR.rotation.x = -1.65 + S(t * 8) * 0.15;
        return { lid: 0.82, op: 0.25, a: -0.25 };
      },
      'Expr: Proud Knight': exprPose([-0.06, 0.10, 0], { sm: 0.55, bl: 0.25, br: 0.25, a: 0.20 }),
      'Expr: Worried / Scared': exprPose([0.08, -0.12, 0.06], { sm: -0.35, a: -0.45, bl: 0.5, br: 0.5, tear: 0.8 }),
      'Expr: Sleepy Car Ride': exprPose([0.16, 0.05, 0.12], { lid: 0.78, sm: -0.05 })
    }
  },
  {
    id: 'sofi',
    n: 'Sofi',
    traits: ['COMPETITIVE', 'PLAYFUL', 'DRAMATIC', 'EXPRESSIVE', 'LOYAL'],
    quote: '“It’s Sofi. Not Sofa. 😡 Green wolf for my blue fox... Deal!”',
    r: 'Age 11 (turning 12) · Online Friend in Lóže (Sun Up)',
    sheet: 'References/bcd433b9-43dc-4dcf-9972-1afcbeca7b01.png',
    pal: ['#9fd8cb', '#f2a6b8', '#f5ebd6', '#2d3142', '#4a3022'],
    outfits: [
      { label: 'A. Pastel Fox Jacket', top: 0x9fd8cb, sleeve: 0xf2a6b8, pants: 0x2d3142, shorts: 0, short: 0 },
      { label: 'B. Casual Fox Tee', top: 0xf5ebd6, sleeve: 0xf5ebd6, pants: 0x475569, shorts: 1, short: 1 },
      { label: 'C. Cozy Pink Sweater', top: 0xf2a6b8, sleeve: 0xf2a6b8, pants: 0xd88fa0, shorts: 0, short: 0 }
    ],
    F: {
      hair: 'sofi', hs: [0.95, 1.0, 0.97], jawW: 0.76, chinW: 0.33, ear: 0.98, wing: 1, blush: 0.20,
      eye: { w: 0.118, eh: 0.060, sp: 0.059, y: 0.020, tilt: 0.08, iris: 0x6b442a, ld: 0.05 },
      brow: { w: 0.070, t: 0.012, arch: 0.05, col: 0x3b2418 },
      nose: { w: 0.84, l: 0.88, y: -0.03 },
      mo: { w: 0.035, y: -0.085, col: 0xb84a58 }
    },
    skin: 0xe2b290, top: 0x9fd8cb, sleeve: 0xf2a6b8, pants: 0x2d3142, shoe: 0xf472b6, hair: 0x4a3022,
    sneaker: 1, h: 0.83, w: 0.89,
    art: { n: 'Vibrant Pastel Toon', ol: 0x1c1224, w: 1.05, g: [0.42, 0.76, 1.0] },
    acc: accSofi,
    an: {
      Idle: idle({ sp: 2.1, ln: 0, sw: 0.08, f: { sm: 0.38, bl: 0.2, br: 0.2 } }),
      // Sofi's Sassy Gamer Skip-Strut with Rhythmic Headphone Music Bop
      Walk: walk({
        sp: 6.4, sw: 0.52, kn: 0.94, ar: 0.54, arL: 0.58, arR: 0.26, aR0: -0.38, eR0: -0.82, elL: 0.48, elR: 0.20,
        azL: -0.16, azR: 0.14, bn: 0.048, lat: 0.032, hipZ: 0.072, tw: 0.13, ln: -0.02, hz: 0.095,
        custom: (c, t, p, s1, c1, s2) => {
          // Rhythmic music beat nod to her cyan headphones
          c.j.head.rotation.x = -0.04 + Math.abs(s2) * 0.09;
        },
        f: { sm: 0.52, bl: 0.25, br: 0.10 }
      }),
      'Not Sofa! 😡': (c, t) => {
        const j = c.j, stp = Math.abs(S(t * 7));
        j.torso.rotation.x = 0.12; j.head.rotation.z = S(t * 6) * 0.10;
        j.aL.rotation.z = -0.45; j.aR.rotation.z = 0.45;
        j.eL.rotation.x = j.eR.rotation.x = -1.1;
        j.lR.rotation.x = -stp * 0.45; j.root.position.y += stp * 0.03;
        return { a: 0.72, sm: -0.45, op: 0.35 };
      },
      'Victory Laugh 😂': (c, t) => {
        const j = c.j;
        j.head.rotation.x = -0.15 + S(t * 8) * 0.08;
        j.torso.rotation.x = -0.08;
        j.aL.rotation.x = j.aR.rotation.x = -0.95;
        return { sm: 0.85, op: 0.55, bl: 0.35, br: 0.35, lid: 0.25 };
      },
      'Expr: Teasing Smirk': exprPose([-0.03, 0.12, -0.05], { sm: 0.52, bl: 0.4, br: -0.1, gx: -0.2 }),
      'Expr: Angry (Sofi! 😡)': exprPose([0.06, 0, 0], { a: 0.75, sm: -0.42, lid: 0.18 }),
      'Expr: Loyal Friend': exprPose([0, -0.08, 0.04], { sm: 0.42, bl: 0.2, br: 0.2 })
    }
  },
  {
    id: 'wren',
    n: 'Wren',
    traits: ['MISCHIEVOUS', 'TALKATIVE', 'CLEVER', 'SUPERHERO', 'CARING'],
    quote: '“I’m not a kid, I’m a superhero. I say stupid things... but I still care, okay?”',
    r: 'Age 10–12 · Foster Sibling & Fellow Survivor',
    sheet: 'References/b73b95c9-41b7-49e2-9ddc-e3e0f4113952.png',
    pal: ['#23222a', '#dc2626', '#475569', '#d8a27e', '#2e1f18'],
    outfits: [
      { label: 'A. Superhero Hoodie', top: 0xdc2626, sleeve: 0x23222a, pants: 0x475569, shorts: 1, short: 0 },
      { label: 'B. Kitsune Cap & Cargo', top: 0x7f1d1d, sleeve: 0x27272a, pants: 0x3f3f46, shorts: 0, short: 0 },
      { label: 'C. Comfy Pajamas', top: 0x0d9488, sleeve: 0x0d9488, pants: 0x334155, shorts: 0, short: 0 },
      { label: 'D. Bunny Clip Variant', top: 0x581c87, sleeve: 0x3b0764, pants: 0x1e293b, shorts: 0, short: 0 }
    ],
    F: {
      hair: 'wren', hs: [0.96, 0.99, 0.98], jawW: 0.79, chinW: 0.35, ear: 1.04, blush: 0.15, bandaid: 1,
      eye: { w: 0.116, eh: 0.058, sp: 0.060, y: 0.019, tilt: 0.05, iris: 0x683c24, ld: 0.08 },
      brow: { w: 0.072, t: 0.014, arch: 0.04, col: 0x261812 },
      nose: { w: 0.90, l: 0.88, y: -0.03 },
      mo: { w: 0.037, y: -0.085, col: 0x98423c }
    },
    skin: 0xd8a27e, top: 0xdc2626, sleeve: 0x23222a, pants: 0x475569, shoe: 0xdc2626, hair: 0x2e1f18,
    shorts: 1, sneaker: 1, kneeBandage: 1, h: 0.82, w: 0.89,
    art: { n: 'Bold Comic Toon', ol: 0x100e14, w: 1.15, g: [0.40, 0.78, 1.0] },
    acc: accWren,
    an: {
      Idle: idle({ sp: 2.3, ln: -0.02, sw: 0.09, f: { sm: 0.45, bl: 0.25 } }),
      // Wren's Puffed-Chest High-Knee "Superhero Patrol" Strut (carrying ruler sword on right shoulder!)
      Walk: walk({
        sp: 6.2, sw: 0.58, kn: 1.10, ar: 0.62, arL: 0.68, arR: 0.16, aR0: -0.88, eR0: -1.18, elL: 0.55, elR: 0.12,
        azL: -0.18, azR: 0.24, stance: 0.04, bn: 0.052, lat: 0.034, hipZ: 0.062, tw: 0.14, ln: -0.07, hd: -0.06, hz: 0.08,
        f: { sm: 0.62, bl: 0.28, br: 0.28 }
      }),
      'Superhero Pose': (c, t) => {
        const j = c.j;
        j.torso.rotation.x = -0.10; j.head.rotation.x = -0.08 + S(t * 2) * 0.03;
        j.aL.rotation.z = -0.58; j.aR.rotation.z = 0.58;
        j.eL.rotation.x = j.eR.rotation.x = -1.35;
        j.lL.rotation.z = -0.12; j.lR.rotation.z = 0.12;
        return { sm: 0.72, bl: 0.35, br: 0.35 };
      },
      'Point Ruler Sword': (c, t) => {
        const j = c.j;
        j.torso.rotation.y = -0.32; j.aR.rotation.x = -1.45 + S(t * 5) * 0.06;
        j.eR.rotation.x = -0.15; j.aL.rotation.x = -0.45;
        return { a: 0.48, op: 0.32, sm: -0.15 };
      },
      'Vulnerable Truth': (c, t) => {
        const j = c.j;
        j.head.rotation.x = 0.16; j.head.rotation.z = -0.08;
        j.aL.rotation.x = j.aR.rotation.x = -0.35;
        j.eL.rotation.x = j.eR.rotation.x = -0.85;
        return { sm: -0.28, a: -0.42, bl: 0.5, br: 0.5, lid: 0.25 };
      },
      'Expr: Superhero Grin': exprPose([-0.05, -0.08, 0.05], { sm: 0.68, bl: 0.3, br: 0.3 }),
      'Expr: Hurt / Honest': exprPose([0.10, 0.08, -0.05], { sm: -0.25, a: -0.40, lid: 0.28 })
    }
  },
  {
    id: 'aunt',
    n: 'Aunt Momma',
    traits: ['AFFECTIONATE', 'EMOTIONAL', 'UNPREDICTABLE', 'TROUBLED', 'OVERWHELMING'],
    quote: '“You are home now dear. I’m your momma now.”',
    r: 'Mrs. Flebilis · Foster Caregiver · Emotional & Unsettling',
    sheet: 'References/8d0d8b77-ac70-4238-9910-84847a1c6585.png',
    pal: ['#2e2430', '#d87a56', '#e6b85c', '#c89678', '#241815'],
    outfits: [
      { label: 'A. Floral Kimono', top: 0x282228, sleeve: 0x2e2430, skirt: 0x3d2e38 },
      { label: 'B. Soap & Soup Apron', top: 0x3b2d38, sleeve: 0x3b2d38, skirt: 0x2d242c },
      { label: 'C. Monster Costume', top: 0x16a34a, sleeve: 0x16a34a, skirt: 0x15803d }
    ],
    F: {
      hair: 'aunt', hs: [0.91, 1.04, 0.96], jawW: 0.73, chinW: 0.29, ear: 0.94, wing: 1, blush: 0.18, lines: 1,
      eye: { w: 0.114, eh: 0.054, sp: 0.058, y: 0.024, tilt: 0.10, iris: 0x42281c, ld: 0.12, bag: 0x7c503c },
      brow: { w: 0.072, t: 0.010, arch: -0.06, col: 0x221512 },
      nose: { w: 0.82, l: 1.02, y: -0.03 },
      mo: { w: 0.036, y: -0.086, col: 0x9c3b38 }
    },
    skin: 0xc89678, top: 0x282228, sleeve: 0x2e2430, skirt: 0x3d2e38, long: 1, pants: 0x2a1e1c, shoe: 0x241a18, hair: 0x241815,
    h: 1.01, w: 0.95,
    art: { n: 'Chiaroscuro Painterly', ol: 0x281210, w: 0.95, g: [0.38, 0.68, 0.92, 1.0], soft: 1 },
    acc: accAunt,
    an: {
      Idle: idle({ sp: 1.2, ln: 0, sw: 0.04, f: { sm: 0.35, lid: 0.10, bl: 0.2, br: 0.2 } }),
      // Aunt Momma's Eerie Clasped-Hands Gliding Skirt Sway ("You are home now dear")
      Walk: walk({
        sp: 3.6, sw: 0.24, kn: 0.36, ar: 0.04, aL0: -0.58, aR0: -0.58, azL: 0.26, azR: -0.26, eL0: -1.16, eR0: -1.16, el: 0.04,
        bn: 0.006, lat: 0.026, hipZ: 0.052, tw: 0.05, ln: 0.03, hd: 0.04,
        custom: (c, t, p, s1) => {
          // Unsettlingly affectionate tilted head sway while gliding
          c.j.head.rotation.z = 0.11 + s1 * 0.05;
        },
        f: { sm: 0.56, lid: 0.04, bl: 0.32, br: 0.32 }
      }),
      'Kneel Like a Knight': (c, t) => {
        const j = c.j;
        j.root.position.y = 0.62;
        j.lL.rotation.x = -1.15; j.kL.rotation.x = 1.45;
        j.lR.rotation.x = 0.25; j.kR.rotation.x = 1.35;
        j.aL.rotation.x = j.aR.rotation.x = -0.85;
        j.aL.rotation.z = -0.35; j.aR.rotation.z = 0.35;
        j.head.rotation.x = -0.14;
        return { sm: 0.58, bl: 0.45, br: 0.45, tear: 0.7 };
      },
      'Emotional Tears': (c, t) => {
        const j = c.j;
        j.aL.rotation.x = j.aR.rotation.x = -1.15;
        j.eL.rotation.x = j.eR.rotation.x = -1.45;
        j.head.rotation.z = S(t * 2) * 0.08;
        return { sm: 0.45, bl: 0.55, br: 0.55, a: -0.35, tear: 1.0 };
      },
      'Monster Roar!': (c, t) => {
        const j = c.j, b = S(t * 6);
        j.aL.rotation.x = j.aR.rotation.x = -1.65 + b * 0.2;
        j.aL.rotation.z = -0.45; j.aR.rotation.z = 0.45;
        j.eL.rotation.x = j.eR.rotation.x = -0.65;
        j.torso.rotation.x = 0.15;
        return { op: 0.75, sm: 0.55, bl: 0.4, br: 0.4 };
      },
      'Expr: Fixed Smile': exprPose([0.04, -0.08, 0.06], { sm: 0.65, lid: 0.02, bl: 0.35, br: 0.35 }),
      'Expr: Hissing Anger': exprPose([0.08, 0.10, -0.05], { a: 0.85, sm: -0.55, lid: 0.28 })
    }
  },
  {
    id: 'driver',
    n: 'The Driver',
    traits: ['IMPATIENT', 'ROUGH', 'TIRED', 'PRAGMATIC', 'DISMISSIVE'],
    quote: '“Ask your stupid mum for ice cream. I’m driving.”',
    r: 'Age 40s–50s · Night Taxi Driver ("Sir")',
    sheet: 'References/a97669b8-b105-4736-934a-00fc52acca0f.png',
    pal: ['#26292e', '#e7dec8', '#5e4334', '#4d5642', '#2b2623'],
    outfits: [
      { label: 'A. Shearling Work Jacket', top: 0x26292e, sleeve: 0x26292e, pants: 0x4d5642 },
      { label: 'B. Flat Cap & Brown Coat', top: 0x5c4028, sleeve: 0x5c4028, pants: 0x3b3734 },
      { label: 'C. Off-Duty Flannel', top: 0x5e4334, sleeve: 0x5e4334, pants: 0x334155, short: 1 }
    ],
    F: {
      hair: 'driver', hs: [1.03, 1.02, 1.02], jawW: 0.90, chinW: 0.48, ear: 1.10, blush: 0.08, stubble: 0.85, lines: 1,
      eye: { w: 0.106, eh: 0.045, sp: 0.060, y: 0.018, tilt: -0.08, iris: 0x3d2e22, ld: 0.32, bag: 0x5c3a28 },
      brow: { w: 0.080, t: 0.018, arch: -0.08, col: 0x241f1c },
      nose: { w: 1.16, l: 1.08, y: -0.03 },
      mo: { w: 0.036, y: -0.090, col: 0x6e3e36 }
    },
    skin: 0xb88464, top: 0x26292e, sleeve: 0x26292e, pants: 0x4d5642, shoe: 0x1c1816, hair: 0x2b2623,
    boot: 1, h: 1.03, w: 1.06,
    art: { n: 'Gritty Noir Ink', ol: 0x141110, w: 1.12, g: [0.30, 0.58, 0.82, 1.0] },
    acc: accDriver,
    an: {
      Idle: idle({ sp: 1.0, ln: 0.05, hd: 0.06, sw: 0.03, f: { sm: -0.22, lid: 0.32, a: 0.28 } }),
      // The Driver's Heavy Hunched Work-Boot Trudge (carrying hot coffee cup in right hand)
      Walk: walk({
        sp: 3.7, sw: 0.34, kn: 0.62, ar: 0.28, arL: 0.34, arR: 0.06, aR0: -0.58, eR0: -1.04, elL: 0.24, elR: 0.05,
        stance: 0.055, bn: 0.022, lat: 0.038, hipZ: 0.058, tw: 0.07, ln: 0.12, bobX: 0.028, hd: 0.10, hz: 0.04,
        f: { sm: -0.28, lid: 0.34, a: 0.32 }
      }),
      'Drive & Glare Back': (c, t) => {
        const j = c.j;
        j.aL.rotation.x = -0.95; j.eL.rotation.x = -0.45;
        j.head.rotation.y = -0.58 + S(t * 1.5) * 0.08;
        j.head.rotation.x = 0.08;
        return { a: 0.55, sm: -0.38, lid: 0.32, gx: -0.45 };
      },
      'Drink Coffee (Tired)': (c, t) => {
        const j = c.j, k = 0.5 + 0.5 * S(t * 1.4);
        j.aR.rotation.x = -1.25 * k; j.eR.rotation.x = -1.35 * k;
        j.head.rotation.x = -0.15 * k;
        return { lid: 0.55, sm: -0.15 };
      },
      'Expr: Annoyed Scowl': exprPose([0.06, -0.12, 0], { a: 0.65, sm: -0.40, lid: 0.34 }),
      'Expr: Exhausted': exprPose([0.14, 0.05, 0.04], { lid: 0.58, sm: -0.18, a: -0.15 })
    }
  },
  {
    id: 'mother',
    n: 'Ethan’s Mother',
    traits: ['WARM', 'GENTLE', 'SILENT', 'BELOVED', 'HOME'],
    quote: '“She said nothing. I think she was sleeping. She still feels like home.”',
    r: 'Early 30s · Ethan’s Mother · Asleep in the Back Seat',
    sheet: 'References/0d70cf64-78e9-41cb-8765-db014faa05ec.png',
    pal: ['#3a4659', '#3b82f6', '#c8b094', '#d8a482', '#261814'],
    outfits: [
      { label: 'A. Car Journey Cardigan', top: 0x242834, sleeve: 0x3a4659, pants: 0xc8b094 },
      { label: 'B. Warm Home Memory', top: 0x7fa6c4, sleeve: 0x7fa6c4, pants: 0x475569 }
    ],
    F: {
      hair: 'mother', hs: [0.91, 1.03, 0.96], jawW: 0.72, chinW: 0.28, ear: 0.92, wing: 1, blush: 0.14,
      eye: { w: 0.112, eh: 0.050, sp: 0.058, y: 0.024, tilt: 0.06, iris: 0x4e3222, ld: 0.15 },
      brow: { w: 0.070, t: 0.009, arch: -0.04, col: 0x221612 },
      nose: { w: 0.80, l: 0.98, y: -0.03 },
      mo: { w: 0.033, y: -0.086, col: 0x9c4844 }
    },
    skin: 0xd8a482, top: 0x242834, sleeve: 0x3a4659, pants: 0xc8b094, shoe: 0x3b2820, hair: 0x261814,
    h: 0.97, w: 0.92,
    art: { n: 'Soft Memory Wash', ol: 0x241618, w: 0.88, g: [0.44, 0.74, 0.94, 1.0], soft: 1 },
    acc: accMother,
    an: {
      'Sleeping in Car': (c, t) => {
        const j = c.j, b = S(t * 0.9);
        j.head.rotation.z = 0.26; j.head.rotation.x = 0.18 + b * 0.01;
        j.torso.rotation.z = 0.06;
        j.aL.rotation.x = j.aR.rotation.x = -0.35;
        j.eL.rotation.x = j.eR.rotation.x = -0.75;
        return { lid: 0.96, sm: 0.08 };
      },
      Idle: idle({ sp: 1.1, ln: 0, sw: 0.03, f: { sm: 0.28, lid: 0.16 } }),
      // Mother's Gentle Handbag-Holding Memory Promenade
      Walk: walk({
        sp: 3.5, sw: 0.28, kn: 0.48, ar: 0.22, arL: 0.06, arR: 0.26, aL0: -0.32, azL: 0.14, eL0: -0.86, elL: 0.05, elR: 0.24,
        bn: 0.012, lat: 0.022, hipZ: 0.048, tw: 0.06, ln: 0.01, hd: 0.03, hz: 0.035,
        f: { sm: 0.34, lid: 0.14, bl: 0.18, br: 0.18 }
      }),
      'Expr: Peaceful Sleep': exprPose([0.18, 0.08, 0.24], { lid: 0.98, sm: 0.06 }),
      'Expr: Loving Memory': exprPose([-0.02, -0.08, 0.05], { sm: 0.48, bl: 0.2, br: 0.2, lid: 0.12 })
    }
  },
  {
    id: 'worker',
    n: 'Hospital Worker',
    traits: ['KIND', 'PATIENT', 'RESOURCEFUL', 'SUPPORTIVE', 'WARM'],
    quote: '“Good memory young man. There you go, all set up and ready. You’re not alone in this.”',
    r: 'Hospital IT & Patient Support · Recovers knight12123 Account',
    sheet: 'References/559f615c-fac1-4469-bad0-1e1ab0761ed0-keep-design-change-name-to-hostpital-worker.png',
    pal: ['#243b5c', '#38bdf8', '#f8fafc', '#7c4e36', '#141214'],
    outfits: [
      { label: 'A. Navy Hospital Scrubs', top: 0x243b5c, sleeve: 0x243b5c, pants: 0x1e324e, short: 1 },
      { label: 'B. IT Hoodie Over Scrubs', top: 0x1f242d, sleeve: 0x1f242d, pants: 0x1e324e, short: 0 }
    ],
    F: {
      hair: 'worker', hs: [0.97, 1.02, 0.99], jawW: 0.82, chinW: 0.38, ear: 1.0, blush: 0.10, stubble: 0.65,
      eye: { w: 0.110, eh: 0.052, sp: 0.059, y: 0.020, tilt: 0.02, iris: 0x2b1b12, ld: 0.12 },
      brow: { w: 0.074, t: 0.015, arch: 0.02, col: 0x121012 },
      nose: { w: 1.02, l: 0.96, y: -0.03 },
      mo: { w: 0.036, y: -0.086, col: 0x5c2e28 }
    },
    skin: 0x7c4e36, top: 0x243b5c, sleeve: 0x243b5c, pants: 0x1e324e, shoe: 0xf1f5f9, hair: 0x141214,
    short: 1, sneaker: 1, h: 1.02, w: 0.98,
    art: { n: 'Warm Clinical Toon', ol: 0x0f172a, w: 1.0, g: [0.36, 0.70, 1.0] },
    acc: accWorker,
    an: {
      Idle: idle({ sp: 1.4, ln: 0.02, sw: 0.04, f: { sm: 0.38, bl: 0.18, br: 0.18 } }),
      // Hospital Worker's Brisk Corridor Stride (carrying cat-sleeve coffee in left hand & Ethan's console in right!)
      Walk: walk({
        sp: 4.8, sw: 0.38, kn: 0.74, ar: 0.16, arL: 0.08, arR: 0.18, aL0: -0.56, aR0: -0.44, eL0: -0.98, eR0: -0.82, elL: 0.06, elR: 0.16,
        bn: 0.022, lat: 0.024, hipZ: 0.046, tw: 0.08, ln: 0.04, hd: 0.04, hz: 0.04,
        f: { sm: 0.42, bl: 0.22, br: 0.22 }
      }),
      'Recover Account (knight12123)': (c, t) => {
        const j = c.j;
        j.torso.rotation.x = 0.14; j.head.rotation.x = 0.26;
        j.aR.rotation.x = -0.92; j.eR.rotation.x = -1.05 + S(t * 8) * 0.08;
        j.aL.rotation.x = -0.65; j.eL.rotation.x = -0.85;
        return { sm: 0.42, bl: 0.25, br: 0.25, gy: 0.30 };
      },
      'Expr: Warm Reassurance': exprPose([0.04, -0.08, 0.04], { sm: 0.55, bl: 0.28, br: 0.28 }),
      'Expr: Focused IT Support': exprPose([0.12, 0.06, 0], { sm: 0.18, a: 0.15, gy: 0.25 })
    }
  },
  {
    id: 'doctor',
    n: 'Dr. A. Nakamura',
    traits: ['CALM', 'PROFESSIONAL', 'OBSERVANT', 'PROTECTIVE', 'KIND'],
    quote: '“Let’s take care of you first. Under Section 152 of the Children’s Protection Act of Katomos...”',
    r: 'Attending Hospital Doctor · Issues Section 152 Safe Care Order',
    sheet: 'References/bda23bee-0846-43c5-8d58-4a54f256aeef.png',
    pal: ['#f4f6f8', '#223450', '#38bdf8', '#dfb494', '#1c181b'],
    outfits: [
      { label: 'A. White Lab Coat', top: 0x223450, sleeve: 0xf4f6f8, pants: 0x1e293b },
      { label: 'B. Ward Scrubs', top: 0x223450, sleeve: 0x223450, pants: 0x1e293b, short: 1 },
      { label: 'C. After-Hours Jacket', top: 0x334155, sleeve: 0x334155, pants: 0x1e293b }
    ],
    F: {
      hair: 'doctor', hs: [0.94, 1.03, 0.97], jawW: 0.76, chinW: 0.33, ear: 0.96, blush: 0.10,
      eye: { w: 0.108, eh: 0.046, sp: 0.058, y: 0.022, tilt: 0.04, iris: 0x2b1d16, ld: 0.16 },
      brow: { w: 0.070, t: 0.012, arch: -0.02, col: 0x1a1618 },
      nose: { w: 0.86, l: 1.0, y: -0.03 },
      mo: { w: 0.033, y: -0.086, col: 0x8c4640 }
    },
    skin: 0xdfb494, top: 0x223450, sleeve: 0xf4f6f8, pants: 0x1e293b, shoe: 0x1e293b, hair: 0x1c181b,
    h: 1.02, w: 0.95,
    art: { n: 'Clean Medical Ink', ol: 0x0f172a, w: 0.95, g: [0.40, 0.74, 1.0] },
    acc: accDoctor,
    an: {
      Idle: idle({ sp: 1.2, ln: 0, sw: 0.03, f: { sm: 0.22, lid: 0.14 } }),
      // Dr. Nakamura's Composed Clinical Ward-Rounds Stride (Left hand holds Section 152 Clipboard to chest!)
      Walk: walk({
        sp: 4.4, sw: 0.33, kn: 0.60, ar: 0.28, arL: 0.05, arR: 0.30, aL0: -0.68, azL: 0.18, eL0: -1.14, elL: 0.04, elR: 0.26,
        bn: 0.016, lat: 0.020, hipZ: 0.042, tw: 0.07, ln: -0.01, hd: 0.02, hz: 0.025,
        f: { sm: 0.22, lid: 0.14 }
      }),
      'Section 152 Order': (c, t) => {
        const j = c.j;
        j.aL.rotation.x = -0.85; j.eL.rotation.x = -1.05;
        j.aR.rotation.x = -0.55 + S(t * 3) * 0.08;
        j.head.rotation.x = 0.06;
        return { a: 0.38, sm: -0.12, lid: 0.18 };
      },
      'Expr: Reassuring Smile': exprPose([0.03, -0.06, 0.03], { sm: 0.42, bl: 0.2, br: 0.2 }),
      'Expr: Serious Diagnosis': exprPose([0.06, 0.08, 0], { a: 0.35, sm: -0.15, lid: 0.22 })
    }
  },
  // ---- 5 FULL 3D ARTICULATED FANTASY CREATURES ----
  {
    id: 'fox',
    isCreature: true,
    n: 'Blue Fox',
    traits: ['LOYAL', 'CELESTIAL', 'SWIFT', 'TREASURED', 'AGILE'],
    quote: '“I have no dragon, but I have a blue 🦊. My dad paid all his money for her.”',
    r: 'Ethan’s Treasured In-Game Companion · Traded to Sofi',
    sheet: 'References/56d008a5-54e7-461f-9652-41a895326f9e.png',
    pal: ['#162238', '#38bdf8', '#f0f6ff', '#0284c7', '#0f172a'],
    h: 0.88, rootY: 0.62,
    art: { n: 'Celestial Cyan Glow', ol: 0x082f49, w: 1.05, g: [0.35, 0.72, 1.0] },
    an: {
      Idle: (c, t) => {
        const j = c.j, b = S(t * 2.4);
        j.root.position.y = 0.62 + b * 0.02;
        j.head.rotation.y = S(t * 1.1) * 0.18;
        j.head.rotation.x = b * 0.05;
        if (c.tailGrp) { c.tailGrp.rotation.y = S(t * 2.2) * 0.35; c.tailGrp.rotation.x = C(t * 1.8) * 0.15; }
      },
      Walk: (c, t) => {
        const j = c.j, p = t * 7.5, s = S(p);
        j.aL.rotation.x = s * 0.55; j.aR.rotation.x = -s * 0.55;
        j.lL.rotation.x = -s * 0.55; j.lR.rotation.x = s * 0.55;
        j.root.position.y = 0.62 + Math.abs(C(p)) * 0.06;
        if (c.tailGrp) c.tailGrp.rotation.y = s * 0.4;
      },
      'Celestial Leap': (c, t) => {
        const j = c.j, k = Math.abs(S(t * 3.5));
        j.root.position.y = 0.62 + k * 0.45;
        j.torso.rotation.x = -0.35 * S(t * 3.5);
        j.aL.rotation.x = j.aR.rotation.x = -0.65 * k;
        j.lL.rotation.x = j.lR.rotation.x = 0.65 * k;
      }
    }
  },
  {
    id: 'princeps',
    isCreature: true,
    n: 'Dragon Princeps',
    traits: ['COLOSSAL', 'UNDEFEATED', 'HALLUCINATION', 'ARCANE', 'FIERCE'],
    quote: '“I am Dragon Princeps: The Dragon of all dragons!”',
    r: 'Black & Neon-Green Boss Dragon · Breathes Pink & Blue Magic Fire',
    sheet: 'References/76d699dd-0be0-4d41-bbf5-c93fe42863c2.png',
    pal: ['#13161f', '#22c55e', '#f43f5e', '#38bdf8', '#090d16'],
    h: 1.12, rootY: 1.08,
    art: { n: 'Abyssal Neon Scale', ol: 0x052e16, w: 1.15, g: [0.28, 0.64, 1.0] },
    an: {
      Idle: (c, t) => {
        const j = c.j, b = S(t * 2.6);
        j.root.position.y = 1.08 + b * 0.08;
        j.aL.rotation.z = b * 0.42; j.aR.rotation.z = -b * 0.42;
        j.eL.rotation.z = b * 0.28; j.eR.rotation.z = -b * 0.28;
        if (c.jaw) c.jaw.rotation.x = 0.15 + Math.max(0, S(t * 2)) * 0.25;
        if (c.tailGrp) c.tailGrp.rotation.y = S(t * 1.9) * 0.38;
      },
      Walk: (c, t) => {
        const j = c.j, b = S(t * 5.0);
        j.root.position.y = 1.15 + b * 0.14;
        j.aL.rotation.z = b * 0.65; j.aR.rotation.z = -b * 0.65;
        if (c.tailGrp) c.tailGrp.rotation.y = C(t * 5.0) * 0.45;
      },
      'Roar Pink-Blue Fire!': (c, t) => {
        const j = c.j, b = S(t * 6.0);
        j.torso.rotation.x = 0.22; j.head.rotation.x = -0.25 + b * 0.08;
        j.aL.rotation.z = 0.55; j.aR.rotation.z = -0.55;
        if (c.jaw) c.jaw.rotation.x = 0.58;
        if (c.breathOrb) c.breathOrb.scale.setScalar(1.4 + Math.abs(b) * 1.8);
      }
    }
  },
  {
    id: 'dragon',
    isCreature: true,
    n: 'Purple Dragon',
    traits: ['FLASHY', 'SASSY', 'PROUD', 'MAGICAL', 'FIERCE'],
    quote: '“Sofi’s dragon. Fast, flashy, and fierce. Always with me when I play!”',
    r: 'Creature 010 · Sofi’s In-Game Dragon Companion',
    sheet: 'References/e95421d9-207c-46e6-be41-f57522fb9cdb.png',
    pal: ['#7e3af2', '#f472b6', '#60a5fa', '#fef08a', '#3b0764'],
    h: 0.96, rootY: 0.95,
    art: { n: 'Arcane Amethyst Toon', ol: 0x3b0764, w: 1.05, g: [0.38, 0.74, 1.0] },
    an: {
      Idle: (c, t) => {
        const j = c.j, b = S(t * 3.0);
        j.root.position.y = 0.95 + b * 0.07;
        j.aL.rotation.z = b * 0.48; j.aR.rotation.z = -b * 0.48;
        j.head.rotation.y = S(t * 1.4) * 0.22;
        if (c.tailGrp) c.tailGrp.rotation.y = S(t * 2.5) * 0.35;
      },
      Walk: (c, t) => {
        const j = c.j, b = S(t * 5.8);
        j.root.position.y = 1.02 + b * 0.12;
        j.aL.rotation.z = b * 0.62; j.aR.rotation.z = -b * 0.62;
      },
      'Magic Cage Burst': (c, t) => {
        const j = c.j, b = S(t * 5);
        j.root.position.y = 1.18 + b * 0.1;
        j.aL.rotation.z = 0.6; j.aR.rotation.z = -0.6;
        if (c.jaw) c.jaw.rotation.x = 0.48;
      }
    }
  },
  {
    id: 'wolf',
    isCreature: true,
    n: 'Green Wolf',
    traits: ['WILD', 'FAST', 'PROTECTIVE', 'STUBBORN', 'WIND-ELEMENT'],
    quote: '“Sofi’s wolf. Fast, wild, and proud. Be a good wolf for your new friend, okay?”',
    r: 'Creature 009 · Promised to Ethan in the Fox Swap',
    sheet: 'References/eddd5065-4e8a-4f93-ae5f-1431a6769c3d.png',
    pal: ['#2b7a4b', '#86efac', '#ecfdf5', '#15803d', '#052e16'],
    h: 0.92, rootY: 0.62,
    art: { n: 'Emerald Wind Cel', ol: 0x052e16, w: 1.05, g: [0.36, 0.72, 1.0] },
    an: {
      Idle: (c, t) => {
        const j = c.j, b = S(t * 2.2);
        j.root.position.y = 0.62 + b * 0.02;
        j.head.rotation.y = S(t * 1.0) * 0.16;
        if (c.tailGrp) c.tailGrp.rotation.y = S(t * 2.8) * 0.35;
      },
      Walk: (c, t) => {
        const j = c.j, p = t * 8.0, s = S(p);
        j.aL.rotation.x = s * 0.6; j.aR.rotation.x = -s * 0.6;
        j.lL.rotation.x = -s * 0.6; j.lR.rotation.x = s * 0.6;
        j.root.position.y = 0.62 + Math.abs(C(p)) * 0.07;
      },
      'Howl to the Sky': (c, t) => {
        const j = c.j;
        j.torso.rotation.x = -0.28;
        j.head.rotation.x = -0.55 + S(t * 3) * 0.05;
        j.lL.rotation.x = j.lR.rotation.x = 0.25;
      }
    }
  },
  {
    id: 'bird',
    isCreature: true,
    n: 'The Weak Bird',
    traits: ['SCRAPPY', 'WORRIED', 'LOYAL', 'FEATHERY', 'UNDERDOG'],
    quote: '“The game gave me a weak bird, so I had something to fight with.”',
    r: 'Worriblin · Ethan’s Default Starter Bird Companion',
    sheet: 'References/923efed9-e201-473c-9c42-9a7ec324b17e.png',
    pal: ['#c88a36', '#7c4d25', '#f59e0b', '#fbbf24', '#451a03'],
    h: 0.78, rootY: 0.58,
    art: { n: 'Sketchbook Feather Ink', ol: 0x291506, w: 1.0, g: [0.38, 0.72, 1.0] },
    an: {
      Idle: (c, t) => {
        const j = c.j, b = Math.abs(S(t * 4.5));
        j.root.position.y = 0.58 + b * 0.05;
        j.head.rotation.z = S(t * 5) * 0.14;
        j.aL.rotation.z = b * 0.28; j.aR.rotation.z = -b * 0.28;
      },
      Walk: (c, t) => {
        const j = c.j, p = t * 10.0, s = S(p);
        j.lL.rotation.x = s * 0.65; j.lR.rotation.x = -s * 0.65;
        j.aL.rotation.z = Math.abs(s) * 0.55; j.aR.rotation.z = -Math.abs(s) * 0.55;
        j.torso.rotation.x = 0.18;
        j.root.position.y = 0.58 + Math.abs(C(p)) * 0.06;
      }
    }
  }
];
export function setCS(val) { CS = val; }
export function getCS() { return CS; }
export function setNOL(val) { NOL = val; }
export {
  defs,
  build,
  paintFace,
  grad,
  enhanceGouacheMaterial,
  addOutline,
  M,
  Cy,
  Sp,
  Cn,
  Bx,
  Tr,
  J,
  conScreenCan,
  conScreenCtx,
  conScreenTex,
  GOUACHE_BUMP
};
