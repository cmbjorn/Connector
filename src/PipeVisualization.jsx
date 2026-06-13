import { useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from './store.js';
import StraightSpool from './pipes/StraightSpool.jsx';
import ElbowSegment from './pipes/ElbowSegment.jsx';
import SlipOnFlange from './pipes/SlipOnFlange.jsx';
import { createDetailedStructure } from './engine/slipOnRouter.js';

export default function PipeVisualization() {
  const flangeA = useStore((s) => s.flangeA);
  const flangeADirection = useStore((s) => s.flangeADirection);
  const spoolLengths = useStore((s) => s.spoolLengths);
  const slipOnRotations = useStore((s) => s.slipOnRotations);
  const solved = useStore((s) => s.solved);
  const error = useStore((s) => s.error);

  const structure = useMemo(
    () => createDetailedStructure(flangeA, spoolLengths, slipOnRotations, flangeADirection),
    [flangeA, spoolLengths, slipOnRotations, flangeADirection]
  );

  const connected = solved && error < 5;

  // Straight runs read as plain pipe: brushed steel when connected, red on a gap.
  const spoolColor = connected ? '#b0bec5' : '#e57373';
  const elbowColor = connected ? '#42a5f5' : '#ef5350';

  return (
    <>
      {structure.spools.map((spool, idx) => (
        <StraightSpool key={`spool-${idx}`} start={spool.start} end={spool.end} color={spoolColor} />
      ))}

      {structure.elbows.map((elbow, idx) => (
        <ElbowSegment
          key={`elbow-${idx}`}
          position={elbow.center}
          inDirection={elbow.inDir}
          outDirection={elbow.outDir}
          radius={elbow.radius}
          color={elbowColor}
          rotation={elbow.rotation}
        />
      ))}

      {structure.flanges.map((flange, idx) => (
        <SlipOnFlange
          key={`flange-${idx}`}
          position={flange.position}
          direction={flange.direction}
          rotation={flange.rotation}
        />
      ))}
    </>
  );
}
