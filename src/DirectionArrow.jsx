import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export default function DirectionArrow({ position, direction, color = '#fbbf24', label = '' }) {
  const { scene } = useThree();
  const arrowRef = useRef(null);

  useEffect(() => {
    if (arrowRef.current) {
      scene.remove(arrowRef.current);
    }

    const dir = new THREE.Vector3(...direction).normalize();
    // Offset arrow to come out of the disc surface (flange radius = 0.18)
    const origin = new THREE.Vector3(...position).addScaledVector(dir, 0.12);
    const length = 0.4;
    const headLength = 0.12;
    const headWidth = 0.08;

    const arrow = new THREE.ArrowHelper(dir, origin, length, color, headLength, headWidth);
    arrowRef.current = arrow;
    scene.add(arrow);

    return () => {
      if (arrowRef.current) {
        scene.remove(arrowRef.current);
      }
    };
  }, [position, direction, color, scene]);

  return null;
}
