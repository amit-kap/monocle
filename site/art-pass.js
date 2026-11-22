// "Hand it back": pages ride a belt through the agent's gate. Before it they are plain grey lines; after it one line is brass,
// the one the agent changed. Same belt, shadows and brass as the other cards, running along x like card 2. Built live with three.js.
import * as THREE from "three";
import { PR, readTheme, lineMaterial, resizeLines, edgeLines, fillMaterial, addBelt, shadowTexture } from "./art-style.js";

const host = document.getElementById("art-pass");
if (host) (() => {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (_) { return; }
  renderer.setPixelRatio(PR); renderer.localClippingEnabled = true;   // the scan: a line is grey behind the gate and brass past it
  const cv = renderer.domElement; cv.style.cssText = "display:block;width:100%;height:100%";
  host.replaceChildren(cv);

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -300, 300);
  cam.position.set(20, 20, 20); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();

  const col = { ink: new THREE.Color(), brass: new THREE.Color(), grey: new THREE.Color() };
  const scanMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: .1, side: THREE.DoubleSide, depthWrite: false });   // the gate's scanning layer
  const lineMats = [], lm = () => lineMaterial(lineMats);
  const fillMat = fillMaterial(), railMat = lm(), lineMat = lm(), trackMat = new THREE.MeshBasicMaterial();
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, opacity: .26, depthWrite: false });
  const contactMat = shadowMat.clone(); contactMat.opacity = .36;
  function theme() {
    const th = readTheme();
    col.ink.copy(th.ink); col.brass.copy(th.brass); scanMat.color.copy(th.brass);
    fillMat.color.copy(th.folder); railMat.color.copy(th.line); lineMat.color.copy(th.line); trackMat.color.copy(th.track);
    shadowMat.color.copy(th.ink); contactMat.color.copy(th.ink);
  }

  const RAIL = 8.4, T = .9, PL = 15, PD = 9, GAP = 7, P = PL + GAP, N = 5, W = .32, TITLE = .72;   // page: PL along the belt, PD across it
  addBelt(scene, RAIL, 150, railMat, trackMat, "x");

  const box = (w, h, d, x, y, z) => {
    const geo = new THREE.BoxGeometry(w, h, d), g = new THREE.Group();
    g.add(new THREE.Mesh(geo, fillMat), edgeLines(geo, lineMat)); g.position.set(x, y, z); scene.add(g); return g;
  };
  function pill(w, h) {
    const r = Math.min(w, h) / 2, x = w / 2, y = h / 2, sh = new THREE.Shape();
    sh.moveTo(-x + r, -y); sh.lineTo(x - r, -y); sh.absarc(x - r, -y + r, r, -Math.PI / 2, 0, false);
    sh.lineTo(x, y - r); sh.absarc(x - r, y - r, r, 0, Math.PI / 2, false);
    sh.lineTo(-x + r, y); sh.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI, false);
    sh.lineTo(-x, -y + r); sh.absarc(-x + r, -y + r, r, Math.PI, Math.PI * 1.5, false);
    return new THREE.ShapeGeometry(sh, 10);
  }
  const shadow = (parent, w, d, y0 = .02) => [[w + 3, d + 2.4, shadowMat], [w + .8, d + .8, contactMat]].forEach(([sw, sd, m], k) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(sw, sd), m); s.rotation.x = -Math.PI / 2; s.position.y = y0 + k * .005; s.renderOrder = -1; parent.add(s);
  });

  // The gate (the agent) at x = 0: it straddles the belt, its two legs standing outside the rails and a beam across the top.
  const GATE_W = 1.8, GH = 9.5, GZ = RAIL + 1.3, LEG = 1.6;
  box(GATE_W, GH, LEG, 0, GH / 2, -GZ); box(GATE_W, GH, LEG, 0, GH / 2, GZ); box(GATE_W, 1.6, GZ * 2 + LEG, 0, GH + .8, 0);

  // A thin scanning layer hangs between the legs, across the whole opening; pages pass through it at 10% opacity.
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(GZ * 2 - LEG, GH), scanMat);
  scan.rotation.y = Math.PI / 2; scan.position.set(0, GH / 2, 0); scan.renderOrder = 2; scene.add(scan);

  // The pages: a slab with a title and two lines of text; one of the three lines goes brass after the gate.
  // A different line pattern on each page: [z across the page, length, weight, x start]. A title is the thick one.
  const PATTERNS = [
    [[-1.5, 8, TITLE, 1.5], [.1, 11, W, 1.5], [.8, 7.5, W, 1.5]],                                          // a title and two lines
    [[-1.6, 11.5, W, 1.5], [-.8, 9, W, 1.5], [0, 12, W, 1.5], [.8, 6, W, 1.5]],                            // four lines of text
    [[-1.7, 6, TITLE, 1.5], [-.3, 12, W, 1.5], [.4, 12, W, 1.5], [1.1, 4.5, W, 1.5]],                      // a short title, a paragraph, a short last line
    [[-1.2, 5.5, W, 1.5], [-1.2, 5.5, W, 8.2], [-.4, 5.5, W, 1.5], [-.4, 5.5, W, 8.2], [.4, 5.5, W, 1.5], [.4, 5.5, W, 8.2]],   // two columns
    [[-.9, 10, TITLE, 1.5], [.7, 13, W, 1.5]],                                                             // a title and one line
  ];
  const pages = [];
  for (let i = 0; i < N; i++) {
    const g = new THREE.Group(); scene.add(g);
    const slab = new THREE.Group(), geo = new THREE.BoxGeometry(PL, T, PD);
    slab.add(new THREE.Mesh(geo, fillMat), edgeLines(geo, lineMat)); slab.position.y = T / 2; g.add(slab);
    shadow(g, PL, PD);
    // Each line is drawn twice, in the same place: grey (kept only behind the gate, x < 0) and brass (kept only past it, x > 0).
    // The page's changed line shows both, so the colour changes along it exactly where the scan sheet cuts it; the other lines stay grey.
    const marks = PATTERNS[i % PATTERNS.length].map(([z, len, w, x0]) => {
      const geo = pill(len, w), px = -PL / 2 + x0 + len / 2;
      const plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1e6);               // constant 1e6 keeps the whole line; 0 keeps only x < 0
      const greyMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: .35, side: THREE.DoubleSide, clippingPlanes: [plane] });
      const brassMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: .95, side: THREE.DoubleSide, clippingPlanes: [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)] });
      const grey = new THREE.Mesh(geo, greyMat), brass = new THREE.Mesh(geo, brassMat);
      [grey, brass].forEach((m) => { m.rotation.x = -Math.PI / 2; m.position.set(px, T + .02, z); g.add(m); });
      brass.visible = false;
      return { plane, greyMat, brassMat, brass };
    });
    pages.push({ g, marks, i });
  }

  // Frame a fixed window on the belt, the mirror of card 1's.
  const win = new THREE.Box3(new THREE.Vector3(-14, 0, -11), new THREE.Vector3(14, 11, 11));
  const inv = cam.matrixWorldInverse; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const v = new THREE.Vector3();
  for (let i = 0; i < 8; i++) { v.set(i & 1 ? win.max.x : win.min.x, i & 2 ? win.max.y : win.min.y, i & 4 ? win.max.z : win.min.z).applyMatrix4(inv); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  const bw = x1 - x0, bh = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  function size() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); resizeLines(lineMats, w, h);
    const vh = Math.max(bh, bw / (w / h)), vw = vh * (w / h);
    cam.left = cx - vw / 2; cam.right = cx + vw / 2; cam.top = cy + vh / 2; cam.bottom = cy - vh / 2; cam.updateProjectionMatrix();
  }

  // A steady flow, as in card 2. Each page's changed line is the one its number picks, so a different line goes brass each time.
  const SPEED = 6.4, span = N * P, grey = new THREE.Color();
  function pose(time) {
    const travel = time * SPEED;
    pages.forEach((p, i) => {
      const lap = Math.floor((i * P + travel) / span);             // how many times this page has wrapped round
      const x = (((i * P + travel) % span) + span) % span - span / 2;   // the page's centre
      p.g.position.x = x;
      p.marks.forEach((m, k) => {
        const on = k === (p.i + lap) % p.marks.length;                      // each page keeps its own changed line for the whole pass
        m.plane.constant = on ? 0 : 1e6;                       // the changed line's grey is cut at the gate (keeps x < 0); the rest are left whole
        m.brass.visible = on;
        m.greyMat.color.copy(col.ink); m.brassMat.color.copy(col.brass);
      });
    });
  }
  const paint = () => { theme(); pose(clock); renderer.render(scene, cam); };

  theme(); size();
  let raf = 0, t0 = 0, clock = 1.2;
  new ResizeObserver(() => { size(); if (!raf) paint(); }).observe(host);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", paint); addEventListener("themechange", paint);
  paint();
  if (still) return;
  const loop = (n) => { if (!t0) t0 = n - clock * 1000; clock = (n - t0) / 1000; pose(clock); renderer.render(scene, cam); raf = requestAnimationFrame(loop); };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !raf) raf = requestAnimationFrame(loop);
    else if (!e.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; t0 = 0; }
  }, { threshold: 0.1 }).observe(host);
})();
