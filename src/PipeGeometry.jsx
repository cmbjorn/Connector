import { useMemo } from 'react';
import { useStore } from './store.js';
import StraightPipe from './pipes/StraightPipe.jsx';
import ElbowPipe from './pipes/ElbowPipe.jsx';
import { createPipeStructure } from './engine/slipOnRouter.js';

export default function PipeGeometry() {
  const flangeA = useStore((s) => s.flangeA);
  const flangeADirection = useStore((s) => s.flangeADirection);
  const spoolLengths = useStore((s) => s.spoolLengths);
  const slipOnRotations = useStore((s) => s.slipOnRotations);
  const solved = useStore((s) => s.solved);
  const error = useStore((s) => s.error);

  const segments = useMemo(() => createPipeStructure(flangeA, spoolLengths, slipOnRotations, flangeADirection), [flangeA, flangeADirection, spoolLengths, slipOnRotations]);

  const pipeColor = solved && error < 5 ? '#22c55e' : '#ef4444';
  const elbowColor = solved && error < 5 ? '#fbbf24' : '#f87171'; // Orange/yellow for elbows

  return (
    <>
      {segments.map((seg, idx) => {
        if (seg.type === 'spool') {
          return (
            <StraightPipe
              key={`spool-${idx}`}
              start={seg.start}
              end={seg.end}
              color={pipeColor}
            />
          );
        } else if (seg.type === 'elbow') {
          return (
            <ElbowPipe
              key={`elbow-${idx}`}
              position={seg.position}
              prev={seg.start}
              next={[seg.position[0] + seg.outDirection[0], seg.position[1] + seg.outDirection[1], seg.position[2] + seg.outDirection[2]]}
              color={elbowColor}
            />
          );
        }
        return null;
      })}
    </>
  );
}
