import { useMemo } from 'react';
import * as THREE from 'three';

export default function Flange({ position, color, direction = [0, 0, 1], rotation = 0 }) {
  const quaternion = useMemo(() => {
    // Orient flange so its face normal aligns with `direction`.
    // cylinderGeometry's axis is +Y, so the disc face normal defaults to +Y.
    const dir = new THREE.Vector3(...direction).normalize();
    const defaultDir = new THREE.Vector3(0, 1, 0);

    const q = new THREE.Quaternion();
    q.setFromUnitVectors(defaultDir, dir);

    // Apply rotation around the direction axis
    if (rotation !== 0) {
      const rotQuat = new THREE.Quaternion();
      rotQuat.setFromAxisAngle(dir, rotation);
      q.multiplyQuaternions(rotQuat, q);
    }

    return q;
  }, [direction, rotation]);

  return (
    <>
      {/* Slip-on flange disc */}
      <mesh position={position} quaternion={quaternion}>
        <cylinderGeometry args={[0.18, 0.18, 0.06, 32]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Center point */}
      <mesh position={position}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color={color} metalness={0.95} roughness={0.05} />
      </mesh>
    </>
  );
}
