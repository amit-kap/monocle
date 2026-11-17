// One style for every feature card (art3d.js, art-line.js, art-frames.js).
// Colours come from the --art-* variables in art.css; the numbers below are the rest of the look. Change them here only.
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

export const STYLE = {
  LINE: 1,               // every outline and rail, in CSS px
  OUTLINE_MIX: .17,      // outlines sit this far from the card colour towards the ink colour
  BAR_OPACITY: .35,      // the grey bars that stand for text
  MARK_OPACITY: .35,     // the agent icons
  MARK_DIM_OPACITY: .13, // the lighter shape inside the OpenCode icon
  RAIL_Y: -0.01,         // rails sit just under the objects, the white track just under the rails
  TRACK_Y: -0.03,
};

// Render at 2x or more; the lines are real screen-space lines (not GL hairlines), so they stay crisp at any scale.
export const PR = Math.min(Math.max(devicePixelRatio || 1, 2), 3);

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

// The current theme as three.js colours. `line` is the outline colour; `brass` is only for the accent that is left.
export function readTheme() {
  const card = new THREE.Color(css("--art-bg")), ink = new THREE.Color(css("--art-ink"));
  return {
    card, ink,
    folder: new THREE.Color(css("--art-folder")),   // the grey fill of objects
    track: new THREE.Color(css("--art-track")),     // the belt between the rails
    hot: new THREE.Color(css("--art-hot")),         // hover highlight
    brass: new THREE.Color(css("--brass")),
    line: card.clone().lerp(ink, STYLE.OUTLINE_MIX),
  };
}

// A screen-space line material; pass a list to have it kept up to date on resize.
export function lineMaterial(registry, width = STYLE.LINE) {
  const m = new LineMaterial({ linewidth: width * PR, worldUnits: false, alphaToCoverage: true });
  if (registry) registry.push(m);
  return m;
}
export const resizeLines = (registry, w, h) => registry.forEach((m) => m.resolution.set(w * PR, h * PR));

// Outline of a geometry's edges.
export const edgeLines = (geo, mat, threshold = 1) =>
  new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(geo, threshold)), mat);

// Opaque fill that lets its own outline show on top.
export const fillMaterial = () => new THREE.MeshBasicMaterial({ polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
export const barMaterial = () => new THREE.MeshBasicMaterial({ transparent: true, opacity: STYLE.BAR_OPACITY });

// Two rails along z at x = ±half, with the white track between them.
export function addBelt(scene, half, length, railMat, trackMat) {
  const track = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, length * 2), trackMat);
  track.rotation.x = -Math.PI / 2; track.position.y = STYLE.TRACK_Y; scene.add(track);
  [-1, 1].forEach((s) => scene.add(new LineSegments2(
    new LineSegmentsGeometry().setPositions([s * half, STYLE.RAIL_Y, -length, s * half, STYLE.RAIL_Y, length]), railMat)));
}
