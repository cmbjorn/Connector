import * as THREE from 'three';

// Base routing directions: Z, X, Y, Z
const BASE_DIRECTIONS = [
  [0, 0, 1], // Spool 1: 40% vertical
  [1, 0, 0], // Spool 2: horizontal X
  [0, 1, 0], // Spool 3: horizontal Y
  [0, 0, 1], // Spool 4: 60% vertical
];

export function solveIK(spoolLengths, flangeA, flangeB, initialRotations = null) {
  const maxIterations = 500;
  const tolerance = 0.1; // mm - tighter tolerance
  let learningRate = 0.05;

  let rotations = initialRotations || Array(spoolLengths.length - 1)
    .fill(null)
    .map(() => [0, 0, 0]);

  let bestRotations = JSON.parse(JSON.stringify(rotations));
  let bestError = computeError(flangeA, flangeB, spoolLengths, rotations);
  let noImprovementCount = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    const error = computeError(flangeA, flangeB, spoolLengths, rotations);

    if (error < tolerance) {
      return { rotations, error, converged: true };
    }

    if (error < bestError * 0.99) { // Only update if significant improvement
      bestError = error;
      bestRotations = JSON.parse(JSON.stringify(rotations));
      noImprovementCount = 0;
    } else {
      noImprovementCount++;
      if (noImprovementCount > 50) {
        learningRate *= 0.9; // Reduce learning rate if stuck
        noImprovementCount = 0;
      }
    }

    // Gradient descent on each rotation
    for (let i = 0; i < rotations.length; i++) {
      for (let axis = 0; axis < 3; axis++) {
        const delta = 0.005; // Smaller delta for better precision
        rotations[i][axis] += delta;
        const errorPlus = computeError(flangeA, flangeB, spoolLengths, rotations);
        rotations[i][axis] -= 2 * delta;
        const errorMinus = computeError(flangeA, flangeB, spoolLengths, rotations);
        rotations[i][axis] += delta; // Reset

        const gradient = (errorPlus - errorMinus) / (2 * delta);
        rotations[i][axis] -= learningRate * gradient;

        // Clamp to reasonable angles (-2π to 2π)
        rotations[i][axis] = Math.max(-Math.PI * 2, Math.min(Math.PI * 2, rotations[i][axis]));
      }
    }
  }

  return { rotations: bestRotations, error: bestError, converged: bestError < tolerance };
}

function computeError(flangeA, flangeB, spoolLengths, rotations) {
  const endPoint = forwardKinematics(flangeA, spoolLengths, rotations);
  const dx = endPoint[0] - flangeB[0];
  const dy = endPoint[1] - flangeB[1];
  const dz = endPoint[2] - flangeB[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function forwardKinematics(start, spoolLengths, rotations) {
  let position = new THREE.Vector3(...start);

  for (let i = 0; i < spoolLengths.length; i++) {
    // Get base direction for this spool
    let direction = new THREE.Vector3(...BASE_DIRECTIONS[i]);

    // Apply rotation to deviate from base direction
    const [rx, ry, rz] = rotations[i] || [0, 0, 0];
    const quat = new THREE.Quaternion();
    quat.setFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ'));
    direction.applyQuaternion(quat);

    // Move along rotated direction
    position.addScaledVector(direction, spoolLengths[i]);
  }

  return [position.x, position.y, position.z];
}

export function createPipeChain(flangeA, spoolLengths, rotations) {
  const chain = [flangeA];
  let position = new THREE.Vector3(...flangeA);

  for (let i = 0; i < spoolLengths.length; i++) {
    let direction = new THREE.Vector3(...BASE_DIRECTIONS[i]);
    const [rx, ry, rz] = rotations[i] || [0, 0, 0];
    const quat = new THREE.Quaternion();
    quat.setFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ'));
    direction.applyQuaternion(quat);

    position.addScaledVector(direction, spoolLengths[i]);
    chain.push([position.x, position.y, position.z]);
  }

  return chain;
}
