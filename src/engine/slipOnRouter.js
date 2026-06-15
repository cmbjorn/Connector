import * as THREE from 'three';

/**
 * The abstract bend radius used for IK geometry (scene units = meters).
 * Determines how much each elbow advances the pipe chain positionally.
 * This value drives both the solver and the visualization — the torus ring
 * radius rendered in ElbowSegment equals this value exactly.
 */
export const ELBOW_RADIUS = 0.15;

/**
 * Advance position through a 90° elbow and update direction.
 *
 * Physical geometry: for a 90° elbow with ring radius R, the straight pipe
 * ends at T_in and the next straight pipe starts at T_out where:
 *   T_out = T_in + (inDir + outDir) * R
 *
 * This is the only offset consistent with a quarter-circle arc: the torus arc
 * starts at T_in (tangent = inDir) and ends at T_out (tangent = outDir) with
 * ring center C = T_in + outDir * R.
 *
 * The old code used `perp * R` which is geometrically inconsistent and made
 * the torus impossible to orient correctly.
 */
function elbow(position, direction, slipRotation) {
  let perp = new THREE.Vector3();
  if (Math.abs(direction.z) < 0.9) {
    perp.crossVectors(direction, new THREE.Vector3(0, 0, 1)).normalize();
  } else {
    perp.crossVectors(direction, new THREE.Vector3(1, 0, 0)).normalize();
  }
  const quat = new THREE.Quaternion().setFromAxisAngle(direction.clone(), slipRotation);
  perp.applyQuaternion(quat);

  const newDir = new THREE.Vector3().crossVectors(perp, direction).normalize();
  // Physical 90° elbow: T_out = T_in + (inDir + outDir) * R
  position.add(direction.clone().add(newDir).multiplyScalar(ELBOW_RADIUS));
  direction.copy(newDir);
}

/**
 * Forward kinematics: N spools, N-1 elbows.
 */
export function forwardKinematics(flangeA, spoolLengths, slipOnRotations, flangeADirection = [0, 0, 1]) {
  const pos = new THREE.Vector3(...flangeA);
  const dir = new THREE.Vector3(...flangeADirection).normalize();

  for (let i = 0; i < spoolLengths.length; i++) {
    pos.addScaledVector(dir, spoolLengths[i]);
    if (i < spoolLengths.length - 1) {
      elbow(pos, dir, slipOnRotations[i] ?? 0);
    }
  }

  return { position: pos.toArray(), direction: dir.toArray() };
}

// Scales direction residuals relative to position (both in comparable units).
// 0.5 ≈ "half a metre per radian" — 1° direction error ≈ 0.5·sin(1°) ≈ 0.009,
// comparable to a 9 mm position error.  Keeps J well-conditioned.
const DIR_WEIGHT = 0.5;

export function computeResiduals(flangeA, flangeB, spoolLengths, slipOnRotations, flangeADirection = [0, 0, 1], flangeBDirection = [0, 0, 1]) {
  const { position, direction } = forwardKinematics(flangeA, spoolLengths, slipOnRotations, flangeADirection);

  const d = new THREE.Vector3(...direction);            // endpoint direction (unit)
  const t = new THREE.Vector3(...flangeBDirection).normalize(); // target direction (unit)

  // Project direction error onto two orthogonal tangent vectors of t.
  // Two tangent components give an exact 5×5 square system with the 5 swivel
  // angles.  Using 3 components of (d − t) would be rank-deficient near d≈t
  // (both are unit vectors, so the 3rd component is determined by the first two
  // there) producing a degenerate Jacobian.
  const ref = Math.abs(t.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(t, ref).normalize();
  const v = new THREE.Vector3().crossVectors(t, u).normalize();
  const dDiff = d.clone().sub(t);

  return [
    position[0] - flangeB[0],
    position[1] - flangeB[1],
    position[2] - flangeB[2],
    DIR_WEIGHT * dDiff.dot(u),   // direction error — tangent component 1
    DIR_WEIGHT * dDiff.dot(v),   // direction error — tangent component 2
  ];
}

export function positionError(flangeA, flangeB, spoolLengths, slipOnRotations, flangeADirection = [0, 0, 1]) {
  const { position } = forwardKinematics(flangeA, spoolLengths, slipOnRotations, flangeADirection);
  const dx = position[0] - flangeB[0];
  const dy = position[1] - flangeB[1];
  const dz = position[2] - flangeB[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function directionErrorDeg(flangeA, spoolLengths, slipOnRotations, flangeADirection = [0, 0, 1], flangeBDirection = [0, 0, 1]) {
  const { direction } = forwardKinematics(flangeA, spoolLengths, slipOnRotations, flangeADirection);
  const endDir = new THREE.Vector3(...direction);
  const targetDir = new THREE.Vector3(...flangeBDirection).normalize();
  const dot = Math.max(-1, Math.min(1, endDir.dot(targetDir)));
  return (Math.acos(dot) * 180) / Math.PI;
}

export function computeError(flangeA, flangeB, spoolLengths, slipOnRotations, flangeADirection = [0, 0, 1], flangeBDirection = [0, 0, 1]) {
  const r = computeResiduals(flangeA, flangeB, spoolLengths, slipOnRotations, flangeADirection, flangeBDirection);
  return Math.sqrt(r.reduce((s, v) => s + v * v, 0));
}

/**
 * Build the visualization structure: N spools, N-1 elbows, loose flange discs.
 *
 * Each elbow gets two flange discs — one at T_in (entry, end of incoming spool)
 * and one at T_out (exit, start of outgoing spool) — matching the "flanged with
 * loose flanges" physical arrangement.
 *
 * Elbow center stored here is the CENTER OF CURVATURE C = T_in + outDir * R,
 * which is where the torus mesh should be positioned.
 */
export function createDetailedStructure(flangeA, spoolLengths, slipOnRotations, flangeADirection = [0, 0, 1]) {
  const spools = [];
  const elbows = [];
  const flanges = [];

  const pos = new THREE.Vector3(...flangeA);
  const dir = new THREE.Vector3(...flangeADirection).normalize();

  for (let i = 0; i < spoolLengths.length; i++) {
    const spoolStart = pos.clone();

    pos.addScaledVector(dir, spoolLengths[i]);
    spools.push({ start: spoolStart.toArray(), end: pos.toArray(), index: i });

    if (i < spoolLengths.length - 1) {
      const slipRotation = slipOnRotations[i] ?? 0;

      // Compute outgoing direction (duplicates elbow() logic without side effects)
      let perp = new THREE.Vector3();
      if (Math.abs(dir.z) < 0.9) {
        perp.crossVectors(dir, new THREE.Vector3(0, 0, 1)).normalize();
      } else {
        perp.crossVectors(dir, new THREE.Vector3(1, 0, 0)).normalize();
      }
      const q = new THREE.Quaternion().setFromAxisAngle(dir.clone(), slipRotation);
      perp.applyQuaternion(q);
      const outDir = new THREE.Vector3().crossVectors(perp, dir).normalize();

      const inDir = dir.clone();
      const T_in = pos.clone(); // spool ends here, elbow arc starts here

      // Center of curvature: C = T_in + outDir * R
      const C = T_in.clone().add(outDir.clone().multiplyScalar(ELBOW_RADIUS));

      // Loose flange at elbow entry (T_in, pipe arrives from inDir)
      flanges.push({ position: T_in.toArray(), direction: inDir.toArray(), rotation: slipRotation });

      // Advance to T_out = T_in + (inDir + outDir) * R  [the elbow() call]
      elbow(pos, dir, slipRotation);
      const T_out = pos.clone(); // elbow arc ends here, next spool starts here

      // Loose flange at elbow exit (T_out, pipe leaves in outDir)
      flanges.push({ position: T_out.toArray(), direction: outDir.toArray(), rotation: slipRotation });

      elbows.push({
        center: C.toArray(),   // center of curvature of the torus arc
        inDir: inDir.toArray(),
        outDir: outDir.toArray(),
        radius: ELBOW_RADIUS,
        rotation: slipRotation,
        index: i,
      });
    }
  }

  return { spools, elbows, flanges, endPosition: pos.toArray(), endDirection: dir.toArray() };
}

export function createPipeChain(flangeA, spoolLengths, slipOnRotations, flangeADirection = [0, 0, 1]) {
  const { spools, endPosition } = createDetailedStructure(flangeA, spoolLengths, slipOnRotations, flangeADirection);
  return [flangeA, ...spools.map(s => s.end), endPosition];
}
