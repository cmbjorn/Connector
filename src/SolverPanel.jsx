import { useState, useEffect } from 'react';
import { useStore } from './store.js';
import InteractiveSolver from './engine/interactiveSolver.js';

export default function SolverPanel() {
  const flangeB = useStore((s) => s.flangeB);
  const flangeADirection = useStore((s) => s.flangeADirection);
  const flangeBDirection = useStore((s) => s.flangeBDirection);
  const spoolLengths = useStore((s) => s.spoolLengths);
  const slipOnRotations = useStore((s) => s.slipOnRotations);
  const solved = useStore((s) => s.solved);
  const error = useStore((s) => s.error);
  const spoolsLocked = useStore((s) => s.spoolsLocked);
  const flangeA = useStore((s) => s.flangeA);

  const [solving, setSolving] = useState(false);
  const [iterations, setIterations] = useState(0);
  const [currentError, setCurrentError] = useState(error);
  const [solver, setSolver] = useState(null);

  const handleSolve = async () => {
    if (!spoolsLocked) {
      alert('Lock spools first!');
      return;
    }

    setSolving(true);
    setIterations(0);
    setCurrentError(error);

    // Create solver instance
    const newSolver = new InteractiveSolver(spoolLengths, flangeA, flangeB, slipOnRotations, flangeADirection, flangeBDirection);

    // Run solver with visual updates
    const interval = setInterval(() => {
      const result = newSolver.step();

      if (result.done) {
        clearInterval(interval);
        // Update store with final result
        useStore.setState({
          slipOnRotations: result.converged ? newSolver.bestRotations : slipOnRotations,
          error: newSolver.bestError,
          solved: result.converged,
        });
        setSolving(false);
        setIterations(newSolver.iteration);
        setCurrentError(newSolver.bestError);
      } else {
        setIterations(result.iteration);
        setCurrentError(result.error);
        // Update visual in real-time
        useStore.setState({
          slipOnRotations: [...result.rotations],
          error: result.error,
        });
      }
    }, 10); // Update every 10ms

    setSolver(newSolver);
  };

  return (
    <div className="mb-8 p-4 bg-slate-800 rounded">
      <h3 className="text-lg font-semibold mb-3">Solver Control</h3>

      {!spoolsLocked ? (
        <p className="text-xs text-slate-400 mb-3">Lock spools to enable solver</p>
      ) : (
        <>
          <button
            onClick={handleSolve}
            disabled={solving}
            className={`w-full px-4 py-2 rounded font-semibold text-sm mb-3 ${
              solving
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            {solving ? `Solving... (Iter ${iterations})` : 'Solve'}
          </button>

          {iterations > 0 && (
            <div className="text-xs space-y-2 border-t border-slate-700 pt-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Iterations:</span>
                <span className="text-yellow-400 font-mono">{iterations}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gap:</span>
                <span className={`font-mono ${currentError < 5 ? 'text-green-400' : 'text-red-400'}`}>
                  {currentError.toFixed(2)} mm
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className={solved && error < 5 ? 'text-green-400' : 'text-red-400'}>
                  {solved && error < 5 ? '✅ Converged' : '⏳ Solving...'}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
