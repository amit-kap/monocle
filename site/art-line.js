// "Your agents' files, in one place": folders ride an assembly line. Each one stops in the centre of the frame,
// three files drop into it from above, and it rides on while the next folder arrives. Built live with three.js.
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

const host = document.getElementById("art-files");
if (host) (() => {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PR = Math.min(Math.max(devicePixelRatio || 1, 2), 3);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (_) { return; }
  renderer.setPixelRatio(PR);
  const cv = renderer.domElement; cv.style.cssText = "display:block;width:100%;height:100%";
  host.replaceChildren(cv);

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -300, 300);
  cam.position.set(20, 20, 20); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();

  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const col = { fill: new THREE.Color(), line: new THREE.Color(), tie: new THREE.Color(), bar: new THREE.Color(), brass: new THREE.Color() };
  const lineMats = [];
  const lm = (w) => { const m = new LineMaterial({ linewidth: w * PR, worldUnits: false, alphaToCoverage: true }); lineMats.push(m); return m; };
  const fillMat = new THREE.MeshBasicMaterial({ polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const barMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: .5 });
  const railMat = lm(1), tieMat = lm(.75);
  const markMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: .55, side: THREE.DoubleSide });
  const markDim = new THREE.MeshBasicMaterial({ transparent: true, opacity: .2, side: THREE.DoubleSide });
  function theme() {
    const panel = new THREE.Color(css("--bg-soft")), text = new THREE.Color(css("--text"));
    col.brass.set(css("--brass")); col.fill.copy(panel); col.line.copy(panel).lerp(text, .17); col.tie.copy(panel).lerp(text, .08); col.bar.copy(text);
    fillMat.color.copy(col.fill); barMat.color.copy(col.bar); markMat.color.copy(col.bar); markDim.color.copy(col.bar); railMat.color.copy(col.line); tieMat.color.copy(col.tie);
  }
  const edges = (geo, mat) => new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(geo, 1)), mat);
  function box(parent, w, h, d, x, y, z, mat, fill = fillMat) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const g = new THREE.Group(); g.add(new THREE.Mesh(geo, fill), edges(geo, mat)); g.position.set(x, y, z); parent.add(g); return g;
  }

  // Simplified stand-ins for the three agents' marks, drawn as flat shapes on a file (swap in the official artwork if you have it).
  const T2 = Math.PI * 2;
  function mark(kind) {
    const g = new THREE.Group(); g.rotation.x = -Math.PI / 2;                 // draw in x/y, lying on the file
    const add = (geo, x = 0, y = 0, rot = 0) => { const m = new THREE.Mesh(geo, barMat); m.position.set(x, y, 0); m.rotation.z = rot; g.add(m); return m; };
    if (kind === "claude") {                                                   // a burst of rays
      const len = [1.15, .8, 1.0, .72, 1.1, .78, 1.05, .7, 1.12, .82, .98, .74];
      len.forEach((L, i) => { const a = (i / 12) * T2 + .1; add(new THREE.PlaneGeometry(L, .2), Math.cos(a) * (.3 + L / 2), Math.sin(a) * (.3 + L / 2), a); });
    } else if (kind === "chatgpt") {                                           // six interlocked petals
      for (let i = 0; i < 6; i++) { const a = (i / 6) * T2; const e = add(new THREE.RingGeometry(.5, .6, 48), Math.cos(a) * .5, Math.sin(a) * .5, a); e.scale.set(1.55, .8, 1); }
    } else {                                                                   // a square frame around a block
      const sh = new THREE.Shape(); sh.moveTo(-1.05, -1.05); sh.lineTo(1.05, -1.05); sh.lineTo(1.05, 1.05); sh.lineTo(-1.05, 1.05); sh.closePath();
      const hole = new THREE.Path(); hole.moveTo(-.72, -.72); hole.lineTo(-.72, .72); hole.lineTo(.72, .72); hole.lineTo(.72, -.72); hole.closePath(); sh.holes.push(hole);
      add(new THREE.ShapeGeometry(sh)); add(new THREE.PlaneGeometry(.8, .8));
    }
    return g;
  }

  // The line: two rails and cross-ties, running along z.
  const RAIL = 6.9, P = 14, N = 7, SCALE = 1.4;   // folders are 40% bigger, with wide gaps between them
  [-1, 1].forEach((s) => scene.add(new LineSegments2(new LineSegmentsGeometry().setPositions([s * RAIL, -0.01, -150, s * RAIL, -0.01, 150]), railMat)));
  const TIE = P / 2, tiePts = [];
  for (let z = -70; z <= 70; z += TIE) tiePts.push(-RAIL, -0.01, z, RAIL, -0.01, z);
  const ties = new LineSegments2(new LineSegmentsGeometry().setPositions(tiePts), tieMat); scene.add(ties);

  // The folders (an open tray with a back wall, a tab and a left wall) and the three files each will receive.
  const folders = [], KINDS = ["openai", "claude", "opencode"];   // the order the top file cycles through: ChatGPT, Claude, OpenCode
  for (let i = 0; i < N; i++) {
    const g = new THREE.Group(), em = lm(.75), fm = fillMat.clone(); scene.add(g); g.scale.setScalar(SCALE);
    box(g, 7, .3, 6.4, 0, .15, 0, em, fm); box(g, 7, 1.8, .25, 0, 1.2, -3.075, em, fm); box(g, 2.6, .5, .25, -2.2, 2.35, -3.075, em, fm); box(g, .25, 1.2, 6.4, -3.375, .9, 0, em, fm);
    const sheets = [0, 1, 2].map((k) => {
      const mat = lm(.75), sf = fillMat.clone(), s = box(g, 5.2, .22, 3.6, 0, 9, 0, mat, sf);   // dropped straight on top of one another
      const holders = {};                                                                      // each file can carry any of the three marks
      KINDS.forEach((kd) => { const h = new THREE.Group(); h.position.set(0, .13, 0); h.visible = false; const m = mark(kd === "openai" ? "chatgpt" : kd); m.scale.setScalar(.7); h.add(m); s.add(h); holders[kd] = h; });
      return { g: s, mat, fm: sf, rest: .42 + k * .3, holders };
    });
    folders.push({ g, em, fm, sheets });
  }

  // The real artwork: the agents' SVGs (assets/agents/) become flat shapes on the files. The stand-ins above stay if they can't load.
  const MARK_SIZE = { claude: 2.2, openai: 2, opencode: 2.2 };
  const svgLoader = new SVGLoader();
  async function loadMark(kind) {
    const data = svgLoader.parse(await (await fetch(`assets/agents/${kind}.svg`)).text());
    const art = new THREE.Group();
    data.paths.forEach((p, i) => SVGLoader.createShapes(p).forEach((sh) => art.add(new THREE.Mesh(new THREE.ShapeGeometry(sh), kind === "opencode" && i === 0 ? markDim : markMat))));
    const b = new THREE.Box3().setFromObject(art), k = MARK_SIZE[kind] / Math.max(b.max.x - b.min.x, b.max.y - b.min.y);
    art.scale.set(k, -k, k); art.position.set(-(b.min.x + b.max.x) / 2 * k, (b.min.y + b.max.y) / 2 * k, 0);   // centre it; SVG y points down
    const flat = new THREE.Group(); flat.rotation.x = -Math.PI / 2; flat.add(art);
    folders.forEach((f) => f.sheets.forEach((s) => { s.holders[kind].clear(); s.holders[kind].add(flat.clone()); }));
  }
  const artwork = Promise.all(KINDS.map((kind) => loadMark(kind).catch(() => {})));

  // Frame a fixed window on the line so the folders enter and leave off the card.
  const win = new THREE.Box3(new THREE.Vector3(-7, 0, -13), new THREE.Vector3(7, 9, 13));
  const inv = cam.matrixWorldInverse; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const v = new THREE.Vector3();
  for (let i = 0; i < 8; i++) { v.set(i & 1 ? win.max.x : win.min.x, i & 2 ? win.max.y : win.min.y, i & 4 ? win.max.z : win.min.z).applyMatrix4(inv); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  const bw = x1 - x0, bh = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  function size() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); lineMats.forEach((m) => m.resolution.set(w * PR, h * PR));
    const vh = Math.max(bh, bw / (w / h)), vw = vh * (w / h);
    cam.left = cx - vw / 2; cam.right = cx + vw / 2; cam.top = cy + vh / 2; cam.bottom = cy - vh / 2; cam.updateProjectionMatrix();
  }

  // One cycle: ride one pitch (MOVE), then three files drop into the folder together (HOLD). The moment all three are in, the
  // folder and its files are painted brass; at full brass the folder rides on to the next stop, fading back to grey on the way.
  const MOVE = 1.0, HOLD = .95, CYCLE = MOVE + HOLD, FALL = 26;
  const clamp = (x) => Math.min(1, Math.max(0, x));
  const ease = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeIn = (x) => x * x;
  const recv = (c) => (((2 - c) % N) + N) % N;                           // the folder that stops at the centre at the end of cycle c's ride
  const SPEED = .8;                                                       // 25% slower than before
  function pose(time) {
    time *= SPEED;
    const c = Math.floor(time / CYCLE), t = time - c * CYCLE;
    const travel = (c + ease(clamp(t / MOVE))) * P, drop = t - MOVE, span = N * P;
    const r = recv(c), leaving = recv(c - 1);
    folders.forEach((f, i) => {
      const z = (((i * P + travel) % span) + span) % span - 3 * P;
      f.g.position.z = z;
      const arriving = i === r;
      // brass paint: 0 while waiting upstream, up once the files are in, down again as it rides on
      const paint = arriving ? (drop >= 0 ? ease(clamp((drop - .7) / .25)) : 0) : i === leaving ? 1 - ease(clamp(t / MOVE)) : 0;
      if (arriving) f.sheets.forEach((s, k) => KINDS.forEach((kd, j) => (s.holders[kd].visible = j === (c + k + 1) % 3)));   // the top file (k = 2) shows ChatGPT, then Claude, then OpenCode
      f.sheets.forEach((s, k) => {
        s.g.visible = arriving ? drop >= 0 : z > -.05;
        let y = s.rest;
        if (arriving && drop >= 0) y = s.rest + (1 - easeIn(clamp((drop - k * .08) / .5))) * FALL;   // all three at once, a hair apart
        s.g.position.y = y;
        s.mat.color.copy(col.line).lerp(col.brass, paint); s.fm.color.copy(col.fill).lerp(col.brass, paint * .22);
      });
      f.fm.color.copy(col.fill).lerp(col.brass, paint * .55);
      f.em.color.copy(col.line).lerp(col.brass, paint);
    });
    ties.position.z = (travel % TIE);
  }
  function drawStill() {
    folders.forEach((f) => f.sheets.forEach((s, k) => KINDS.forEach((kd, j) => (s.holders[kd].visible = j === (k + 1) % 3)))); // the settled frame: one folder at the station, its files in
    folders.forEach((f, i) => { f.g.position.z = (((i * P) % (N * P)) - 3 * P); f.em.color.copy(col.line); f.fm.color.copy(col.fill); f.sheets.forEach((s) => { s.g.visible = f.g.position.z > -.05; s.g.position.y = s.rest; s.mat.color.copy(col.line); s.fm.color.copy(col.fill); }); });
    renderer.render(scene, cam);
  }

  theme(); size();
  new ResizeObserver(() => { size(); if (still || !raf) still ? drawStill() : (pose(clock), renderer.render(scene, cam)); }).observe(host);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { theme(); still ? drawStill() : (pose(clock), renderer.render(scene, cam)); });
  artwork.then(() => { if (!raf) (still ? drawStill() : (pose(clock), renderer.render(scene, cam))); });
  let raf = 0, t0 = 0, clock = MOVE + .6;   // first frame: a folder at rest with its files in
  if (still) { drawStill(); return; }
  pose(clock); renderer.render(scene, cam);
  const loop = (n) => { if (!t0) t0 = n - clock * 1000; clock = (n - t0) / 1000; pose(clock); renderer.render(scene, cam); raf = requestAnimationFrame(loop); };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !raf) raf = requestAnimationFrame(loop);
    else if (!e.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; t0 = 0; }
  }, { threshold: 0.1 }).observe(host);
})();
