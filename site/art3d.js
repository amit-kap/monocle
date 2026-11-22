// "Edits that stay valid Markdown": a page split into slabs, built live with three.js.
// Blocks reorder themselves: one rises, flashes brass, slides over its neighbour (which slides under it into the gap), lands and goes grey.
import * as THREE from "three";
import { STYLE, PR, readTheme, lineMaterial, resizeLines, edgeLines, fillMaterial, barMaterial, addBelt, shadowTexture } from "./art-style.js";

(() => {
  const host = document.getElementById("art-blocks");
  if (!host) return; // if the module fails to load, the SVG inside stays as the fallback
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (_) { return; }
  // Render at 2x or more; the lines are real screen-space lines (not GL hairlines), so they stay crisp at any scale.
  renderer.setPixelRatio(PR);
  const lineMats = [];
  const lineMat = () => lineMaterial(lineMats);
  const cv = renderer.domElement;
  cv.style.cssText = "display:block;width:100%;height:100%";
  const fallback = host.querySelector("svg"); if (fallback) fallback.style.display = "none";
  host.append(cv);

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 200);
  cam.position.set(20, 20, 20); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();

  // Colours come from art-style.js, so every card looks the same.
  const col = { line: new THREE.Color(), lineHot: new THREE.Color(), fill: new THREE.Color(), bar: new THREE.Color(), brass: new THREE.Color() };
  const trackMat = new THREE.MeshBasicMaterial();
  function theme() {
    const th = readTheme();
    col.fill.copy(th.folder); col.line.copy(th.line); col.lineHot.copy(th.hot); col.bar.copy(th.ink); col.brass.copy(th.brass);
    trackMat.color.copy(th.track); railMat.color.copy(th.line);
  }

  const T = 0.9, X = 18, FLAT = 0.02, LIFT = 2.6, BUMP = 0.9, GAP = 0.8;
  const slabs = [];
  // The same fake shadow as the other cards (light from above): two soft layers on the belt under each block. They stay on the belt
  // when the block lifts, and fade and spread a little with the height.
  const shadowTex = shadowTexture(), SHADOW = [[.26, 3.2, 2.4], [.36, .8, .8]];   // opacity, extra width, extra depth (past the block's footprint)
  // Page coordinates: x along the page, y down it, z up. Three.js is y-up, so (x, y, z) -> (x, z, y).
  function slab(depth) {
    const g = new THREE.Group();
    const box = new THREE.BoxGeometry(X, T, depth);
    const fillMat = fillMaterial();
    const fill = new THREE.Mesh(box, fillMat);
    const edgeMat = lineMat();
    const edges = edgeLines(box, edgeMat);
    const top = new THREE.Group(); top.position.y = T / 2 + FLAT;
    g.add(fill, edges, top);
    scene.add(g);
    const shadow = new THREE.Group(); scene.add(shadow);
    const shadowMats = SHADOW.map(([op, ew, ed], k) => {
      const m = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: op, depthWrite: false });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(X + ew, depth + ed), m);
      p.rotation.x = -Math.PI / 2; p.position.y = .02 + k * .005; p.renderOrder = -1; shadow.add(p); return m;
    });
    const s = { g, top, shadow, shadowMats, fill, fillMat, edgeMat, depth, barMat: Object.assign(barMaterial(), { opacity: .9 }),
      hover: 0, hoverTarget: 0, lift: 0, fl: 0, eb: 0, bb: 0, z: 0 };
    slabs.push(s); return s;
  }
  // The marks are brass pills: flat bars with fully rounded ends.
  function pill(w, h) {
    const r = Math.min(w, h) / 2, x = w / 2, y = h / 2, sh = new THREE.Shape();
    sh.moveTo(-x + r, -y); sh.lineTo(x - r, -y); sh.absarc(x - r, -y + r, r, -Math.PI / 2, 0, false);
    sh.lineTo(x, y - r); sh.absarc(x - r, y - r, r, 0, Math.PI / 2, false);
    sh.lineTo(-x + r, y); sh.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI, false);
    sh.lineTo(-x, -y + r); sh.absarc(-x + r, -y + r, r, Math.PI, Math.PI * 1.5, false);
    return new THREE.ShapeGeometry(sh, 10);
  }
  const W = .32, TITLE = .72;   // two weights: text, and a bigger one for a title
  function bar(s, x0, x1, yy, w = W) {
    const p = new THREE.Mesh(pill(x1 - x0, w), s.barMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(-X / 2 + (x0 + x1) / 2, 0, -s.depth / 2 + yy);
    s.top.add(p); return p;
  }
  function vbar(s, xx, y0, y1, w = W) {
    const p = new THREE.Mesh(pill(w, y1 - y0), s.barMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(-X / 2 + xx, 0, -s.depth / 2 + (y0 + y1) / 2);
    s.top.add(p); return p;
  }
  // Every block is the same size (D deep, X wide); its marks are centred in it.
  const D = 5.4, M = D / 2;
  const heading = slab(D); bar(heading, 1.2, 10.5, M, TITLE);           // a title: the one block that is a single line
  const list = slab(D);                                                   // a bulleted list: a dot and a line, three times
  [M - .7, M, M + .7].forEach((y, i) => { bar(list, 1.2, 1.2 + W, y); bar(list, 2.5, [9.5, 12, 7.5][i], y); });
  const quote = slab(D);                                                  // a block quote: a rule down the left, two lines of text
  vbar(quote, 1.3, M - 1.1, M + 1.1); bar(quote, 2.6, 13.8, M - .5); bar(quote, 2.6, 9.4, M + .5);
  const code = slab(D);                                                   // a title, then two lines of text close together
  bar(code, 1.2, 9, M - 1.3, TITLE); bar(code, 1.2, 12.4, M + .1); bar(code, 1.2, 8, M + .8);

  // Two 1px rails run past the blocks, along the direction they slide, across the whole frame.
  const railMat = lineMat();
  addBelt(scene, X / 2 + 1.6, 120, railMat, trackMat);

  // Slot centres for a given order, along the page.
  const TOTAL = slabs.reduce((n, s) => n + s.depth, 0) + GAP * (slabs.length - 1);
  function slots(order) {
    const out = new Map(); let y = 0;
    order.forEach((s) => { out.set(s, y + s.depth / 2 - TOTAL / 2); y += s.depth + GAP; });
    return out;
  }
  const home = [heading, list, quote, code];

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
    resizeLines(lineMats, w, h);
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
      s.fillMat.color.copy(col.fill);
      s.edgeMat.color.copy(col.line).lerp(col.lineHot, s.hover);
      s.barMat.color.copy(col.brass);
      const h = clamp(s.lift + s.hover * BUMP / LIFT);   // how far the block is off the belt, 0 to 1
      s.shadow.position.set(0, 0, s.z); s.shadow.scale.set(1 + .08 * h, 1, 1 + .12 * h);
      s.shadowMats.forEach((m, k) => { m.color.copy(col.bar); m.opacity = SHADOW[k][0] * (1 - .55 * h); });
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
  addEventListener("themechange", () => { theme(); draw(); });
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
