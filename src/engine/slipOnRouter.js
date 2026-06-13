import * as THREE from 'three';

const ELBOW_RADIUS = 0.15;

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
  position.add(perp.clone().multiplyScalar(ELBOW_RADIUS));
  direction.copy(newDir);
  return perp; // for visualization (elbow center offset)
}

/**
 * Forward kinematics: N spools, N-1 elbows.
 *
 * Chain:  FlangeA → Spool1 → [Swivel+Elbow1] → Spool2 → ... → [Swivel+Elbow(N-1)] → SpoolN → FlangeB
 *
 * Spool1 direction = flangeADirection (locked by Flange A).
 * SpoolN must arrive at flangeB in flangeBDirection → 5 constraints.
 * With N=6 spools → 5 swivel angles = 5 DOF → exactly determined.
 *
 * Design phase:  user adjusts spool lengths, solver finds swivel angles.
 * Misalignment:  lengths frozen, Flange B shifts → solver finds new swivel angles.
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

// Weight applied to the direction residuals so the least-squares solver balances
// position (meters) against orientation (unit-vector difference, ~0..2).
const DIR_WEIGHT = 1.0;

/**
 * Residual vector for least-squares solving: [Δx, Δy, Δz, w·Δdir].
 * Position residuals are in meters; direction residuals are the (weighted)
 * difference between the achieved and target unit direction vectors.
 */
export function computeResiduals(flangeA, flangeB, spoolLengths, slipOnRotations, flangeADirection = [0, 0, 1], flangeBDirection = [0, 0, 1]) {
  const { position, direction } = forwardKinematics(flangeA, spoolLengths, slipOnRotations, flangeADirection);
  const targetDir = new THREE.Vector3(...flangeBDirection).normalize();

  return [
    position[0] - flangeB[0],
    position[1] - flangeB[1],
    position[2] - flangeB[2],
    DIR_WEIGHT * (direction[0] - targetDir.x),
    DIR_WEIGHT * (direction[1] - targetDir.y),
    DIR_WEIGHT * (direction[2] - targetDir.z),
  ];
}

/** Position gap in meters between the chain end and Flange B. */
export function positionError(flangeA, flangeB, spoolLengths, slipOnRotations, flangeADirection = [0, 0, 1]) {
  const { position } = forwardKinematics(flangeA, spoolLengths, slipOnRotations, flangeADirection);
  const dx = position[0] - flangeB[0];
  const dy = position[1] - flangeB[1];
  const dz = position[2] - flangeB[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Angular gap in degrees between the chain end direction and Flange B direction. */
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
 * Build the visualization structure: N spools, N-1 elbows, N-1 swivel flange discs.
 * The last spool ends at flangeB (when solved) — no separate B stub.
 */
export function createDetailedStructure(flangeA, spoolLengths, slipOnRotations, flangeADirection = [0, 0, 1]) {
  const spools = [];
  const elbows = [];
  const flanges = [];

  const pos = new THREE.Vector3(...flangeA);
  const dir = new THREE.Vector3(...flangeADirection).normalize();

  for (let i = 0; i < spoolLengths.length; i++) {
    const spoolStart = pos.clone();

    // Swivel flange disc sits at junction entering this spool (except first — that's Flange A itself)
    if (i > 0) {
      flanges.push({ position: spoolStart.toArray(), direction: dir.toArray(), rotation: slipOnRotations[i - 1] ?? 0 });
    }

    pos.addScaledVector(dir, spoolLengths[i]);
    spools.push({ start: spoolStart.toArray(), end: pos.toArray(), index: i });

    if (i < spoolLengths.length - 1) {
      const slipRotation = slipOnRotations[i] ?? 0;

      let perp = new THREE.Vector3();
      if (Math.abs(dir.z) < 0.9) {
        perp.crossVectors(dir, new THREE.Vector3(0, 0, 1)).normalize();
      } else {
        perp.crossVectors(dir, new THREE.Vector3(1, 0, 0)).normalize();
      }
      const quat = new THREE.Quaternion().setFromAxisAngle(dir.clone(), slipRotation);
      perp.applyQuaternion(quat);

      const newDir = new THREE.Vector3().crossVectors(perp, dir).normalize();
      const elbowCenter = pos.clone().add(perp.clone().multiplyScalar(ELBOW_RADIUS));

      elbows.push({ center: elbowCenter.toArray(), inDir: dir.toArray(), outDir: newDir.toArray(), radius: ELBOW_RADIUS, rotation: slipRotation, index: i });

      pos.copy(elbowCenter);
      dir.copy(newDir);
    }
  }

  return { spools, elbows, flanges, endPosition: pos.toArray(), endDirection: dir.toArray() };
}

export function createPipeChain(flangeA, spoolLengths, slipOnRotations, flangeADirection = [0, 0, 1]) {
  const { spools, endPosition } = createDetailedStructure(flangeA, spoolLengths, slipOnRotations, flangeADirection);
  return [flangeA, ...spools.map(s => s.end), endPosition];
}
