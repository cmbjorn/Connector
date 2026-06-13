import { useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '../store.js';
import { fittingDB, mmToUnit } from '../engine/fittings.js';

export default function ElbowSegment({ position, inDirection, outDirection, radius, color, rotation }) {
  const dn = useStore((s) => s.dn);
  const fitting = fittingDB[dn];
  const pipeRadius = mmToUnit(fitting.pipeOD * 0.5);

  const quaternion = useMemo(() => {
    const inDir = new THREE.Vector3(...inDirection).normalize();
    const outDir = new THREE.Vector3(...outDirection).normalize();
    const perp = new THREE.Vector3().crossVectors(inDir, outDir);
    if (perp.length() < 0.001) return new THREE.Quaternion();
    perp.normalize();

    // Three.js TorusGeometry defaults: ring in XY plane (normal = +Z),
    // at angle=0 tube center is at (R, 0, 0) with entry tangent +Y.
    //
    // The arc must start at T_in = C - outDir*R (tangent inDir)
    // and end   at T_out = C + inDir*R (tangent outDir).
    // Required mapping: +X → -outDir, +Y → inDir, +Z → perp (= inDir × outDir)
    const m = new THREE.Matrix4().makeBasis(
      outDir.clone().negate(), // +X → -outDir (radius from C to arc start)
      inDir,                    // +Y → inDir   (entry tangent)
      perp,                     // +Z → perp    (ring normal)
    );
    return new THREE.Quaternion().setFromRotationMatrix(m);
  }, [inDirection, outDirection]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <torusGeometry args={[radius, pipeRadius, 16, 32, Math.PI / 2]} />
      <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
    </mesh>
  );
}
