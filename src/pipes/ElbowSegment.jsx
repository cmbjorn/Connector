import { useMemo } from 'react';
import * as THREE from 'three';

const PIPE_RADIUS = 0.08;

export default function ElbowSegment({ position, inDirection, outDirection, radius, color, rotation }) {
  const quaternion = useMemo(() => {
    const inDir = new THREE.Vector3(...inDirection).normalize();
    const outDir = new THREE.Vector3(...outDirection).normalize();

    const axis = new THREE.Vector3().crossVectors(inDir, outDir);
    if (axis.length() < 0.001) return new THREE.Quaternion();

    axis.normalize();
    const angle = Math.acos(Math.max(-1, Math.min(1, inDir.dot(outDir))));

    const quat = new THREE.Quaternion();
    quat.setFromAxisAngle(axis, angle / 2);
    return quat;
  }, [inDirection, outDirection]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <torusGeometry args={[radius, PIPE_RADIUS, 16, 32, 0, Math.PI / 2]} />
      <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
    </mesh>
  );
}
