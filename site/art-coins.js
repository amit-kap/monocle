// "Know what it costs the context window": the card-1 assembly line, mirrored. Coins stand on the belt, faces turned
// sideways to its direction, and ride past one after the other, stopping and starting in the same rhythm. Built live with three.js.
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { PR, STYLE, readTheme, lineMaterial, resizeLines, edgeLines, fillMaterial, addBelt } from "./art-style.js";

const host = document.getElementById("art-tokens");
if (host) (() => {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (_) { return; }
  renderer.setPixelRatio(PR);
  const cv = renderer.domElement; cv.style.cssText = "display:block;width:100%;height:100%";
  host.replaceChildren(cv);

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -300, 300);
  cam.position.set(20, 20, 20); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();

  const lineMats = [], lm = (w) => lineMaterial(lineMats, w);
  const fillMat = fillMaterial(), railMat = lm(), lineMat = lm(1), trackMat = new THREE.MeshBasicMaterial();
  function theme() {
    const th = readTheme();
    fillMat.color.copy(th.folder); railMat.color.copy(th.line); lineMat.color.copy(th.line); trackMat.color.copy(th.track);
    paintMark("#" + th.brass.getHexString()); shadowMat.color.copy(th.ink); contactMat.color.copy(th.ink);
  }
  // A fake shadow, light straight above: a soft blob on the belt under each coin (a radial fade, squashed to an ellipse).
  const shCv = Object.assign(document.createElement("canvas"), { width: 128, height: 128 });
  { const c = shCv.getContext("2d"), g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.3, "rgba(255,255,255,.7)"); g.addColorStop(.65, "rgba(255,255,255,.22)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.fillRect(0, 0, 128, 128); }
  const shadowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shCv), transparent: true, opacity: .22, depthWrite: false });
  const contactMat = shadowMat.clone(); contactMat.opacity = .3;   // the dark spot right where the rim touches the belt
  // The ≈ painted on each face in the page's brass: one canvas texture, redrawn whenever the theme changes.
  const markCv = Object.assign(document.createElement("canvas"), { width: 256, height: 256 });
  const markTex = new THREE.CanvasTexture(markCv); markTex.colorSpace = THREE.SRGBColorSpace; markTex.anisotropy = 8;
  const markMat = new THREE.MeshBasicMaterial({ map: markTex, transparent: true, opacity: .95, depthWrite: false });
  function paintMark(brass) {
    const c = markCv.getContext("2d"); c.clearRect(0, 0, 256, 256);
    c.fillStyle = brass; c.font = '600 210px "Helvetica Neue", Helvetica, Arial, sans-serif'; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("≈", 128, 128);
    markTex.needsUpdate = true;
  }

  // The belt runs along x (card 1's runs along z); the rails sit at z = ±RAIL.
  const RAIL = 8.4, P = 15.8, N = 7, R = 4.8, T = .9;   // RAIL and the frame below match card 1, mirrored
  addBelt(scene, RAIL, 150, railMat, trackMat, "x");

  // A coin: a disc standing on its rim, axis across the belt (z), so its faces look sideways, with a raised inner disc on each face.
  const disc = (r, t) => { const g = new THREE.CylinderGeometry(r, r, t, 64); g.rotateX(Math.PI / 2); return g; };   // axis along z
  const coinGeo = disc(R, T), faceGeo = disc(R * .66, .12);
  // The reeded rim: short lines across its width, evenly around it (|||||||).
  const STRIPES = 56, reeds = [];
  for (let k = 0; k < STRIPES; k++) { const a = (k / STRIPES) * Math.PI * 2, x = Math.cos(a) * R * 1.004, y = Math.sin(a) * R * 1.004; reeds.push(x, y, -T / 2, x, y, T / 2); }
  const reedGeo = new LineSegmentsGeometry().setPositions(reeds);
  const coins = [];
  for (let i = 0; i < N; i++) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(coinGeo, fillMat), edgeLines(coinGeo, lineMat, 30), new LineSegments2(reedGeo, lineMat));
    [-1, 1].forEach((s) => { const f = new THREE.Group(); f.add(new THREE.Mesh(faceGeo, fillMat), edgeLines(faceGeo, lineMat, 30)); f.position.z = s * (T / 2 + .03); g.add(f);
      const d = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.2, R * 1.2), markMat); d.position.z = s * (T / 2 + .1); if (s < 0) d.rotation.y = Math.PI; g.add(d); });
    // From straight above, a standing disc throws a thin sliver: as long as it is tall, as wide as it is thick.
    [[R * 2.6, T * 4.2, shadowMat], [R * 1.1, T * 2.6, contactMat]].forEach(([w, d, m], k) => {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
      sh.rotation.x = -Math.PI / 2; sh.position.y = -R + .03 + k * .005; sh.renderOrder = -1; g.add(sh);
    });
    g.position.y = R; scene.add(g); coins.push(g);
  }

  // Frame a fixed window on the belt so the coins enter and leave off the card.
  const win = new THREE.Box3(new THREE.Vector3(-13, 0, -7), new THREE.Vector3(13, 9, 7));
  const inv = cam.matrixWorldInverse; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const v = new THREE.Vector3();
  for (let i = 0; i < 8; i++) { v.set(i & 1 ? win.max.x : win.min.x, i & 2 ? win.max.y : win.min.y, i & 4 ? win.max.z : win.min.z).applyMatrix4(inv); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  const bw = x1 - x0, bh = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  function size() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); resizeLines(lineMats, w, h);
    const vh = Math.max(bh, bw / (w / h)), vw = vh * (w / h);
    cam.left = cx - vw / 2; cam.right = cx + vw / 2; cam.top = cy + vh / 2; cam.bottom = cy - vh / 2; cam.updateProjectionMatrix();
  }

  // A steady flow, no pauses: one pitch every 2.4 s (about the average pace of card 1).
  const SPEED = P / 2.4, span = N * P;
  function pose(time) {
    const travel = time * SPEED;
    coins.forEach((g, i) => { g.position.x = (((i * P + travel) % span) + span) % span - span / 2; });
  }
  const paint = () => { theme(); pose(clock); renderer.render(scene, cam); };

  theme(); size();
  let raf = 0, t0 = 0, clock = 0;
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
