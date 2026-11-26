import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';
import { VRButton } from 'three/addons/VRButton.js';
import { Sound } from './audio.js';
import { Voice, detectSpell } from './voice.js';

const Q = new URLSearchParams(location.search);
const CAPTURE = Q.has('capture');
const LOWFX = Q.has('lowfx');
const $ = (id) => document.getElementById(id);

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURE });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.shadowMap.enabled = !LOWFX;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
renderer.xr.setFoveation(1);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030304);
scene.fog = new THREE.FogExp2(0x06070a, 0.05);

const rig = new THREE.Group(); rig.position.set(0, 0, 2.2); scene.add(rig);
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 60);
camera.position.set(0, 1.68, 0); rig.add(camera);

const manager = new THREE.LoadingManager();
manager.setURLModifier((u) => (window.__blobs && window.__blobs[u]) || u);
manager.onProgress = (u, a, b) => { $('loadstate').textContent = `Loading the dungeon… ${a}/${b}`; };
const texLoader = new THREE.TextureLoader(manager);
const maxAniso = renderer.capabilities.getMaxAnisotropy();

function pbr(name, rep = [1, 1], opts = {}) {
  const base = `assets/tex/${name}_`;
  const load = (s, srgb) => { const t = texLoader.load(base + s + '.jpg'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = Math.min(8, maxAniso); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return new THREE.MeshStandardMaterial({ map: load('diff', true), normalMap: load('nor'), roughnessMap: load('rough'), aoMap: load('ao'), aoMapIntensity: 1, roughness: 1, metalness: 0, color: opts.color ?? 0xffffff, normalScale: new THREE.Vector2(opts.ns ?? 1.2, opts.ns ?? 1.2) });
}

// ---------- dungeon ----------
const W = 12, L = 22, H = 6.5, Z0 = 4, Z1 = Z0 - L; // z from 4 to -18
const env = new THREE.Group(); scene.add(env);
const envMeshes = [];
function addMesh(geo, mat, pos, rot, shadowRecv = true, shadowCast = false) {
  if (geo.attributes.uv && !geo.attributes.uv1) geo.setAttribute('uv1', geo.attributes.uv);
  const m = new THREE.Mesh(geo, mat); m.position.copy(pos); if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.receiveShadow = shadowRecv; m.castShadow = shadowCast; env.add(m); envMeshes.push(m); return m;
}
const floorMat = pbr('cobblestone_floor_08', [W / 2.2, L / 2.2], { color: 0x8a8378, ns: 1.4 });
floorMat.roughnessMap = null; floorMat.roughness = 0.82; // slightly damp stone
addMesh(new THREE.PlaneGeometry(W, L), floorMat, new THREE.Vector3(0, 0, (Z0 + Z1) / 2), [-Math.PI / 2, 0, 0]);
const wallMat = pbr('rock_wall_08', [L / 3.2, H / 3.2], { color: 0x9a9286, ns: 1.6 });
addMesh(new THREE.PlaneGeometry(L, H), wallMat, new THREE.Vector3(-W / 2, H / 2, (Z0 + Z1) / 2), [0, Math.PI / 2, 0]);
addMesh(new THREE.PlaneGeometry(L, H), wallMat, new THREE.Vector3(W / 2, H / 2, (Z0 + Z1) / 2), [0, -Math.PI / 2, 0]);
const endMat = pbr('rock_wall_08', [W / 3.2, H / 3.2], { color: 0x9a9286, ns: 1.6 });
addMesh(new THREE.PlaneGeometry(W, H), endMat, new THREE.Vector3(0, H / 2, Z1), [0, 0, 0]);
addMesh(new THREE.PlaneGeometry(W, H), endMat, new THREE.Vector3(0, H / 2, Z0), [0, Math.PI, 0]);
const ceilMat = pbr('rock_wall_08', [W / 3, L / 3], { color: 0x4a4640 });
addMesh(new THREE.PlaneGeometry(W, L), ceilMat, new THREE.Vector3(0, H, (Z0 + Z1) / 2), [Math.PI / 2, 0, 0]);
// timber beams
const beamMat = pbr('wood_planks_dirt', [1, 4], { color: 0x5b4c3e });
for (let z = Z0 - 2; z > Z1; z -= 4) addMesh(new THREE.BoxGeometry(W, 0.45, 0.5), beamMat, new THREE.Vector3(0, H - 0.3, z));
// pillars
const pillarMat = pbr('medieval_blocks_02', [1, 4.5], { color: 0x6f675c, ns: 1.5 });
const capMat = pbr('medieval_blocks_02', [1.2, 0.3], { color: 0x5f584e });
const pillarZ = [0.5, -4, -8.5, -13];
for (const z of pillarZ) for (const x of [-4.3, 4.3]) {
  addMesh(new THREE.BoxGeometry(0.95, H, 0.95), pillarMat, new THREE.Vector3(x, H / 2, z), null, true, true);
  addMesh(new THREE.BoxGeometry(1.25, 0.35, 1.25), capMat, new THREE.Vector3(x, 0.17, z), null, true, true);
  addMesh(new THREE.BoxGeometry(1.25, 0.35, 1.25), capMat, new THREE.Vector3(x, H - 0.75, z), null, true, false);
}
// rubble
const rockMat = pbr('rock_wall_08', [0.6, 0.6], { color: 0x77706a });
const rnd = (a, b) => a + Math.random() * (b - a);
let seed = 7; const srand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < 26; i++) {
  const g = new THREE.IcosahedronGeometry(0.12 + srand() * 0.32, 1); const p = g.attributes.position;
  for (let k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) * (0.8 + srand() * 0.5), p.getY(k) * (0.5 + srand() * 0.4), p.getZ(k) * (0.8 + srand() * 0.5));
  g.computeVertexNormals();
  const side = srand() < 0.5 ? -1 : 1;
  const m = addMesh(g, rockMat, new THREE.Vector3(side * (4.6 + srand() * 1.2), 0.05, Z0 - 1 - srand() * (L - 2)), [srand() * 3, srand() * 3, 0], true, true);
}
// hanging chains
const ironMat = new THREE.MeshStandardMaterial({ color: 0x2a2724, metalness: 0.9, roughness: 0.55 });
const linkGeo = new THREE.TorusGeometry(0.06, 0.016, 6, 10);
const chainCount = 5, linksPer = 16;
const links = new THREE.InstancedMesh(linkGeo, ironMat, chainCount * linksPer); links.castShadow = true; scene.add(links);
const chains = [[-2.4, -6.2, 2.6], [2.8, -11, 3.2], [-1.2, -13.5, 1.8], [3.3, -2.6, 2.2], [-3.2, -10.2, 3.0]];
function layoutChains(t) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  let n = 0;
  chains.forEach(([x, z, len], ci) => { const sway = Math.sin(t * 0.6 + ci) * 0.05;
    for (let i = 0; i < linksPer; i++) { const y = H - (i / linksPer) * len; e.set(sway * i * 0.1, (i % 2) * Math.PI / 2, 0); q.setFromEuler(e);
      m.compose(new THREE.Vector3(x + Math.sin(sway) * (H - y) * 0.3, y, z), q, new THREE.Vector3(1, 1, 1)); links.setMatrixAt(n++, m); } });
  links.instanceMatrix.needsUpdate = true;
}
layoutChains(0);

// ---------- sprite textures ----------
function radialTex(stops, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glowTex = radialTex([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
const softTex = radialTex([[0, 'rgba(255,255,255,0.6)'], [0.5, 'rgba(255,255,255,0.15)'], [1, 'rgba(255,255,255,0)']]);
function flameTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 92, 2, 32, 80, 60);
  gr.addColorStop(0, 'rgba(255,245,210,1)'); gr.addColorStop(0.2, 'rgba(255,190,90,0.9)'); gr.addColorStop(0.5, 'rgba(220,90,20,0.45)'); gr.addColorStop(1, 'rgba(120,20,0,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(32, 2); g.bezierCurveTo(60, 60, 62, 110, 32, 124); g.bezierCurveTo(2, 110, 4, 60, 32, 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const fTex = flameTex();
const addMat = (map, color, opacity = 1) => new THREE.SpriteMaterial({ map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });

// ---------- torches ----------
const torches = [];
const torchWood = pbr('wood_planks_dirt', [0.3, 1], { color: 0x3b2e24 });
function torch(x, z, side) {
  const g = new THREE.Group(); g.position.set(x, 2.35, z);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.5, 8), torchWood); stick.rotation.z = side * 0.35; stick.castShadow = false; g.add(stick);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.05), ironMat); bracket.position.set(side * 0.1, -0.05, 0); g.add(bracket);
  const fl = new THREE.Group(); fl.position.set(-side * 0.09, 0.3, 0); g.add(fl);
  const s1 = new THREE.Sprite(addMat(fTex, 0xffc27a, 1)); s1.scale.set(0.3, 0.55, 1); fl.add(s1); const s3 = new THREE.Sprite(addMat(fTex, 0xff7a30, 0.8)); s3.scale.set(0.42, 0.7, 1); s3.position.y = 0.05; fl.add(s3);
  const s2 = new THREE.Sprite(addMat(glowTex, 0xff7a2a, 0.4)); s2.scale.set(1.8, 1.8, 1); fl.add(s2);
  const light = new THREE.PointLight(0xff8a3c, 9, 11, 2); light.position.set(-side * 0.35, 0.35, 0); g.add(light);
  scene.add(g); torches.push({ g, s1, s2, light, base: 9, ph: Math.random() * 10 });
}
torch(3.78, 0.5, 1); torch(-3.78, -4, -1); torch(-3.78, -8.5, -1); torch(3.78, -8.5, 1);

// ---------- ritual circle + brazier glow behind demon ----------
const DEMON_HOME = new THREE.Vector3(0, 0, -7.6);
function circleTex() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.translate(256, 256);
  g.strokeStyle = 'rgba(255,60,30,0.9)'; g.lineWidth = 3; g.shadowColor = 'rgba(255,40,10,1)'; g.shadowBlur = 12;
  [236, 222, 150].forEach(r => { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); });
  g.font = '28px Georgia'; g.fillStyle = 'rgba(255,80,40,0.85)';
  const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
  for (let i = 0; i < 24; i++) { g.save(); g.rotate(i / 24 * Math.PI * 2); g.fillText(glyphs[i], -9, -196); g.restore(); }
  g.lineWidth = 2; g.beginPath(); for (let i = 0; i <= 7; i++) { const a = i * (Math.PI * 2 / 7) * 3 - Math.PI / 2; const x = Math.cos(a) * 150, y = Math.sin(a) * 150; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const circleMat = new THREE.MeshBasicMaterial({ map: circleTex(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xff5533 });
const circle = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), circleMat); circle.rotation.x = -Math.PI / 2; circle.position.set(DEMON_HOME.x, 0.012, DEMON_HOME.z); scene.add(circle);
const pitLight = new THREE.PointLight(0xff3a1a, 9, 9, 2); pitLight.position.set(0, 1.2, DEMON_HOME.z - 0.9); scene.add(pitLight);
const backLight = new THREE.Object3D(); // merged into pitLight to keep the light count low for Quest

// cold shaft from a crack in the ceiling (shadow caster)
const moon = new THREE.SpotLight(0x8fa6d6, 60, 16, 0.42, 0.7, 1.6);
moon.position.set(1.0, H - 0.1, -5.4); moon.target.position.set(-0.2, 0, -7.2); scene.add(moon, moon.target);
moon.castShadow = !LOWFX; moon.shadow.mapSize.set(1024, 1024); moon.shadow.bias = -0.0008; moon.shadow.camera.near = 1; moon.shadow.camera.far = 12;
const shaftMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { col: { value: new THREE.Color(0x6f86b8) }, op: { value: 0.16 } },
  vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vY = uv.y; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `uniform vec3 col; uniform float op; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 3.0); float g = smoothstep(0.0,0.35,vY)*smoothstep(1.0,0.75,vY); gl_FragColor = vec4(col*f*g*op, 1.0); }` });
{ const geo = new THREE.CylinderGeometry(0.3, 2.2, H, 32, 1, true); const shaft = new THREE.Mesh(geo, shaftMat);
  shaft.position.copy(moon.position).lerp(moon.target.position, 0.5); shaft.lookAt(moon.target.position); shaft.rotateX(Math.PI / 2); scene.add(shaft); }
const hemi = new THREE.HemisphereLight(0x46506a, 0x1a120c, 0.7); scene.add(hemi);

// pooled FX lights, always present (constant light count, no shader recompiles)
const boltLight = new THREE.PointLight(0x9cc6ff, 0, 12, 2); scene.add(boltLight);
const fireLight = new THREE.PointLight(0xff6a20, 0, 9, 2); scene.add(fireLight);
const handLight = new THREE.Object3D(); handLight.intensity = 0; // sprite glow only (perf)

// ---------- dust + embers ----------
function makePoints(n, size, color, spread) {
  const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { p[i * 3] = rnd(-spread.x, spread.x); p[i * 3 + 1] = rnd(0, spread.y); p[i * 3 + 2] = rnd(spread.z0, spread.z1); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({ size, map: softTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6, sizeAttenuation: true });
  return new THREE.Points(g, m);
}
const dust = makePoints(350, 0.035, 0x8f8a80, { x: 5.5, y: 5.5, z0: Z1 + 1, z1: Z0 - 1 }); scene.add(dust);
const embers = makePoints(90, 0.05, 0xff5a20, { x: 1.8, y: 4, z0: DEMON_HOME.z - 1.8, z1: DEMON_HOME.z + 1.8 }); scene.add(embers);

// ---------- Talysman (clan mate) ----------
function noiseCanvasTex(base, var_) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const d = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const i = (y * 256 + x) * 4; const v = (Math.sin(x * 0.9) * 0.5 + 0.5) * 0.3 + Math.random() * 0.7;
    d.data[i] = base[0] + v * var_; d.data[i + 1] = base[1] + v * var_; d.data[i + 2] = base[2] + v * var_; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function nameTag(text, color, sub) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
  g.font = '600 40px Georgia'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,0.0)'; g.fillRect(0, 0, 512, 96);
  g.shadowColor = 'black'; g.shadowBlur = 6; g.fillStyle = color; g.fillText(text, 256, 52);
  if (sub) { g.font = '26px Georgia'; g.fillStyle = 'rgba(210,200,180,0.8)'; g.fillText(sub, 256, 86); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false })); s.scale.set(1.3, 0.244, 1); return s;
}
const tal = new THREE.Group(); tal.position.set(-2.5, 0, -4.7); tal.rotation.y = -0.6; scene.add(tal);
{
  const cloth = new THREE.MeshStandardMaterial({ map: noiseCanvasTex([48, 50, 62], 36), color: 0xc4c8d8, roughness: 0.85 });
  cloth.map.repeat.set(4, 2);
  const prof = [[0.0, 0], [0.46, 0], [0.42, 0.3], [0.34, 0.8], [0.27, 1.15], [0.24, 1.35], [0.27, 1.43], [0.2, 1.5], [0.08, 1.56], [0, 1.57]].map(([r, y]) => new THREE.Vector2(r, y));
  const rg = new THREE.LatheGeometry(prof, 40); const p = rg.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i); const a = Math.atan2(z, x); const f = 1 + Math.sin(a * 11 + y * 2) * 0.05 * (1.4 - Math.min(y, 1.4)); p.setX(i, x * f); p.setZ(i, z * f * 0.85); }
  rg.computeVertexNormals();
  const robe = new THREE.Mesh(rg, cloth); robe.castShadow = true; tal.add(robe);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), cloth); hood.scale.set(1, 1.2, 1.15); hood.position.set(0, 1.66, 0.01); hood.castShadow = true; tal.add(hood);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({ color: 0x000000 })); face.position.set(0, 1.63, -0.085); face.scale.set(1, 1.15, 0.6); tal.add(face);
  const mantle = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.42, 0.34, 24, 1, true), cloth); mantle.position.y = 1.38; mantle.castShadow = true; tal.add(mantle);
  const sleeveGeo = new THREE.CylinderGeometry(0.06, 0.1, 0.55, 10);
  const armR = new THREE.Mesh(sleeveGeo, cloth); armR.position.set(0.25, 1.15, -0.12); armR.rotation.set(-0.9, 0, 0.2); armR.castShadow = true; tal.add(armR);
  const armL = new THREE.Mesh(sleeveGeo, cloth); armL.position.set(-0.25, 1.12, -0.05); armL.rotation.set(-0.3, 0, -0.15); tal.add(armL);
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 1.95, 8), torchWood); staff.position.set(0.31, 0.98, -0.36); staff.rotation.x = 0.06; staff.castShadow = true; tal.add(staff);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), new THREE.MeshStandardMaterial({ color: 0x223355, emissive: 0x4a7dff, emissiveIntensity: 1.6 })); gem.position.set(0.31, 2.0, -0.3); tal.add(gem);
  const gs = new THREE.Sprite(addMat(glowTex, 0x5f8cff, 0.35)); gs.scale.set(0.35, 0.35, 1); gs.position.copy(gem.position); tal.add(gs);
  const tag = nameTag('Talysman', '#7fb0ff', '[EKOTC]'); tag.position.set(0, 2.15, 0); tal.add(tag);
  tal.userData = { gem, gs };
}

// ---------- demon ----------
const demon = { root: new THREE.Group(), bones: {}, rest: {}, hp: 100, max: 100, alive: true, hitT: 0, attackT: 0, nextAttack: 5, state: 'idle', deathT: 0, mat: null, ready: false };
demon.root.position.copy(DEMON_HOME); scene.add(demon.root);
const demonHit = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 3.4, 8), new THREE.MeshBasicMaterial({ visible: false })); demonHit.position.y = 1.7; demon.root.add(demonHit);
const eyeL = new THREE.Sprite(addMat(glowTex, 0xff4a1a, 0.9)), eyeR = eyeL.clone(); eyeL.scale.set(0.09, 0.09, 1); eyeR.scale.set(0.09, 0.09, 1);
const demonTag = nameTag('a daemon', '#d23b2a'); demonTag.position.set(0, 3.55, 0); demon.root.add(demonTag);
new GLTFLoader(manager).load('assets/models/demon.glb', (gltf) => {
  const m = gltf.scene; m.scale.setScalar(1.7); demon.model = m; demon.root.add(m);
  const diff = texLoader.load('assets/models/demon_diff.jpg'); diff.flipY = false; diff.colorSpace = THREE.SRGBColorSpace;
  const nor = texLoader.load('assets/models/demon_nor.jpg'); nor.flipY = false;
  demon.mat = new THREE.MeshStandardMaterial({ map: diff, normalMap: nor, normalScale: new THREE.Vector2(1.6, 1.6), color: 0x6a5450, roughness: 0.5, metalness: 0.05, emissive: 0x000000 });
  m.traverse((o) => { if (o.isMesh) { o.material = demon.mat; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
    if (o.isBone) { const k = o.name.replace(/[^a-zA-Z]/g, '').toLowerCase(); demon.bones[k] = o; demon.rest[k] = o.quaternion.clone(); } });
  const head = demon.bones['head']; if (head) { head.add(eyeL, eyeR); }
  demon.ready = true;
});
const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
const restParentQ = {};
function boneWorldRot(name, axis, ang) { // rotate bone around an axis given in the demon's model frame
  const b = demon.bones[name]; if (!b) return;
  let pq = restParentQ[name];
  if (!pq) { pq = new THREE.Quaternion(); const tmp = new THREE.Quaternion(); let p = b.parent; const chain = [];
    while (p && p !== demon.model) { chain.unshift(p); p = p.parent; }
    for (const n of chain) pq.multiply(n.quaternion); restParentQ[name] = pq.clone(); }
  tmpQ.setFromAxisAngle(axis, ang); // model frame
  tmpQ2.copy(pq).invert().multiply(tmpQ).multiply(pq); // to parent-local frame
  b.quaternion.premultiply(tmpQ2);
}
function poseDemon(t, dt) {
  if (!demon.ready) return;
  for (const k in demon.rest) demon.bones[k].quaternion.copy(demon.rest[k]);
  // compute rest-parent frames once, before any edits
  if (!demon._frames) { for (const k in demon.rest) boneWorldRot(k, AX, 0); demon._frames = true; }
  const br = Math.sin(t * 1.6), hit = demon.hitT, atk = demon.attackPose || 0, d = demon.deathPose || 0;
  // hunched predator stance
  boneWorldRot('spine', AX, 0.18 + br * 0.03 - hit * 0.35 + d * 0.5);
  boneWorldRot('ribs', AX, 0.16 + br * 0.04 - hit * 0.3 - atk * 0.25);
  boneWorldRot('neck', AX, -0.25 + hit * 0.4);
  boneWorldRot('head', AY, Math.sin(t * 0.45) * 0.25 + hit * 0.3 * Math.sin(t * 40));
  boneWorldRot('head', AX, -0.1 + Math.sin(t * 0.7) * 0.06 - atk * 0.35);
  boneWorldRot('jaw', AX, 0.12 + atk * 0.5 + hit * 0.4 + Math.max(0, Math.sin(t * 0.9)) * 0.08);
  // arms down from the A-pose, claws forward
  const sway = Math.sin(t * 1.1) * 0.06;
  boneWorldRot('upperarml', AZ, -0.75 + sway + hit * 0.5);
  boneWorldRot('upperarml', AX, 0.35 + d * 1.2);
  boneWorldRot('forearml', AX, 0.7 + br * 0.05);
  boneWorldRot('upperarmr', AZ, 0.75 - sway - hit * 0.5 + atk * 1.6);
  boneWorldRot('upperarmr', AX, 0.35 + atk * 0.9 + d * 1.0);
  boneWorldRot('forearmr', AX, 0.7 + atk * 0.6);
  // knees bent
  boneWorldRot('thighl', AX, 0.35 - d * 0.3); boneWorldRot('shinl', AX, -0.5 + d * 0.45);
  boneWorldRot('thighr', AX, 0.3 - d * 0.25); boneWorldRot('shinr', AX, -0.45 + d * 0.4);
  eyeL.position.set(0.05, 0.08, 0.06); eyeR.position.set(-0.05, 0.08, 0.06);
}

// ---------- player hands / controllers ----------
const hands = [];
for (let i = 0; i < 2; i++) {
  const c = renderer.xr.getController(i); rig.add(c);
  const glow = new THREE.Sprite(addMat(glowTex, 0x9cc6ff, 0)); glow.scale.set(0.25, 0.25, 1); glow.position.set(0, 0, -0.08); c.add(glow);
  const tip = new THREE.Sprite(addMat(glowTex, 0x7fa6ff, 0.25)); tip.scale.set(0.04, 0.04, 1); tip.position.z = -0.05; c.add(tip);
  const rayG = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -6)]);
  const ray = new THREE.Line(rayG, new THREE.LineBasicMaterial({ color: 0x9cc6ff, transparent: true, opacity: 0.0, depthWrite: false })); c.add(ray);
  const h = { c, glow, ray, handed: null, holding: false, btnA: false, btnB: false };
  c.addEventListener('connected', (e) => { h.handed = e.data.handedness; h.src = e.data; });
  c.addEventListener('disconnected', () => { h.src = null; });
  c.addEventListener('selectstart', () => { activeHand = h; startTalk(); });
  c.addEventListener('selectend', () => { stopTalk(); });
  hands.push(h);
}
let activeHand = null;
// desktop "hand": a glow at lower right of view
const deskHand = new THREE.Group(); deskHand.position.set(0.3, -0.27, -0.6); camera.add(deskHand);
const deskGlow = new THREE.Sprite(addMat(glowTex, 0x9cc6ff, 0)); deskGlow.scale.set(0.2, 0.2, 1); deskHand.add(deskGlow);

// VR HUD panel
const hudC = document.createElement('canvas'); hudC.width = 512; hudC.height = 160; const hudG = hudC.getContext('2d');
const hudT = new THREE.CanvasTexture(hudC); hudT.colorSpace = THREE.SRGBColorSpace;
const hudPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.13), new THREE.MeshBasicMaterial({ map: hudT, transparent: true, depthTest: false, fog: false }));
hudPanel.position.set(0, -0.33, -0.9); hudPanel.rotation.x = -0.3; hudPanel.renderOrder = 999; hudPanel.visible = false; camera.add(hudPanel);
const hurtSphere = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: 0x8a0000, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, fog: false }));
hurtSphere.renderOrder = 1000; camera.add(hurtSphere);

// ---------- game state ----------
const player = { hp: 100, mana: 100, casting: null, castT: 0 };
const sound = new Sound();
const SPELLS = {
  corp: { words: 'Corp Por', name: 'Energy Bolt', mana: 20, time: 0.85, dmg: [22, 30] },
  flam: { words: 'Vas Flam', name: 'Flame Strike', mana: 40, time: 1.5, dmg: [32, 42] },
};
function log(msg, color = '#c9c1b0') {
  const d = document.createElement('div'); d.textContent = msg; d.style.color = color; $('log').appendChild(d);
  setTimeout(() => (d.style.opacity = 0), 4000); setTimeout(() => d.remove(), 5200);
  while ($('log').children.length > 5) $('log').firstChild.remove();
  vrHudMsg = msg; vrHudDirty = true;
}
let vrHudMsg = '', vrHudDirty = true, voiceLine = 'Hold to speak';
function drawVrHud() {
  const g = hudG; g.clearRect(0, 0, 512, 160); g.fillStyle = 'rgba(5,5,8,0.62)'; g.fillRect(0, 0, 512, 160);
  g.font = '20px Georgia'; g.fillStyle = '#a9a191'; g.fillText('HEALTH', 16, 34); g.fillText('MANA', 16, 70);
  g.fillStyle = '#222'; g.fillRect(110, 20, 380, 16); g.fillRect(110, 56, 380, 16);
  g.fillStyle = '#a3211b'; g.fillRect(110, 20, 380 * player.hp / 100, 16); g.fillStyle = '#3c6fd1'; g.fillRect(110, 56, 380 * player.mana / 100, 16);
  g.font = 'italic 24px Georgia'; g.fillStyle = talking ? '#ffd9a0' : '#cfc7b6'; g.fillText((talking ? '● ' : '') + voiceLine.slice(0, 38), 16, 112);
  g.font = '18px Georgia'; g.fillStyle = '#9a9283'; g.fillText(vrHudMsg.slice(0, 48), 16, 146);
  hudT.needsUpdate = true; vrHudDirty = false;
}
function setBars() { $('hpFill').style.width = player.hp + '%'; $('mpFill').style.width = player.mana + '%'; vrHudDirty = true; }

// spoken words float up like overhead speech
const floaters = [];
function floatText(text, pos, color = '#f2d27a', size = 1) {
  const s = nameTag(text, color); s.material.fog = false; s.scale.multiplyScalar(size); s.position.copy(pos); scene.add(s); floaters.push({ s, t: 0 });
}

// ---------- aiming ----------
const raycaster = new THREE.Raycaster();
const aimOrigin = new THREE.Vector3(), aimDir = new THREE.Vector3();
function getAim() {
  if (renderer.xr.isPresenting && activeHand) { activeHand.c.getWorldPosition(aimOrigin); aimDir.set(0, 0, -1).applyQuaternion(activeHand.c.getWorldQuaternion(tmpQ)); }
  else { camera.getWorldPosition(aimOrigin); camera.getWorldDirection(aimDir); }
  return { o: aimOrigin.clone(), d: aimDir.clone() };
}
function handPos() {
  const v = new THREE.Vector3();
  if (renderer.xr.isPresenting && activeHand) activeHand.c.getWorldPosition(v); else deskHand.getWorldPosition(v);
  return v;
}
function demonCenter() { return demon.root.position.clone().add(new THREE.Vector3(0, 2.3, 0)); }
function resolveTarget() {
  const { o, d } = getAim();
  const dc = demonCenter(); const toD = dc.clone().sub(o); const ang = toD.angleTo(d);
  if (demon.alive && ang < 0.16) return { point: dc.clone().add(new THREE.Vector3(rnd(-0.15, 0.15), rnd(-0.3, 0.2), 0.5)), demon: true };
  raycaster.set(o, d); raycaster.far = 40; const hit = raycaster.intersectObjects(envMeshes, false)[0];
  return { point: hit ? hit.point : o.clone().add(d.multiplyScalar(15)), demon: false };
}

// ---------- lightning ----------
const bolts = [];
function boltRibbonGeo(n) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
  const uv = new Float32Array(n * 2 * 2); for (let i = 0; i < n; i++) { uv.set([i / (n - 1), 0, i / (n - 1), 1], i * 4); } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx); return g; }
const ribbonTex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 64; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
function jagged(a, b, segs, amp) { // fractal midpoint displacement, segs = 2^n + 1
  const n = segs - 1; const pts = new Array(segs); pts[0] = a.clone(); pts[n] = b.clone();
  const dir = b.clone().sub(a); const len = dir.length() || 1e-3; const up = Math.abs(dir.y / len) > 0.9 ? AX : AY;
  const s1 = new THREE.Vector3().crossVectors(dir, up).normalize(), s2 = new THREE.Vector3().crossVectors(dir, s1).normalize();
  let step = n, disp = len * 0.11 * amp;
  while (step > 1) { const h = step / 2;
    for (let i = 0; i < n; i += step) { const m = pts[i].clone().lerp(pts[i + step], 0.5);
      m.addScaledVector(s1, rnd(-1, 1) * disp).addScaledVector(s2, rnd(-1, 1) * disp); pts[i + h] = m; }
    step = h; disp *= 0.52; }
  return pts;
}
function updateRibbon(mesh, pts, width, taper) {
  const pos = mesh.geometry.attributes.position; const cam = new THREE.Vector3(); camera.getWorldPosition(cam);
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)], r = pts[Math.max(i - 1, 0)];
    const t = q.clone().sub(r).normalize(); const v = cam.clone().sub(p).normalize(); const s = new THREE.Vector3().crossVectors(t, v).normalize().multiplyScalar(width * (taper ? 0.25 + 0.75 * i / (pts.length - 1) : 1));
    pos.setXYZ(i * 2, p.x + s.x, p.y + s.y, p.z + s.z); pos.setXYZ(i * 2 + 1, p.x - s.x, p.y - s.y, p.z - s.z); }
  pos.needsUpdate = true; mesh.geometry.computeBoundingSphere();
}
const SEG = 33;
function spawnBolt(from, to, onHit) {
  const group = []; const mk = (color, op, n = SEG) => { const m = new THREE.Mesh(boltRibbonGeo(n), new THREE.MeshBasicMaterial({ map: ribbonTex, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); m.frustumCulled = false; scene.add(m); return m; };
  const core = mk(0xf2f6ff, 1), glow = mk(0x4f86ff, 0.55), br1 = mk(0xb8d2ff, 0.8, 17), br2 = mk(0xb8d2ff, 0.7, 17);
  const orb = new THREE.Sprite(addMat(glowTex, 0xcfe2ff, 1)); orb.scale.set(0.9, 0.9, 1); scene.add(orb);
  const orb2 = new THREE.Sprite(addMat(glowTex, 0x3c6dff, 0.6)); orb2.scale.set(2.2, 2.2, 1); scene.add(orb2);
  bolts.push({ from: from.clone(), to: to.clone(), t: 0, travel: 0.16, life: 0.55, core, glow, br1, br2, orb, orb2, onHit, hitDone: false });
  sound.bolt();
}
function updateBolts(dt) {
  for (let i = bolts.length - 1; i >= 0; i--) { const b = bolts[i]; b.t += dt; const f = Math.min(1, b.t / b.travel);
    const head = b.from.clone().lerp(b.to, f);
    const pts = jagged(b.from, head, SEG, 0.8);
    updateRibbon(b.core, pts, 0.02, true); updateRibbon(b.glow, pts, 0.14, true);
    const mid = Math.floor(SEG * 0.4); const bp = pts[mid]; const bend = head.clone().sub(bp).multiplyScalar(0.35).add(new THREE.Vector3(rnd(-0.6, 0.6), rnd(-0.6, 0.6), rnd(-0.6, 0.6)));
    updateRibbon(b.br1, jagged(bp, bp.clone().add(bend), 17, 1.2), 0.01);
    const bp2 = pts[Math.floor(SEG * 0.7)]; updateRibbon(b.br2, jagged(bp2, bp2.clone().add(new THREE.Vector3(rnd(-0.7, 0.7), rnd(-0.7, 0.4), rnd(-0.7, 0.7))), 17, 1.2), 0.008);
    b.orb.position.copy(head); b.orb2.position.copy(head);
    const fade = b.t < b.travel ? 1 : Math.max(0, 1 - (b.t - b.travel) / (b.life - b.travel));
    const flick = 0.6 + Math.random() * 0.4;
    b.core.material.opacity = fade * flick; b.glow.material.opacity = 0.5 * fade * flick; b.br1.material.opacity = 0.8 * fade * Math.random(); b.br2.material.opacity = 0.7 * fade * Math.random();
    b.orb.material.opacity = fade; b.orb2.material.opacity = 0.6 * fade; b.orb.scale.setScalar(0.6 + (1 - fade) * 1.4);
    boltLight.position.copy(head); boltLight.intensity = 9 * fade * flick;
    if (f >= 1 && !b.hitDone) { b.hitDone = true; b.onHit && b.onHit(b.to); sparks(b.to, 0xbcd6ff, 40); shake = 0.35; }
    if (b.t > b.life) { [b.core, b.glow, b.br1, b.br2, b.orb, b.orb2].forEach(m => { scene.remove(m); m.geometry && m.geometry.dispose(); m.material.dispose(); }); bolts.splice(i, 1); if (!bolts.length) boltLight.intensity = 0; }
  }
}

// small crackling arcs around the casting hand
const arcs = [];
function handArc(at) {
  const m = new THREE.Mesh(boltRibbonGeo(9), new THREE.MeshBasicMaterial({ map: ribbonTex, color: 0xcfe0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.frustumCulled = false; scene.add(m); const a = at.clone().add(new THREE.Vector3(rnd(-0.05, 0.05), rnd(-0.05, 0.05), rnd(-0.05, 0.05)));
  const b = at.clone().add(new THREE.Vector3(rnd(-0.14, 0.14), rnd(-0.1, 0.16), rnd(-0.14, 0.14)));
  arcs.push({ m, a, b, t: 0 });
}
function updateArcs(dt) { for (let i = arcs.length - 1; i >= 0; i--) { const r = arcs[i]; r.t += dt; updateRibbon(r.m, jagged(r.a, r.b, 9, 2), 0.004); r.m.material.opacity = Math.max(0, 0.9 - r.t * 8);
  if (r.t > 0.12) { scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); arcs.splice(i, 1); } } }

// ---------- sparks / smoke ----------
const sparkSys = [];
function sparks(at, color, n, speed = 4, life = 0.8, size = 0.06) {
  const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), v = [];
  for (let i = 0; i < n; i++) { p.set([at.x, at.y, at.z], i * 3); v.push(new THREE.Vector3(rnd(-1, 1), rnd(-0.3, 1.2), rnd(-1, 1)).normalize().multiplyScalar(rnd(0.3, 1) * speed)); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size, map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false; scene.add(pts); sparkSys.push({ pts, v, t: 0, life });
}
function updateSparks(dt) {
  for (let i = sparkSys.length - 1; i >= 0; i--) { const s = sparkSys[i]; s.t += dt; const p = s.pts.geometry.attributes.position;
    for (let k = 0; k < s.v.length; k++) { s.v[k].y -= 6 * dt; s.v[k].multiplyScalar(0.985); p.setXYZ(k, p.getX(k) + s.v[k].x * dt, Math.max(0.02, p.getY(k) + s.v[k].y * dt), p.getZ(k) + s.v[k].z * dt); }
    p.needsUpdate = true; s.pts.material.opacity = Math.max(0, 1 - s.t / s.life);
    if (s.t > s.life) { scene.remove(s.pts); s.pts.geometry.dispose(); s.pts.material.dispose(); sparkSys.splice(i, 1); } }
}

// ---------- fire (Vas Flam + demon fireball) ----------
const fires = [];
function flameColumn(at) {
  const grp = new THREE.Group(); grp.position.copy(at); grp.position.y = 0; scene.add(grp);
  const sprites = []; for (let i = 0; i < 26; i++) { const s = new THREE.Sprite(addMat(fTex, i % 3 ? 0xff7a2a : 0xffc070, 0.9)); s.position.set(rnd(-0.5, 0.5), rnd(0, 3.5), rnd(-0.5, 0.5) + 0.6); s.scale.set(1.3, 2.6, 1); grp.add(s); sprites.push({ s, v: rnd(2.5, 5), ph: rnd(0, 6) }); }
  const glow = new THREE.Sprite(addMat(glowTex, 0xff5a1a, 0.7)); glow.scale.set(4.5, 7, 1); glow.position.set(0, 2.2, 0.6); grp.add(glow);
  fires.push({ grp, sprites, glow, t: 0, life: 1.9 }); sparks(at.clone().add(new THREE.Vector3(0, 0.3, 0.6)), 0xff7a2a, 60, 3.5, 1.4, 0.07); sound.boom(0.9); sound.whoosh();
}
function updateFires(dt) {
  let maxI = 0;
  for (let i = fires.length - 1; i >= 0; i--) { const f = fires[i]; f.t += dt; const k = f.t / f.life; const amp = Math.sin(Math.min(1, k) * Math.PI);
    f.sprites.forEach(o => { o.s.position.y += o.v * dt; if (o.s.position.y > 4.2) o.s.position.y = rnd(0, 0.4); o.s.material.opacity = amp * (0.6 + 0.4 * Math.sin(f.t * 20 + o.ph)); o.s.scale.set(1.4 * (1 - o.s.position.y / 6), 2.6 * (1 - o.s.position.y / 7), 1); });
    f.glow.material.opacity = 0.7 * amp; maxI = Math.max(maxI, amp); fireLight.position.copy(f.grp.position).add(new THREE.Vector3(0, 1.5, 0));
    if (f.t > f.life) { scene.remove(f.grp); fires.splice(i, 1); } }
  const fb = fireball; if (fb) { maxI = Math.max(maxI, 0.8); fireLight.position.copy(fb.s.position); }
  fireLight.intensity = 45 * maxI * (0.8 + Math.random() * 0.2);
}
let fireball = null;
function launchFireball() {
  const from = demon.root.position.clone().add(new THREE.Vector3(-0.9, 3.2, 0.6));
  const tgt = new THREE.Vector3(); camera.getWorldPosition(tgt);
  const s = new THREE.Sprite(addMat(glowTex, 0xc8400f, 0.9)); s.scale.set(0.9, 0.9, 1); s.position.copy(from); scene.add(s);
  const s2 = new THREE.Sprite(addMat(glowTex, 0xffd9a0, 1)); s2.scale.set(0.3, 0.3, 1); s.add(s2);
  fireball = { s, vel: tgt.sub(from).normalize().multiplyScalar(6.5), t: 0 }; sound.whoosh();
}
function updateFireball(dt) {
  if (!fireball) return; const f = fireball; f.t += dt; f.s.position.addScaledVector(f.vel, dt);
  sparks(f.s.position, 0xff6a20, 4, 0.7, 0.6, 0.07); f.s.material.rotation += dt * 6; f.s.scale.setScalar(0.8 + Math.random() * 0.25);
  const head = new THREE.Vector3(); camera.getWorldPosition(head);
  if (f.s.position.distanceTo(head) < 0.6) { scene.remove(f.s); fireball = null; playerHurt(Math.round(rnd(10, 16))); sound.boom(0.7); return; }
  if (f.t > 3 || f.s.position.y < 0.1) { sparks(f.s.position, 0xff6a20, 25); sound.boom(0.4); scene.remove(f.s); fireball = null; }
}
let hurtFlash = 0;
function playerHurt(n) {
  player.hp = Math.max(0, player.hp - n); hurtFlash = 1; shake = 0.5; setBars(); log(`The daemon's fire burns you for ${n}.`, '#e07a5a');
  if (player.casting) { fizzle(); }
  if (player.hp <= 0) { log('You are near death. The circle restores you.', '#e07a5a'); player.hp = 100; setBars(); }
}
function fizzle() {
  const sp = player.casting; player.casting = null; player.mana = Math.max(0, player.mana - Math.round(sp.mana / 2)); setBars();
  sound.fizzle(); const hp = handPos(); sparks(hp, 0x888899, 20, 0.8, 1.0, 0.08); log('The spell fizzles.', '#b0a89a');
  floatText('*fizzle*', hp.clone().add(new THREE.Vector3(0, 0.25, 0)), '#9a9a9a', 0.6);
}

// ---------- casting ----------
function beginCast(id, heard) {
  const sp = SPELLS[id]; if (!sp) return;
  if (player.casting) return;
  if (player.mana < sp.mana) { log('Insufficient mana for ' + sp.name + '.', '#9fb8e8'); return; }
  player.casting = sp; player.castT = 0; sp.id = id;
  const cam = new THREE.Vector3(), dir = new THREE.Vector3(); camera.getWorldPosition(cam); camera.getWorldDirection(dir);
  floatText(sp.words, cam.clone().addScaledVector(dir, 1.6).add(new THREE.Vector3(0, 0.35, 0)), '#f2d27a', 0.9);
  sound.castStart(sp.time);
  log(`You begin casting ${sp.name}${heard ? ` (heard: “${heard.trim()}”)` : ''}.`);
}
function finishCast() {
  const sp = player.casting; player.casting = null; player.mana -= sp.mana; setBars();
  const tgt = resolveTarget(); const from = handPos();
  if (sp.id === 'corp') {
    spawnBolt(from, tgt.point, () => { if (tgt.demon) damageDemon(Math.round(rnd(...sp.dmg)), 'Energy Bolt'); });
  } else {
    const at = tgt.demon ? demon.root.position.clone() : tgt.point.clone();
    flameColumn(at); if (tgt.demon) setTimeout(() => damageDemon(Math.round(rnd(...sp.dmg)), 'Flame Strike'), 250);
  }
}
function damageDemon(n, src) {
  if (!demon.alive) return;
  demon.hp = Math.max(0, demon.hp - n); demon.hitT = 1; demon.flash = 1; demon.flashCol = src === 'Energy Bolt' ? [0.04, 0.07, 0.2] : [0.25, 0.08, 0.0];
  floatText(String(n), demonCenter().add(new THREE.Vector3(rnd(-0.4, 0.4), 1.0, 0.4)), src === 'Energy Bolt' ? '#cfe0ff' : '#ffb070', 0.8);
  sound.roar(0.7, 1.25); log(`${src} hits the daemon for ${n}. (${demon.hp}/${demon.max})`, '#cfe0ff');
  if (demon.state === 'windup') { demon.state = 'idle'; demon.attackT = 0; demon.nextAttack = 3.5; }
  if (demon.hp <= 0) { demon.alive = false; demon.state = 'dying'; demon.deathT = 0; sound.roar(2.4, 0.8); log('The daemon is slain.', '#f2d27a'); }
}

// ---------- voice ----------
let talking = false;
const voice = new Voice({
  onSpell: (id, heard) => beginCast(id, heard),
  // Show what was heard and what it was matched to, e.g. “corpse” → Corp Por
  onText: (t, final, src) => { if (src === 'status') { if (talking) return; voiceLine = t; }
    else voiceLine = '“' + t.trim() + '”' + (voiceMatched ? ' → ' + voiceMatched : '');
    $('voiceText').textContent = voiceLine; vrHudDirty = true; },
  onMatch: (t, words) => { if (words) voiceMatched = words; else if (voiceMatched) return;
    voiceLine = '“' + t.trim() + '” → ' + (words || 'no spell, try “Corp Por”'); $('voiceText').textContent = voiceLine; vrHudDirty = true; },
  onState: (on) => { $('micdot').classList.toggle('on', on); },
});
let voiceMatched = '';
function startTalk() { if (talking) return; talking = true; voiceMatched = ''; sound.resume(); voiceLine = 'Listening…'; $('voiceText').textContent = voiceLine; $('cross').classList.add('on'); voice.start(); vrHudDirty = true; }
function stopTalk() { if (!talking) return; talking = false; $('cross').classList.remove('on'); voice.stop(); vrHudDirty = true; }

// ---------- desktop controls ----------
let yaw = 0, pitch = 0; const keys = {};
let started = false;
renderer.domElement.addEventListener('click', () => { if (started && !renderer.xr.isPresenting && !CAPTURE) renderer.domElement.requestPointerLock?.(); });
addEventListener('mousemove', (e) => { if (document.pointerLockElement === renderer.domElement) { yaw -= e.movementX * 0.0022; pitch = THREE.MathUtils.clamp(pitch - e.movementY * 0.0022, -1.2, 1.2); } });
addEventListener('mousedown', (e) => { if (e.button === 2 && started) startTalk(); });
addEventListener('mouseup', (e) => { if (e.button === 2) stopTalk(); });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('keydown', (e) => { keys[e.code] = true; if (!started) return;
  if (e.code === 'Space' && !e.repeat) { e.preventDefault(); startTalk(); }
  if (e.code === 'Digit1') beginCast('corp'); if (e.code === 'Digit2') beginCast('flam'); });
addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'Space') stopTalk(); });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

function enter() { if (started) return; started = true; if (!CAPTURE) voice.prepare(); sound.init(); sound.resume(); $('intro').classList.add('hidden'); $('hud').classList.remove('hidden'); setBars(); log('A daemon stirs in the circle. Speak the words.', '#c9c1b0'); }
$('btnDesktop').onclick = () => { enter(); if (!CAPTURE) renderer.domElement.requestPointerLock?.(); };
manager.onLoad = () => { $('loadstate').textContent = 'Ready. Voice: ' + voice.label() + '.'; };
const vrb = VRButton.createButton(renderer, { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] }); $('vrslot').appendChild(vrb); vrb.addEventListener('click', () => enter(), true);
renderer.xr.addEventListener('sessionstart', () => { enter(); hudPanel.visible = true; camera.position.set(0, 0, 0); deskGlow.visible = false; $('hud').classList.add('hidden'); renderer.xr.setFoveation(1); });
renderer.xr.addEventListener('sessionend', () => { hudPanel.visible = false; camera.position.set(0, 1.68, 0); deskGlow.visible = true; $('hud').classList.remove('hidden'); });

// ---------- loop ----------
let shake = 0; const clock = new THREE.Clock(); let T = 0;
function pollGamepads(dt) {
  const sess = renderer.xr.getSession(); if (!sess) return;
  for (const h of hands) { const gp = h.src && h.src.gamepad; if (!gp) continue;
    const a = gp.buttons[4] && gp.buttons[4].pressed, b = gp.buttons[5] && gp.buttons[5].pressed;
    if (a && !h.btnA) { activeHand = h; beginCast('corp'); } if (b && !h.btnB) { activeHand = h; beginCast('flam'); } h.btnA = a; h.btnB = b;
    const ax = gp.axes || []; const x = ax[2] || 0, y = ax[3] || 0;
    if (h.handed === 'left' && (Math.abs(x) > 0.15 || Math.abs(y) > 0.15)) { // smooth locomotion, head-relative
      const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; f.normalize(); const r = new THREE.Vector3(-f.z, 0, f.x);
      rig.position.addScaledVector(f, -y * 1.8 * dt).addScaledVector(r, x * 1.8 * dt); }
    if (h.handed === 'right') { if (Math.abs(x) > 0.7 && !h.snapped) { rig.rotation.y -= Math.sign(x) * Math.PI / 6; h.snapped = true; } if (Math.abs(x) < 0.3) h.snapped = false; }
  }
}
function tick() {
  const dt = Math.min(0.05, clock.getDelta()); T += dt; step(dt); renderer.render(scene, camera);
}
function step(dt) {
  // desktop move/look
  if (!renderer.xr.isPresenting) {
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    const f = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), r = new THREE.Vector3(-f.z, 0, f.x); const sp = 2.4 * dt;
    if (keys.KeyW) rig.position.addScaledVector(f, sp); if (keys.KeyS) rig.position.addScaledVector(f, -sp);
    if (keys.KeyD) rig.position.addScaledVector(r, sp); if (keys.KeyA) rig.position.addScaledVector(r, -sp);
    if (shake > 0) { camera.rotation.x += (Math.random() - 0.5) * shake * 0.03; camera.rotation.y += (Math.random() - 0.5) * shake * 0.03; }
  } else pollGamepads(dt);
  rig.position.x = THREE.MathUtils.clamp(rig.position.x, -W / 2 + 0.8, W / 2 - 0.8); rig.position.z = THREE.MathUtils.clamp(rig.position.z, -5.5, Z0 - 0.6);
  shake = Math.max(0, shake - dt * 1.5);
  // torches
  for (const t of torches) { const n = Math.sin(T * 13 + t.ph) * 0.5 + Math.sin(T * 7.3 + t.ph * 2) * 0.3 + Math.random() * 0.25; t.light.intensity = t.base * (0.82 + n * 0.18); t.s1.scale.set(0.3 + n * 0.03, 0.55 + n * 0.08, 1); t.s2.material.opacity = 0.3 + n * 0.06; }
  pitLight.intensity = 9 + Math.sin(T * 3.1) * 1.5 + Math.random() * 0.8; circleMat.opacity = 0.42 + Math.sin(T * 1.7) * 0.1 + (demon.alive ? 0 : -0.25);
  layoutChains(T);
  // dust + embers drift
  { const p = dust.geometry.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) + Math.sin(T + i) * 0.0015 - 0.002; if (y < 0) y = 5.5; p.setY(i, y); } p.needsUpdate = true; }
  { const p = embers.geometry.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) + dt * (0.4 + (i % 5) * 0.15); if (y > 4.2) { y = 0; p.setX(i, DEMON_HOME.x + rnd(-1.6, 1.6)); p.setZ(i, demon.root.position.z + rnd(-1.6, 1.6)); } p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(T * 2 + i) * 0.003); } p.needsUpdate = true; }
  // casting
  const hp = handPos();
  const castK = player.casting ? Math.min(1, player.castT / player.casting.time) : 0;
  handLight.position.copy(hp); handLight.intensity = castK * 6 + (talking ? 0.6 : 0);
  deskGlow.material.opacity = castK * 0.75 + (talking ? 0.08 : 0); deskGlow.scale.setScalar(0.05 + castK * 0.07 + Math.random() * 0.015);
  if (player.casting && Math.random() < 0.35) handArc(hp);
  for (const h of hands) { h.glow.material.opacity = h === activeHand ? castK * 0.9 + (talking ? 0.15 : 0) : 0; h.ray.material.opacity = (h === activeHand && (talking || player.casting)) ? 0.25 : 0.05; }
  if (player.casting) { player.castT += dt; if (Math.random() < 0.5) sparks(hp, 0xa8c8ff, 1, 0.4, 0.4, 0.03); if (player.castT >= player.casting.time) finishCast(); }
  player.mana = Math.min(100, player.mana + dt * 2.2); if (Math.random() < 0.05) setBars();
  // demon
  if (demon.ready) {
    demon.hitT = Math.max(0, demon.hitT - dt * 2.5); demon.flash = Math.max(0, (demon.flash || 0) - dt * 3);
    { const c = demon.flashCol || [0, 0, 0]; demon.mat.emissive.setRGB(c[0] * demon.flash, c[1] * demon.flash, c[2] * demon.flash); }
    const cam = new THREE.Vector3(); camera.getWorldPosition(cam);
    if (demon.alive) {
      const want = Math.atan2(cam.x - demon.root.position.x, cam.z - demon.root.position.z); demon.root.rotation.y += (want - demon.root.rotation.y) * Math.min(1, dt * 1.5);
      demon.root.position.x = DEMON_HOME.x + Math.sin(T * 0.3) * 0.6;
      if (demon.state === 'idle') { demon.nextAttack -= dt; demon.attackPose = Math.max(0, (demon.attackPose || 0) - dt * 3); if (demon.nextAttack <= 0 && (!CAPTURE_HOLD || demon.force)) { demon.force = false; demon.state = 'windup'; demon.attackT = 0; sound.roar(1.5, 1); } }
      else if (demon.state === 'windup') { demon.attackT += dt; demon.attackPose = Math.min(1, demon.attackT / 0.9); if (demon.attackT > 1.0) { launchFireball(); demon.state = 'idle'; demon.nextAttack = rnd(6, 9); } }
      demon.deathPose = 0;
      if (demon.rising) { demon.root.position.y = Math.min(0, demon.root.position.y + dt * 1.9); if (Math.random() < 0.6) sparks(demon.root.position.clone().setY(0.2), 0xff5a20, 4, 2, 1.0, 0.07); if (demon.root.position.y >= 0) demon.rising = 0; }
    } else {
      demon.deathT += dt; const k = Math.min(1, demon.deathT / 1.4); demon.deathPose = k;
      demon.root.rotation.x = Math.pow(k, 2.2) * 1.42; demon.root.position.y = -k * 0.08; demon.root.position.z = DEMON_HOME.z + Math.pow(k, 2) * 0.4;
      const fadeK = THREE.MathUtils.clamp((demon.deathT - 3.4) / 1.8, 0, 1); demon.mat.transparent = fadeK > 0; demon.mat.opacity = 1 - fadeK; demon.mat.depthWrite = fadeK < 0.5;
      if (demon.deathT > 3.2 && Math.random() < 0.4) sparks(demon.root.position.clone().add(new THREE.Vector3(0, 0.3, 1.2)), 0xff5a20, 3, 1.2, 1.2, 0.06);
      demonTag.visible = false; eyeL.material.opacity = Math.max(0, 0.9 - k);
      if (demon.deathT > 7.5) { // rise again
        demon.alive = true; demon.hp = demon.max; demon.state = 'idle'; demon.nextAttack = 5; demon.root.rotation.x = 0; demon.root.position.y = -3.4; demon.root.position.z = DEMON_HOME.z; demon.rising = 1; demon.mat.opacity = 1; demon.mat.transparent = false; demon.mat.depthWrite = true; demonTag.visible = true; eyeL.material.opacity = 0.9;
        sound.roar(1.8, 0.9); log('Another daemon claws its way out of the circle.', '#d23b2a'); sparks(demon.root.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xff5a20, 60, 3, 1.5);
      }
    }
    poseDemon(T, dt);
    const eyeFlick = 0.75 + Math.random() * 0.25; if (demon.alive) eyeL.material.opacity = 0.9 * eyeFlick;
  }
  updateBolts(dt); updateArcs(dt); updateSparks(dt); updateFires(dt); updateFireball(dt);
  for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i]; f.t += dt; f.s.position.y += dt * 0.35; f.s.material.opacity = Math.max(0, 1 - Math.max(0, f.t - 1.0) / 0.8); if (f.t > 1.8) { scene.remove(f.s); floaters.splice(i, 1); } }
  hurtFlash = Math.max(0, hurtFlash - dt * 2.4); hurtSphere.material.opacity = hurtFlash * 0.3;
  document.body.style.setProperty('--hurt', hurtFlash);
  tal.userData.gs.material.opacity = 0.3 + Math.sin(T * 2) * 0.08; tal.position.y = Math.sin(T * 1.2) * 0.004;
  if (renderer.xr.isPresenting && (vrHudDirty || Math.random() < 0.05)) drawVrHud();
}
let CAPTURE_HOLD = false;
renderer.setAnimationLoop(CAPTURE ? null : tick);

// ---------- capture / test hooks ----------
window.__demo = {
  THREE, scene, camera, rig, demon, player,
  enter, cast: beginCast,
  hear(text) { startTalk(); voice._handle(text, false); setTimeout(() => stopTalk(), 600); },
  look(y, p) { yaw = y; pitch = p; },
  hold(v) { CAPTURE_HOLD = v; }, attack() { demon.nextAttack = 0; demon.force = true; },
  aimAt(dx = 0, dy = 0) { const c = new THREE.Vector3(); camera.getWorldPosition(c); const d = demonCenter().sub(c); yaw = Math.atan2(-d.x, -d.z) + dx; pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)) + dy; },
  step(dt) { T += dt; step(dt); renderer.render(scene, camera); },
  talk(on) { on ? startTalk() : stopTalk(); }, voice,
  simTalk(on) { talking = on; $('micdot').classList.toggle('on', on); $('cross').classList.toggle('on', on); if (on) { voiceLine = 'Listening…'; $('voiceText').textContent = voiceLine; } },
  simWords(text) { voiceLine = '“' + text + '”'; $('voiceText').textContent = voiceLine; const sp = detectSpell(text); if (sp) beginCast(sp.id, text); },
  hearFinal(text) { startTalk(); voice._handle(text, true, 'test'); setTimeout(() => stopTalk(), 300); },
  ready: () => demon.ready && $('loadstate').textContent.startsWith('Ready'),
};
