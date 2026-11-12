// "Edits that stay valid Markdown": a page split into slabs, built live with three.js.
// Blocks reorder themselves: one rises, flashes brass, slides over its neighbour (which slides under it into the gap), lands and goes grey.
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

(() => {
  const host = document.getElementById("art-blocks");
  if (!host) return; // if the module fails to load, the SVG inside stays as the fallback
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (_) { return; }
  // Render at 2x or more; the lines are real screen-space lines (not GL hairlines), so they stay crisp at any scale.
  const PR = Math.min(Math.max(devicePixelRatio || 1, 2), 3);
  renderer.setPixelRatio(PR);
  const lineMats = [];
  const lineMat = () => { const m = new LineMaterial({ linewidth: 0.75 * PR, worldUnits: false, alphaToCoverage: true }); lineMats.push(m); return m; };
  const edgeLines = (geo, m) => new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(geo)), m);
  const cv = renderer.domElement;
  cv.style.cssText = "display:block;width:100%;height:100%";
  const fallback = host.querySelector("svg"); if (fallback) fallback.style.display = "none";
  host.append(cv);

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 200);
  cam.position.set(20, 20, 20); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();

  // Colours follow the page theme: low-contrast hairlines on a lightly tinted fill, brass for the block in motion.
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const C = (v) => new THREE.Color(css(v));
  const col = { line: new THREE.Color(), lineHot: new THREE.Color(), fill: new THREE.Color(), bar: new THREE.Color(), brass: new THREE.Color() };
  function theme() {
    const panel = C("--bg-soft"), text = C("--text");
    col.brass.set(css("--brass"));
    col.fill.copy(panel); // blocks are the card's own colour: pure outlines that still hide what's behind them
    col.line.copy(panel).lerp(text, .17); // sampled from the reference renders: outlines sit ~17% of the way from the card colour to the text colour
    col.lineHot.copy(text);
    railMat.color.copy(col.line);
    col.panel = col.panel || new THREE.Color(); col.panel.copy(panel);
    col.bar.copy(text);
  }

  const T = 0.9, X = 18, FLAT = 0.02, LIFT = 2.6, BUMP = 0.9, GAP = 0.8;
  const slabs = [];
  // Page coordinates: x along the page, y down it, z up. Three.js is y-up, so (x, y, z) -> (x, z, y).
  function slab(depth) {
    const g = new THREE.Group();
    const box = new THREE.BoxGeometry(X, T, depth);
    const fillMat = new THREE.MeshBasicMaterial({ polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const fill = new THREE.Mesh(box, fillMat);
    const edgeMat = lineMat();
    const edges = edgeLines(box, edgeMat);
    const top = new THREE.Group(); top.position.y = T / 2 + FLAT;
    g.add(fill, edges, top);
    scene.add(g);
    const s = { g, top, fill, fillMat, edgeMat, depth, barMat: new THREE.MeshBasicMaterial({ transparent: true, opacity: .5 }),
      hover: 0, hoverTarget: 0, lift: 0, fl: 0, eb: 0, bb: 0, z: 0 };
    slabs.push(s); return s;
  }
  function bar(s, x0, x1, yy, w) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, w), s.barMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(-X / 2 + (x0 + x1) / 2, 0, -s.depth / 2 + yy);
    s.top.add(p); return p;
  }
  function vbar(s, xx, y0, y1, w) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, y1 - y0), s.barMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(-X / 2 + xx, 0, -s.depth / 2 + (y0 + y1) / 2);
    s.top.add(p); return p;
  }
  function rod(s, p, q) {
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(L, .3), s.barMat);
    m.rotation.set(-Math.PI / 2, 0, 0); m.rotateZ(-Math.atan2(q[1] - p[1], q[0] - p[0]));
    m.position.set(-X / 2 + (p[0] + q[0]) / 2, 0, -s.depth / 2 + (p[1] + q[1]) / 2);
    s.top.add(m);
  }

  const heading = slab(3); bar(heading, 1.2, 10.5, 1.5, .9);
  const todo = slab(4);
  [1.1, 2.9].forEach((y) => bar(todo, 1.2, 3.0, y, .14));
  [1.2, 3.0].forEach((x) => vbar(todo, x, 1.1, 2.9, .14));
  rod(todo, [1.5, 2.05], [2.0, 2.6]); rod(todo, [2.0, 2.6], [2.85, 1.45]);
  bar(todo, 4.3, 13.5, 2, .5);
  const table = slab(6);
  [.8, 3, 5.2].forEach((y) => bar(table, 1, 17, y, .1));
  [1, 6.33, 11.67, 17].forEach((x) => vbar(table, x, .8, 5.2, .1));
  [[1.8, 4.6], [7.1, 10.2], [12.4, 15.5]].forEach(([a, b]) => { bar(table, a, b, 1.9, .3); bar(table, a, b - .6, 4.1, .3); });
  const code = slab(5.6);
  [[1.6, 9, 1.2], [3.2, 12.4, 2.6], [3.2, 8, 4]].forEach(([a, b, y]) => bar(code, a, b, y, .45));

  // Two 1px rails run past the blocks, along the direction they slide, across the whole frame.
  const railMat = lineMat(); railMat.linewidth = 1 * PR;
  [-1, 1].forEach((side) => {
    const geo = new LineSegmentsGeometry().setPositions([side * (X / 2 + 1.6), -0.01, -120, side * (X / 2 + 1.6), -0.01, 120]);
    scene.add(new LineSegments2(geo, railMat));
  });

  // Slot centres for a given order, along the page.
  const TOTAL = slabs.reduce((n, s) => n + s.depth, 0) + GAP * (slabs.length - 1);
  function slots(order) {
    const out = new Map(); let y = 0;
    order.forEach((s) => { out.set(s, y + s.depth / 2 - TOTAL / 2); y += s.depth + GAP; });
    return out;
  }
  const home = [heading, todo, table, code];

  // Frame the page centred on its resting pose, with room above for a lifted block.
  function extent(lift) {
    const p = slots(home); slabs.forEach((s) => { s.g.position.set(0, T / 2 + lift, p.get(s)); }); scene.updateMatrixWorld(true);
    const inv = cam.matrixWorldInverse, v = new THREE.Vector3();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    slabs.forEach((s) => {
      const b = new THREE.Box3().setFromObject(s.g);
      for (let i = 0; i < 8; i++) {
        v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(inv);
        x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      }
    });
    return { x0, x1, y0, y1 };
  }
  const bounds = (() => {
    const rest = extent(0), up = extent(LIFT);
    const cx = (rest.x0 + rest.x1) / 2, cy = (rest.y0 + rest.y1) / 2;
    return { cx, cy, w: 2 * Math.max(cx - Math.min(rest.x0, up.x0), Math.max(rest.x1, up.x1) - cx), h: 2 * Math.max(cy - Math.min(rest.y0, up.y0), Math.max(rest.y1, up.y1) - cy) };
  })();
  function size() {
    const w = host.clientWidth, h = host.clientHeight, aspect = w / h, pad = 1.22;
    renderer.setSize(w, h, false);
    lineMats.forEach((m) => m.resolution.set(w * PR, h * PR));
    const vh = Math.max(bounds.h * pad, bounds.w * pad / aspect), vw = vh * aspect;
    cam.left = bounds.cx - vw / 2; cam.right = bounds.cx + vw / 2; cam.top = bounds.cy + vh / 2; cam.bottom = bounds.cy - vh / 2;
    cam.updateProjectionMatrix();
  }
  new ResizeObserver(() => { size(); draw(); }).observe(host);

  // The reorder loop. Each step: rise, flash brass, slide over the neighbour (which slides under, into the gap), land, go grey.
  const ease = (x) => x * x * (3 - 2 * x);
  const clamp = (x) => Math.min(1, Math.max(0, x));
  const ramp = (t, a, b) => clamp((t - a) / (b - a));
  const STEP = 4.4, SPEED = 1.69;
  const PAIRS = [[1, 2], [0, 1], [2, 3], [1, 2], [2, 3], [0, 1]];
  let cache = { step: 0, order: home.slice() };
  function plan(step) {
    if (step < cache.step) cache = { step: 0, order: home.slice() };
    while (cache.step < step) { const [a, b] = PAIRS[cache.step % PAIRS.length]; const o = cache.order.slice(); [o[a], o[b]] = [o[b], o[a]]; cache = { step: cache.step + 1, order: o }; }
    const [a, b] = PAIRS[step % PAIRS.length];
    const from = cache.order, to = from.slice(); [to[a], to[b]] = [to[b], to[a]];
    const flip = step % 2 === 1;                       // alternate which of the pair does the lifting
    return { from, to, mover: from[flip ? b : a] };
  }
  function pose(now) {
    now *= SPEED; // 1.69x: two 30% speed-ups
    const step = Math.floor(now / STEP), t = now - step * STEP;
    const { from, to, mover } = plan(step);
    const a = slots(from), b = slots(to);
    const slide = ease(ramp(t, 1.15, 2.0));
    slabs.forEach((s) => {
      s.z = a.get(s) + (b.get(s) - a.get(s)) * slide;
      const mv = s === mover;
      s.lift = mv ? ease(ramp(t, 0, .5)) - ease(ramp(t, 2.0, 2.6)) : 0;
      // the block is painted brass as it rises and stays brass until it lands
      s.fl = mv ? ease(ramp(t, .15, .55)) - ease(ramp(t, 2.0, 2.6)) : 0;   // painted brass while it moves, grey again once it lands
      s.bb = s.fl;
      s.eb = mv ? ease(ramp(t, 0, .4)) - ease(ramp(t, 2.0, 2.6)) : 0;
    });
  }
  function draw() {
    slabs.forEach((s) => {
      s.hover += (s.hoverTarget - s.hover) * 0.2;
      s.g.position.set(0, T / 2 + s.lift * LIFT + s.hover * BUMP, s.z);
      s.fillMat.color.copy(col.fill).lerp(col.brass, clamp(s.fl) * 0.7);
      s.edgeMat.color.copy(col.line).lerp(col.lineHot, s.hover).lerp(col.brass, clamp(s.eb));
      s.barMat.color.copy(col.bar);
      s.barMat.opacity = .5 + .3 * clamp(s.bb);
    });
    renderer.render(scene, cam);
  }

  // Hovering a block bumps it up a little.
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  function hover(e) {
    const r = cv.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, cam);
    const hit = ray.intersectObjects(slabs.map((s) => s.fill), false)[0];
    const hs = hit && slabs.find((s) => s.fill === hit.object);
    slabs.forEach((s) => (s.hoverTarget = s === hs ? 1 : 0));
  }

  theme(); size();
  const rest = () => { const p = slots(home); slabs.forEach((s) => { s.z = p.get(s); s.lift = s.fl = s.eb = s.bb = 0; }); };
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { theme(); draw(); });
  rest(); draw();

  if (still) { rest(); draw(); return; }
  cv.addEventListener("pointermove", hover);
  cv.addEventListener("pointerleave", () => slabs.forEach((s) => (s.hoverTarget = 0)));
  let raf = 0, t0 = 0;
  const loop = (n) => { if (!t0) t0 = n; pose((n - t0) / 1000); draw(); raf = requestAnimationFrame(loop); };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !raf) { rest(); draw(); raf = requestAnimationFrame(loop); }
    else if (!e.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; t0 = 0; }
  }, { threshold: 0.1 }).observe(host);
})();
