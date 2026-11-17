// The other three feature images, drawn live with three.js as still frames (no animation).
// Same camera, hairline outlines, card-coloured fills and rails as the animated "blocks" image.
import * as THREE from "three";
import { PR, readTheme, lineMaterial, resizeLines, edgeLines, fillMaterial, barMaterial, addBelt } from "./art-style.js";


function stage(host, build) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (_) { return; }
  renderer.setPixelRatio(PR);
  const cv = renderer.domElement; cv.style.cssText = "display:block;width:100%;height:100%";
  const scene = new THREE.Scene(), content = new THREE.Group(); scene.add(content);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 200);
  cam.position.set(20, 20, 20); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();

  const lineMats = [];
  const M = {
    fill: fillMaterial(), bar: barMaterial(), track: new THREE.MeshBasicMaterial(),
    line: lineMaterial(lineMats), rail: lineMaterial(lineMats),
  };
  function theme() {
    const th = readTheme();
    M.fill.color.copy(th.folder); M.bar.color.copy(th.ink); M.track.color.copy(th.track);
    M.line.color.copy(th.line); M.rail.color.copy(th.line);
  }
  const edges = edgeLines;

  const api = {
    // A box centred at (x, y, z). Option noFill: outline only.
    box(w, h, d, x, y, z, o = {}) {
      const g = new THREE.Group(), geo = new THREE.BoxGeometry(w, h, d);
      if (!o.noFill) g.add(new THREE.Mesh(geo, M.fill));
      g.add(edges(geo, M.line));
      g.position.set(x, y, z); g.userData = { w, h, d }; content.add(g); return g;
    },
    // A flat bar on the top face of a box: x from x0 to x1, centred at depth z, w thick.
    barTop(g, x0, x1, z, w) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, w), M.bar);
      p.rotation.x = -Math.PI / 2; p.position.set((x0 + x1) / 2, g.userData.h / 2 + .02, z); g.add(p); return p;
    },
    // A flat bar on the front (+z) face of a box.
    barFront(g, x0, x1, y, h) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, h), M.bar);
      p.position.set((x0 + x1) / 2, y, g.userData.d / 2 + .02); g.add(p); return p;
    },
    // A ring standing with its axis along x (a lens in a bezel).
    ring(x, y, z, R, r, t, o = {}) {
      const s = new THREE.Shape(); s.absarc(0, 0, R, 0, Math.PI * 2, false);
      const hole = new THREE.Path(); hole.absarc(0, 0, r, 0, Math.PI * 2, true); s.holes.push(hole);
      const geo = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 64 });
      geo.translate(0, 0, -t / 2); geo.rotateY(Math.PI / 2);
      const g = new THREE.Group(); g.add(new THREE.Mesh(geo, M.fill), edges(geo, M.line, 30));
      g.position.set(x, y, z); content.add(g); return g;
    },
  };
  build(api);

  addBelt(scene, api.rail, 120, M.rail, M.track);   // two rails with the white belt between them

  // Frame the content, centred in the card.
  scene.updateMatrixWorld(true);
  const inv = cam.matrixWorldInverse, v = new THREE.Vector3();
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const b = new THREE.Box3();
  content.children.forEach((c) => {
    b.setFromObject(c);
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(inv);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
  });
  const bw = x1 - x0, bh = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  function draw() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); resizeLines(lineMats, w, h);
    const vh = Math.max(bh * 1.2, bw * 1.2 / (w / h)), vw = vh * (w / h);
    cam.left = cx - vw / 2; cam.right = cx + vw / 2; cam.top = cy + vh / 2; cam.bottom = cy - vh / 2; cam.updateProjectionMatrix();
    theme(); renderer.render(scene, cam);
  }
  host.replaceChildren(cv);
  new ResizeObserver(draw).observe(host);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
  addEventListener("themechange", draw);
  draw();
}

// 1. Your agents' files, in one place: drawn and animated in art-line.js.

// 2. Plain files, nothing in between: one sheet, read by the app (a lens) and by an agent (a cube).
const plain = document.getElementById("art-plain");
if (plain) stage(plain, (a) => {
  a.rail = 15;
  const s = a.box(10, .35, 13, 0, 3.4, 0);
  [[1.2, 8.4, -4.5], [1.2, 6.2, -2.7], [1.2, 8.8, -.9], [1.2, 5.4, .9], [1.2, 7.6, 2.7], [1.2, 4.4, 4.5]].forEach(([p, q, z]) => a.barTop(s, p - 5, q - 5, z, .5));
  a.box(3.2, .3, 3.2, -11.5, .15, 0); a.box(.5, 1.2, .5, -11.5, .9, 0); a.ring(-11.5, 4.4, 0, 3.4, 2.7, .5, {});   // the lens
  a.box(4.5, 4.5, 4.5, 11.5, 2.25, 0);                                                                                       // the agent
});

// 3. Set it up your way: one page, re-dressed: a page, a column, a tree with a cursor.
const theme = document.getElementById("art-theme");
if (theme) stage(theme, (a) => {
  a.rail = 17;
  a.box(15, .6, 8, 3, .3, 0);                                                                       // base
  const page = a.box(11, 14, .5, 3, 7.6, 0, {});                                        // the tinted page
  [[-4, 3.5, 5.6], [-4, 4.4, 4.6], [-4, 2.6, 3.8], [-4, 4.4, 3], [-4, 3.2, 2.2], [-4, 4.4, 1.4], [-4, 1.8, .6]].forEach(([p, q, y]) => a.barFront(page, p, q, y * 1.3 - 3.6, .5));
  const tree = a.box(9, .4, 7.4, -12.5, .2, 3.6);                                                    // the tree
  [-2.2, 0, 2.2].forEach((z, i) => a.barTop(tree, -3.4, [2, 3, 1.6][i], z, .6));
  a.box(8, .5, 1.7, -12.5, .65, 3.6, { noFill: true });                                 // the row cursor
});
