import { useMemo } from 'react';
import * as THREE from 'three';

const PIPE_RADIUS = 0.05;
const ELBOW_RADIUS = 0.15;

export default function ElbowPipe({ position, prev, next, color = '#c0c0c0' }) {
  const quaternion = useMemo(() => {
    const dir1 = new THREE.Vector3(
      position[0] - prev[0],
      position[1] - prev[1],
      position[2] - prev[2]
    ).normalize();

    const dir2 = new THREE.Vector3(
      next[0] - position[0],
      next[1] - position[1],
      next[2] - position[2]
    ).normalize();

    const axis = new THREE.Vector3().crossVectors(dir1, dir2);
    if (axis.length() < 0.001) return new THREE.Quaternion();

    axis.normalize();
    const angle = Math.acos(Math.max(-1, Math.min(1, dir1.dot(dir2))));

    const quat = new THREE.Quaternion();
    quat.setFromAxisAngle(axis, angle / 2);
    return quat;
  }, [position, prev, next]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <torusGeometry args={[ELBOW_RADIUS, PIPE_RADIUS, 16, 16, 0, Math.PI / 2]} />
      <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
    </mesh>
  );
}
