import { useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '../store.js';
import { fittingDB, mmToUnit } from '../engine/fittings.js';

export default function SlipOnFlange({ position, direction, rotation, label }) {
  const dn = useStore((s) => s.dn);
  const fitting = fittingDB[dn];
  const flangeOD = mmToUnit(fitting.flangeOD * 0.5);
  const flangeThickness = mmToUnit(fitting.flangeThickness);
  const quaternion = useMemo(() => {
    const dir = new THREE.Vector3(...direction).normalize();
    const axis = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion();
    quat.setFromUnitVectors(axis, dir);
    return quat;
  }, [direction]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[flangeOD, flangeOD, flangeThickness, 32]} />
      <meshStandardMaterial
        color={Math.abs(rotation) < 0.01 ? '#e2e8f0' : '#f59e0b'}
        metalness={0.9}
        roughness={0.15}
      />
    </mesh>
  );
}
