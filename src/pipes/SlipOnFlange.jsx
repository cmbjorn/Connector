import { useMemo } from 'react';
import * as THREE from 'three';

export default function SlipOnFlange({ position, direction, rotation, label }) {
  const quaternion = useMemo(() => {
    const dir = new THREE.Vector3(...direction).normalize();
    const axis = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion();
    quat.setFromUnitVectors(axis, dir);
    return quat;
  }, [direction]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[0.17, 0.17, 0.05, 32]} />
      <meshStandardMaterial
        color={Math.abs(rotation) < 0.01 ? '#e2e8f0' : '#f59e0b'}
        metalness={0.9}
        roughness={0.15}
      />
    </mesh>
  );
}
