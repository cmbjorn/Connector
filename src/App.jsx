import { useState, useEffect } from 'react';
import { useStore } from './store.js';
import Scene from './Scene.jsx';
import SolverPanel from './SolverPanel.jsx';

export default function App() {
  const flangeA = useStore((s) => s.flangeA);
  const flangeB = useStore((s) => s.flangeB);
  const spoolLengths = useStore((s) => s.spoolLengths);
  const spoolsLocked = useStore((s) => s.spoolsLocked);
  const slipOnRotations = useStore((s) => s.slipOnRotations);
  const error = useStore((s) => s.error);
  const solved = useStore((s) => s.solved);
  const setFlangeA = useStore((s) => s.setFlangeA);
  const setFlangeB = useStore((s) => s.setFlangeB);
  const flangeARotation = useStore((s) => s.flangeARotation);
  const flangeBRotation = useStore((s) => s.flangeBRotation);
  const flangeADirection = useStore((s) => s.flangeADirection);
  const flangeBDirection = useStore((s) => s.flangeBDirection);
  const setFlangeADirection = useStore((s) => s.setFlangeADirection);
  const setFlangeBDirection = useStore((s) => s.setFlangeBDirection);
  const setFlangeARotation = useStore((s) => s.setFlangeARotation);
  const setFlangeBRotation = useStore((s) => s.setFlangeBRotation);
  const setSpoolLength = useStore((s) => s.setSpoolLength);
  const calculateSpools = useStore((s) => s.calculateSpools);
  const lockSpools = useStore((s) => s.lockSpools);
  const unlockSpools = useStore((s) => s.unlockSpools);
  const initializeSpool = useStore((s) => s.initializeSpool);

  const [editA, setEditA] = useState(false);
  const [editB, setEditB] = useState(false);

  useEffect(() => {
    initializeSpool();
  }, []);

  return (
    <div className="w-screen h-screen flex">
      <div className="flex-1">
        <Scene />
      </div>
      <div className="w-72 bg-slate-900 text-white p-6 shadow-lg overflow-y-auto">
        <h1 className="text-2xl font-bold mb-6">3D Swivel Router</h1>

        <SolverPanel />

        <div className="mb-6 p-3 bg-slate-800 rounded">
          <p className="text-sm font-semibold mb-2">
            Status: {solved && error < 5 ? '✅ Solved' : '❌ Gap'}
          </p>
          <p className="text-xs text-slate-400 mb-3">Gap: {error.toFixed(2)} mm</p>
          {spoolsLocked && (
            <div className="text-xs space-y-1 border-t border-slate-700 pt-2">
              <p className="font-semibold text-slate-300">Slip-On Rotations:</p>
              <div className="text-slate-400 text-xs space-y-1">
                {slipOnRotations.map((r, i) => (
                  <div key={i}>Slip-On {i + 1}: {(r * 180 / Math.PI).toFixed(1)}°</div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-slate-300">
              Spool Lengths {spoolsLocked ? '🔒' : '🔓'}
            </h3>
            <button
              onClick={spoolsLocked ? unlockSpools : lockSpools}
              className={`text-xs px-2 py-1 rounded ${
                spoolsLocked
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {spoolsLocked ? 'Unlock' : 'Lock'}
            </button>
          </div>
          <div className="bg-slate-800 p-3 rounded text-xs space-y-2">
            {!spoolsLocked && (
              <button
                onClick={calculateSpools}
                className="w-full bg-green-600 hover:bg-green-700 px-3 py-2 rounded text-sm font-semibold mb-2"
              >
                Calculate Spools from Flanges
              </button>
            )}
            {spoolLengths.map((len, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Spool {i + 1}:</span>
                {spoolsLocked ? (
                  <span className="text-yellow-400 font-mono">{len.toFixed(2)}m</span>
                ) : (
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={len.toFixed(2)}
                    onChange={(e) => setSpoolLength(i, parseFloat(e.target.value))}
                    className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-right"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Flange A (Gold)</h2>
          <div className="bg-slate-800 p-4 rounded">
            {editA ? (
              <div className="space-y-2">
                {['X', 'Y', 'Z'].map((axis, i) => (
                  <input
                    key={axis}
                    type="number"
                    step="0.1"
                    value={flangeA[i]}
                    onChange={(e) => {
                      const newPos = [...flangeA];
                      newPos[i] = parseFloat(e.target.value);
                      setFlangeA(newPos);
                    }}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white"
                    placeholder={axis}
                  />
                ))}
                <button
                  onClick={() => setEditA(false)}
                  className="w-full bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm mb-2">
                  ({flangeA[0].toFixed(2)}, {flangeA[1].toFixed(2)}, {flangeA[2].toFixed(2)})
                </p>
                <button
                  onClick={() => setEditA(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
                >
                  Edit Position
                </button>
              </>
            )}
          </div>
          <div className="bg-slate-700 p-2 rounded mt-2 text-xs space-y-2">
            <label className="block text-slate-300">Direction (pipe exit)</label>
            <div className="grid grid-cols-3 gap-1 mb-2">
              {[
                [[1, 0, 0], '+X'],
                [[0, 1, 0], '+Y'],
                [[0, 0, 1], '+Z'],
                [[-1, 0, 0], '-X'],
                [[0, -1, 0], '-Y'],
                [[0, 0, -1], '-Z'],
              ].map(([dir, label]) => (
                <button
                  key={label}
                  onClick={() => setFlangeADirection(dir)}
                  className={`py-1 rounded text-xs ${
                    JSON.stringify(flangeADirection) === JSON.stringify(dir)
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Flange B (Orange)</h2>
          <div className="bg-slate-800 p-4 rounded">
            {editB ? (
              <div className="space-y-2">
                {['X', 'Y', 'Z'].map((axis, i) => (
                  <input
                    key={axis}
                    type="number"
                    step="0.1"
                    value={flangeB[i]}
                    onChange={(e) => {
                      const newPos = [...flangeB];
                      newPos[i] = parseFloat(e.target.value);
                      setFlangeB(newPos);
                    }}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white"
                    placeholder={axis}
                  />
                ))}
                <button
                  onClick={() => setEditB(false)}
                  className="w-full bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm mb-2">
                  ({flangeB[0].toFixed(2)}, {flangeB[1].toFixed(2)}, {flangeB[2].toFixed(2)})
                </p>
                <button
                  onClick={() => setEditB(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
                >
                  Edit Position
                </button>
              </>
            )}
          </div>
          <div className="bg-slate-700 p-2 rounded mt-2 text-xs space-y-2">
            <label className="block text-slate-300">Direction (pipe entrance)</label>
            <div className="grid grid-cols-3 gap-1 mb-2">
              {[
                [[1, 0, 0], '+X'],
                [[0, 1, 0], '+Y'],
                [[0, 0, 1], '+Z'],
                [[-1, 0, 0], '-X'],
                [[0, -1, 0], '-Y'],
                [[0, 0, -1], '-Z'],
              ].map(([dir, label]) => (
                <button
                  key={label}
                  onClick={() => setFlangeBDirection(dir)}
                  className={`py-1 rounded text-xs ${
                    JSON.stringify(flangeBDirection) === JSON.stringify(dir)
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-700">
          <p className="text-xs text-slate-400">Shift flanges to test rerouting via swivel angles.</p>
        </div>
      </div>
    </div>
  );
}
