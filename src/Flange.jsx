import { useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from './store.js';
import { fittingDB, mmToUnit } from './engine/fittings.js';

export default function Flange({ position, color, direction = [0, 0, 1], rotation = 0 }) {
  const dn = useStore((s) => s.dn);
  const fitting = fittingDB[dn];

  const { quaternion, flangeOD, flangeThickness, boltCircle, boltCount } = useMemo(() => {
    const dir = new THREE.Vector3(...direction).normalize();
    const defaultDir = new THREE.Vector3(0, 1, 0);

    const q = new THREE.Quaternion();
    q.setFromUnitVectors(defaultDir, dir);

    if (rotation !== 0) {
      const rotQuat = new THREE.Quaternion();
      rotQuat.setFromAxisAngle(dir, rotation);
      q.multiplyQuaternions(rotQuat, q);
    }

    return {
      quaternion: q,
      flangeOD: mmToUnit(fitting.flangeOD),
      flangeThickness: mmToUnit(fitting.flangeThickness),
      boltCircle: mmToUnit(fitting.boltCircle),
      boltCount: fitting.boltCount,
    };
  }, [direction, rotation, dn]);

  // Bolt holes: small spheres at the bolt circle
  const boltPositions = useMemo(() => {
    const holes = [];
    for (let i = 0; i < boltCount; i++) {
      const angle = (i / boltCount) * Math.PI * 2;
      holes.push({ x: Math.cos(angle) * boltCircle * 0.5, z: Math.sin(angle) * boltCircle * 0.5 });
    }
    return holes;
  }, [boltCount, boltCircle]);

  return (
    <>
      {/* Flange ring (outer cylinder) */}
      <mesh position={position} quaternion={quaternion}>
        <cylinderGeometry args={[flangeOD * 0.5, flangeOD * 0.5, flangeThickness, 32]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Bolt holes (decorative small spheres on the bolt circle) */}
      {boltPositions.map((hole, i) => {
        const boltPos = new THREE.Vector3(hole.x, 0, hole.z);
        boltPos.applyQuaternion(quaternion);
        boltPos.add(new THREE.Vector3(...position));

        return (
          <mesh key={`bolt-${i}`} position={boltPos}>
            <sphereGeometry args={[mmToUnit(5), 8, 8]} />
            <meshStandardMaterial color="#4b5563" metalness={0.95} roughness={0.05} />
          </mesh>
        );
      })}

      {/* Center point */}
      <mesh position={position}>
        <sphereGeometry args={[mmToUnit(3), 16, 16]} />
        <meshStandardMaterial color={color} metalness={0.95} roughness={0.05} />
      </mesh>
    </>
  );
}
