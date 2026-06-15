import * as THREE from 'three';
import { forwardKinematics, positionError, directionErrorDeg, computeResiduals } from './slipOnRouter.js';
import { solveLM } from './lm.js';

/**
 * General DESIGN-phase router for N 90° bends (N = 3, 4, or 5).
 *
 *   Step 1 — Route:  enumerate every clean axis-aligned path with N perpendicular
 *            90° bends that starts along dirA and ends along dirB. Each leg runs
 *            on a principal axis so the swivel angles land on multiples of 90°
 *            and the route looks like a tidy staircase.
 *   Step 2 — Lengths: for each candidate path, freeze the bends and LM-solve the
 *            middle spool lengths so the chain lands on Flange B. Score every
 *            candidate and keep the best (smallest gap, fewest legs pinned at the
 *            minimum length, shortest total run).
 *
 * Fewer bends = fewer leg directions = less freedom, so some offsets are only
 * reachable with more bends. When no candidate at the requested N can be solved
 * with positive lengths the result is flagged `converged: false` so the UI can
 * suggest adding a bend.
 *
 * Flange directions come from the UI as axis-aligned unit vectors (±X/±Y/±Z).
 */

const AXES = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

const isPerp = (a, b) => Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) < 1e-9;
const sameDir = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

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

/**
 * Enumerate every axis-aligned direction sequence of length N+1 with
 * dirs[0] = dirA, dirs[N] = dirB, and each consecutive pair perpendicular
 * (a real 90° bend). Returns an array of sequences (each an array of [x,y,z]).
 */
function enumerateSequences(dirA, dirB, N) {
  const results = [];
  const seq = new Array(N + 1);
  seq[0] = dirA;

  const dfs = (i) => {
    if (i === N) {
      if (isPerp(seq[i - 1], dirB)) {
        seq[N] = dirB;
        results.push(seq.slice());
      }
      return;
    }
    for (const ax of AXES) {
      if (isPerp(seq[i - 1], ax)) {
        seq[i] = ax;
        dfs(i + 1);
      }
    }
  };

  dfs(1);
  return results;
}

const MIN_LEN = 0.1; // shortest allowed spool (a real stub still exists off each nozzle)

/**
 * Solve the spool lengths for one candidate direction sequence.
 *
 * ALL legs are free (each floored at MIN_LEN), including the two end spools off
 * the nozzles. With few bends the end legs often have to grow — e.g. two flanges
 * both on +Z can only reach a large Z offset by lengthening the first and/or
 * last spool, since no middle leg lies on that axis. Fixing the ends at a stub
 * length (the old behaviour) made such 3-bend routes unsolvable.
 *
 * Returns lengths, swivel angles, and a score (lower = better).
 */
function solveCandidate(flangeA, flangeB, dirs, dirA) {
  const N = dirs.length - 1;
  const angles = [];
  for (let i = 0; i < N; i++) angles.push(swivelAngleFor(dirs[i], dirs[i + 1]));

  const nLegs = N + 1;
  const residualFn = (L) => {
    const lengths = L.map((x) => Math.max(MIN_LEN, x));
    const { position } = forwardKinematics(flangeA, lengths, angles, dirA);
    return [position[0] - flangeB[0], position[1] - flangeB[1], position[2] - flangeB[2]];
  };

  let lengths = solveLM(new Array(nLegs).fill(0.5), residualFn, { maxIter: 300 }).x
    .map((L) => Math.max(MIN_LEN, L));

  // A leg floored at MIN_LEN can drag the endpoint off target; hold the pinned
  // legs and re-solve the free ones to absorb that displacement.
  for (let pass = 0; pass < 4; pass++) {
    const free = lengths.map((L, k) => (L > MIN_LEN + 1e-6 ? k : -1)).filter((k) => k >= 0);
    if (free.length === 0) break;
    const resFn = (fv) => {
      const m = lengths.slice();
      free.forEach((k, j) => (m[k] = Math.max(MIN_LEN, fv[j])));
      const { position } = forwardKinematics(flangeA, m, angles, dirA);
      return [position[0] - flangeB[0], position[1] - flangeB[1], position[2] - flangeB[2]];
    };
    const sol = solveLM(free.map((k) => lengths[k]), resFn, { maxIter: 150 }).x;
    free.forEach((k, j) => (lengths[k] = Math.max(MIN_LEN, sol[j])));
  }

  const spoolLengths = lengths;
  const posErr = positionError(flangeA, flangeB, spoolLengths, angles, dirA);
  const pinned = lengths.filter((L) => L <= MIN_LEN + 1e-6).length;
  const total = spoolLengths.reduce((s, L) => s + L, 0);

  // Lower is better: gap dominates, then pinned legs, then a mild length tiebreak.
  const score = posErr * 1000 + pinned * 50 + total * 0.01;

  return { spoolLengths, angles, posErr, pinned, score };
}

/**
 * Minimum pairwise column-cosine orthogonality of the IK Jacobian.
 * Returns a value in [0, 1]: 0 = singular (two columns parallel/anti-parallel),
 * 1 = perfectly orthogonal.  Values < 0.05 indicate a kinematic singularity
 * where the chain cannot independently control all DOFs.
 */
function jacobiMinOrth(flangeA, flangeB, spoolLengths, angles, dirA, dirB) {
  const n = angles.length;
  const FD = 1e-5;
  const r0 = computeResiduals(flangeA, flangeB, spoolLengths, angles, dirA, dirB);
  const cols = angles.map((a, j) => {
    const a2 = [...angles]; a2[j] += FD;
    const r1 = computeResiduals(flangeA, flangeB, spoolLengths, a2, dirA, dirB);
    return r1.map((v, i) => (v - r0[i]) / FD);
  });
  let minOrth = 1;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const ni = Math.sqrt(cols[i].reduce((s, v) => s + v * v, 0));
      const nj = Math.sqrt(cols[j].reduce((s, v) => s + v * v, 0));
      if (ni < 1e-10 || nj < 1e-10) { minOrth = 0; continue; }
      const c = Math.abs(cols[i].reduce((s, v, k) => s + v * cols[j][k], 0) / (ni * nj));
      if (c > 1 - minOrth) minOrth = 1 - c;
    }
  }
  return minOrth;
}

/**
 * Search for a non-singular (length, angle) design that reaches flangeB.
 * Used as a fallback when the axis-aligned design is kinematically singular.
 * Returns null if no non-singular design is found within the trial budget.
 */
function findNonSingularDesign(flangeA, flangeB, dirA, dirB, numBends) {
  const n = numBends;
  const dist = Math.sqrt(
    (flangeB[0] - flangeA[0]) ** 2 +
    (flangeB[1] - flangeA[1]) ** 2 +
    (flangeB[2] - flangeA[2]) ** 2,
  );
  const scale = Math.max(0.3, dist * 0.5);

  let best = null;
  for (let trial = 0; trial < 200; trial++) {
    // Random asymmetric spool lengths — asymmetry is what breaks the singularity.
    const lens = new Array(n + 1).fill(0).map((_, k) =>
      Math.max(MIN_LEN, (0.2 + Math.random()) * scale * (1 + 0.5 * Math.sin(k * 2.1))),
    );
    const start = new Array(n).fill(0).map(() => (Math.random() * 2 - 1) * Math.PI);
    const res = solveLM(
      start,
      (x) => computeResiduals(flangeA, flangeB, lens, x, dirA, dirB),
      { maxIter: 200 },
    );
    const pe = positionError(flangeA, flangeB, lens, res.x, dirA);
    const de = directionErrorDeg(flangeA, lens, res.x, dirA, dirB);
    if (pe > 0.001 || de > 0.5) continue;
    const orth = jacobiMinOrth(flangeA, flangeB, lens, res.x, dirA, dirB);
    if (!best || orth > best.orth) best = { spoolLengths: lens, angles: res.x, orth, pe };
    if (orth > 0.05) break; // good enough
  }
  return (best && best.orth > 0.05) ? best : null;
}

export function initialOrthogonalRoute(flangeA, flangeB, dirA = [0, 0, 1], dirB = [0, 0, 1], numBends = 5) {
  const sequences = enumerateSequences(dirA, dirB, numBends);

  let best = null;
  for (const dirs of sequences) {
    const cand = solveCandidate(flangeA, flangeB, dirs, dirA);
    if (!best || cand.score < best.score) best = cand;
  }

  // Fallback: no perpendicular sequence exists (shouldn't happen for N≥3 with
  // axis-aligned flanges, but stay safe) — return a straight stub guess.
  if (!best) {
    const spoolLengths = new Array(numBends + 1).fill(MIN_LEN);
    return {
      spoolLengths,
      rotations: new Array(numBends).fill(0),
      error: positionError(flangeA, flangeB, spoolLengths, new Array(numBends).fill(0), dirA) * 1000,
      dirErrorDeg: directionErrorDeg(flangeA, spoolLengths, new Array(numBends).fill(0), dirA, dirB),
      converged: false,
    };
  }

  const dirErr = directionErrorDeg(flangeA, best.spoolLengths, best.angles, dirA, dirB);
  const converged = best.posErr < 0.005 && dirErr < 0.5;

  // Detect kinematic singularity: axis-aligned routes for symmetric flange
  // configurations (e.g. both pointing +Z, equal XYZ offsets) produce designs
  // where two swivel angles cancel each other — the Jacobian loses rank and the
  // misalignment solver cannot find solutions for ANY displacement.  When this
  // happens, swap in a non-singular design with asymmetric spool lengths.
  if (converged && numBends === 5) {
    const orth = jacobiMinOrth(flangeA, flangeB, best.spoolLengths, best.angles, dirA, dirB);
    if (orth < 0.05) {
      const alt = findNonSingularDesign(flangeA, flangeB, dirA, dirB, numBends);
      if (alt) {
        return {
          spoolLengths: alt.spoolLengths,
          rotations: alt.angles,
          error: alt.pe * 1000,
          dirErrorDeg: directionErrorDeg(flangeA, alt.spoolLengths, alt.angles, dirA, dirB),
          converged: true,
        };
      }
    }
  }

  return {
    spoolLengths: best.spoolLengths,
    rotations: best.angles,
    error: best.posErr * 1000, // mm
    dirErrorDeg: dirErr,
    converged,
  };
}
