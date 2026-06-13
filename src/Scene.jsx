import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { useStore } from './store.js';
import PipeVisualization from './PipeVisualization.jsx';
import Flange from './Flange.jsx';
import DirectionArrow from './DirectionArrow.jsx';
import * as THREE from 'three';

export default function Scene() {
  const flangeA = useStore((s) => s.flangeA);
  const flangeADirection = useStore((s) => s.flangeADirection);
  const flangeARotation = useStore((s) => s.flangeARotation);
  const flangeB = useStore((s) => s.flangeB);
  const flangeBDirection = useStore((s) => s.flangeBDirection);
  const flangeBRotation = useStore((s) => s.flangeBRotation);

  return (
    <Canvas camera={{ position: [4, 4, 4], fov: 50 }} style={{ width: '100%', height: '100vh' }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />

      <Grid args={[10, 10]} cellSize={1} cellColor="#444" sectionSize={5} sectionColor="#888" />

      <Flange position={flangeA} color="gold" direction={flangeADirection} rotation={flangeARotation} />
      <DirectionArrow position={flangeA} direction={flangeADirection} color="#fbbf24" />

      <Flange position={flangeB} color="orange" direction={flangeBDirection} rotation={flangeBRotation} />
      <DirectionArrow position={flangeB} direction={flangeBDirection} color="#f97316" />

      <PipeVisualization />

      <OrbitControls />
    </Canvas>
  );
}
