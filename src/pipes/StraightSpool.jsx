import { useMemo } from 'react';
import * as THREE from 'three';

const PIPE_RADIUS = 0.08;

export default function StraightSpool({ start, end, color, label }) {
  const [position, rotation, length] = useMemo(() => {
    const direction = new THREE.Vector3(
      end[0] - start[0],
      end[1] - start[1],
      end[2] - start[2]
    );
    const len = direction.length();

    if (len === 0) return [start, [0, 0, 0], 0];

    const pos = [
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2,
      (start[2] + end[2]) / 2,
    ];

    const axis = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion();
    quat.setFromUnitVectors(axis, direction.normalize());
    const euler = new THREE.Euler().setFromQuaternion(quat);

    return [pos, [euler.x, euler.y, euler.z], len];
  }, [start, end]);

  if (length === 0) return null;

  return (
    <mesh position={position} rotation={rotation}>
      <cylinderGeometry args={[PIPE_RADIUS, PIPE_RADIUS, length, 16]} />
      <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
    </mesh>
  );
}
