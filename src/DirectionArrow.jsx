import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export default function DirectionArrow({ position, direction, color = '#fbbf24' }) {
  const { scene } = useThree();
  const arrowRef = useRef(null);

  useEffect(() => {
    if (arrowRef.current) {
      scene.remove(arrowRef.current);
    }

    const dir = new THREE.Vector3(...direction).normalize();
    // Start from the flange face outward — past the flange disc thickness (0.025m)
    // so the arrow base sits just outside the disc and is never inside a pipe.
    const origin = new THREE.Vector3(...position).addScaledVector(dir, 0.03);
    const length = 0.45;
    const headLength = 0.14;
    const headWidth = 0.09;

    const arrow = new THREE.ArrowHelper(dir, origin, length, color, headLength, headWidth);

    // Always draw on top — prevents the arrow from being hidden inside pipe geometry
    // when the camera angle aligns with the pipe axis.
    arrow.line.material.depthTest = false;
    arrow.cone.material.depthTest = false;
    arrow.line.renderOrder = 999;
    arrow.cone.renderOrder = 999;

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
