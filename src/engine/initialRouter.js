import * as THREE from 'three';
import { forwardKinematics, positionError, directionErrorDeg } from './slipOnRouter.js';
import { solveLM } from './lm.js';

/**
 * Two-step DESIGN-phase router.
 *
 *   Step 1 — Route:  choose a clean orthogonal path. All elbows are 90° and every
 *            spool runs along a principal axis, so the swivel angles land on
 *            multiples of 90° and the route looks like a tidy staircase.
 *   Step 2 — Lengths: with those clean bends frozen, adjust the spool lengths so
 *            the chain lands exactly on Flange B.
 *
 * (The continuous swivel solver is reserved for the misalignment phase, where
 * lengths are frozen and the swivels rotate off-90° to absorb a few mm.)
 *
 * Flange directions come from the UI as axis-aligned unit vectors (±X/±Y/±Z).
 */

function axisOf(v) {
  const a = [Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])];
  if (a[0] >= a[1] && a[0] >= a[2]) return 0;
  return a[1] >= a[2] ? 1 : 2;
}

function unitAxis(idx, sign) {
  const v = [0, 0, 0];
  v[idx] = sign >= 0 ? 1 : -1;
  return v;
}

/**
 * The swivel angle that turns axis-aligned `dir` into axis-aligned `newDir`
 * under the elbow model in slipOnRouter.js (perp0 = dir × Zref or dir × Xref,
 * rotated about dir by the angle; newDir = perp × dir).
 */
function swivelAngleFor(dirArr, newDirArr) {
  const dir = new THREE.Vector3(...dirArr).normalize();
  const newDir = new THREE.Vector3(...newDirArr).normalize();

  const perp0 = new THREE.Vector3();
  if (Math.abs(dir.z) < 0.9) perp0.crossVectors(dir, new THREE.Vector3(0, 0, 1)).normalize();
  else perp0.crossVectors(dir, new THREE.Vector3(1, 0, 0)).normalize();

  const perpT = new THREE.Vector3().crossVectors(dir, newDir).normalize(); // perp = dir × newDir
  const sin = new THREE.Vector3().crossVectors(perp0, perpT).dot(dir);
  const cos = perp0.dot(perpT);
  return Math.atan2(sin, cos);
}

export function initialOrthogonalRoute(flangeA, flangeB, dirA = [0, 0, 1], dirB = [0, 0, 1]) {
  const O = [flangeB[0] - flangeA[0], flangeB[1] - flangeA[1], flangeB[2] - flangeA[2]];
  const aA = axisOf(dirA);
  const aB = axisOf(dirB);
  const sgn = (k) => (O[k] >= 0 ? 1 : -1);

  // --- Step 1: clean axis-aligned direction sequence (6 spools, 5 × 90° bends) ---
  // Consecutive directions sit on different axes; the sequence visits all three
  // principal axes so any offset is reachable, with each leg signed toward the
  // target so the solved lengths stay positive.
  let dirs;
  if (aA !== aB) {
    const third = [0, 1, 2].find((a) => a !== aA && a !== aB);
    dirs = [
      dirA,
      unitAxis(aB, sgn(aB)),
      unitAxis(third, sgn(third)),
      unitAxis(aA, sgn(aA)),
      unitAxis(third, sgn(third)),
      dirB,
    ];
  } else {
    const [p, q] = [0, 1, 2].filter((a) => a !== aA);
    dirs = [
      dirA,
      unitAxis(p, sgn(p)),
      unitAxis(q, sgn(q)),
      unitAxis(aA, sgn(aA)),
      unitAxis(p, sgn(p)),
      dirB,
    ];
  }

  const anglesFromDirs = (ds) => {
    const a = [];
    for (let i = 0; i < 5; i++) a.push(swivelAngleFor(ds[i], ds[i + 1]));
    return a;
  };

  // --- Step 2: adjust spool lengths (stubs fixed) to land on Flange B ---
  const manh = Math.abs(O[0]) + Math.abs(O[1]) + Math.abs(O[2]);
  const stub = Math.min(0.5, Math.max(manh, 1.0) * 0.15);
  const MIN_LEN = 0.1;

  // Solve the 4 middle lengths; if a leg comes out negative, reverse that leg's
  // axis-aligned direction (still a clean 90° bend) and re-solve. This lets the
  // route pick each leg's sign instead of guessing it up front.
  let angles = anglesFromDirs(dirs);
  let mid = [0.5, 0.5, 0.5, 0.5];
  for (let iter = 0; iter < 8; iter++) {
    const residualFn = (m) => {
      const { position } = forwardKinematics(flangeA, [stub, ...m, stub], angles, dirA);
      return [position[0] - flangeB[0], position[1] - flangeB[1], position[2] - flangeB[2]];
    };
    mid = solveLM(mid.map(Math.abs), residualFn, { maxIter: 200 }).x;

    let flipped = false;
    for (let k = 0; k < 4; k++) {
      if (mid[k] < 0) {
        dirs[k + 1] = dirs[k + 1].map((x) => -x); // reverse this middle leg
        mid[k] = -mid[k];
        flipped = true;
      }
    }
    if (!flipped) break;
    angles = anglesFromDirs(dirs);
  }

  // Cleanup: a leg pinned at the minimum length displaces the endpoint by ~MIN_LEN.
  // Hold the pinned legs fixed and re-solve the remaining free legs to absorb it.
  let lengths = mid.map((L) => Math.max(MIN_LEN, L));
  for (let pass = 0; pass < 4; pass++) {
    const free = lengths.map((L, k) => (L > MIN_LEN + 1e-6 ? k : -1)).filter((k) => k >= 0);
    if (free.length === 0) break;
    const resFn = (fv) => {
      const m = lengths.slice();
      free.forEach((k, j) => (m[k] = Math.max(MIN_LEN, fv[j])));
      const { position } = forwardKinematics(flangeA, [stub, ...m, stub], angles, dirA);
      return [position[0] - flangeB[0], position[1] - flangeB[1], position[2] - flangeB[2]];
    };
    const sol = solveLM(free.map((k) => lengths[k]), resFn, { maxIter: 100 }).x;
    free.forEach((k, j) => (lengths[k] = Math.max(MIN_LEN, sol[j])));
  }

  const spoolLengths = [stub, ...lengths, stub];

  const posErr = positionError(flangeA, flangeB, spoolLengths, angles, dirA);
  const dirErr = directionErrorDeg(flangeA, spoolLengths, angles, dirA, dirB);

  return {
    spoolLengths,
    rotations: angles,
    error: posErr * 1000, // mm
    dirErrorDeg: dirErr,
    converged: posErr < 0.005 && dirErr < 0.5, // within 5 mm and aligned
  };
}
