import { useState, useEffect } from 'react';
import * as THREE from 'three';
import { useStore } from './store.js';
import Scene from './Scene.jsx';
import SolverPanel from './SolverPanel.jsx';
import { dnSizes, fittingDB } from './engine/fittings.js';

// Simulate a skid that has rotated slightly around its base.
// LEVER_ARM = distance from the equipment support/base to the nozzle face.
// At 1° rotation with 0.5 m lever arm the nozzle shifts ~8.7 mm — realistic
// for the mm-to-1cm on-site tolerances this tool is designed for.
const LEVER_ARM = 0.5; // metres

// Apply a skid rotation to both nozzle position and direction.
// pitchDeg: rotation around the axis perpendicular to the nozzle in the
//           vertical plane ("front/back tilt").
// yawDeg:   rotation around the vertical axis ("left/right turn").
// Pivot is placed LEVER_ARM behind the nozzle face along the nozzle axis.
function skidDeviation(nominalPos, nominalDir, pitchDeg, yawDeg) {
  const n = new THREE.Vector3(...nominalDir).normalize();
  const ref = Math.abs(n.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(n, ref).normalize();
  const up    = new THREE.Vector3().crossVectors(right, n).normalize();

  const qPitch = new THREE.Quaternion().setFromAxisAngle(right, pitchDeg * Math.PI / 180);
  const qYaw   = new THREE.Quaternion().setFromAxisAngle(up,    yawDeg   * Math.PI / 180);
  const q = qYaw.multiply(qPitch);

  // Pivot = nozzle face − LEVER_ARM × nozzle direction
  const pivot  = new THREE.Vector3(...nominalPos).addScaledVector(n, -LEVER_ARM);
  const offset = new THREE.Vector3(...nominalPos).sub(pivot).applyQuaternion(q);

  return {
    pos: pivot.clone().add(offset).toArray(),
    dir: n.applyQuaternion(q).toArray(),
  };
}

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
  const solveForNewPosition = useStore((s) => s.solveForNewPosition);
  const initializeSpool = useStore((s) => s.initializeSpool);
  const dn = useStore((s) => s.dn);
  const setDN = useStore((s) => s.setDN);

  const [editA, setEditA] = useState(false);
  const [editB, setEditB] = useState(false);

  // Skid misalignment controls (misalignment phase only).
  // nominalBDir / nominalBPos are the design-phase values captured at lock time.
  const [bPitch, setBPitch] = useState(0);
  const [bYaw,   setBYaw]   = useState(0);
  const [nominalBDir, setNominalBDir] = useState([0, 0, 1]);
  const [nominalBPos, setNominalBPos] = useState([2, 2, 2]);

  const handleBDirButton = (dir) => {
    setNominalBDir(dir);
    setBPitch(0);
    setBYaw(0);
    setFlangeBDirection(dir);
  };

  const handleLock = () => {
    setNominalBDir(flangeBDirection);
    setNominalBPos(flangeB);
    setBPitch(0);
    setBYaw(0);
    lockSpools();
  };

  const handleUnlock = () => {
    setBPitch(0);
    setBYaw(0);
    // Unlock first so setFlangeB below does NOT trigger an unwanted solve.
    unlockSpools();
    setFlangeBDirection(nominalBDir);
    setFlangeB(nominalBPos);
  };

  // Apply a skid rotation: moves BOTH position and direction of Flange B,
  // then lets setFlangeB (which auto-solves when locked) handle the solve.
  const applyBDeviation = (pitch, yaw) => {
    const { pos, dir } = skidDeviation(nominalBPos, nominalBDir, pitch, yaw);
    setFlangeBDirection(dir);  // update direction first (synchronous in Zustand)
    setFlangeB(pos);           // update position → auto-triggers solveMisalignment
  };

  useEffect(() => {
    initializeSpool();
  }, []);

  return (
    <div className="w-screen h-screen flex">
      <div className="flex-1">
        <Scene />
      </div>
      <div className="w-72 bg-slate-900 text-white p-6 shadow-lg overflow-y-auto">
        <h1 className="text-2xl font-bold mb-2">Teafortwo</h1>
        <p className="text-xs text-slate-400 mb-6">3D Lap Joint Router</p>

        <div className="mb-6 p-3 bg-slate-800 rounded">
          <label className="text-xs font-semibold text-slate-300 block mb-2">Pipe Size (DN/PN25)</label>
          <select
            value={dn}
            onChange={(e) => setDN(e.target.value)}
            disabled={spoolsLocked}
            className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white disabled:opacity-50"
          >
            {dnSizes.map((size) => (
              <option key={size} value={size}>
                {fittingDB[size].label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-2">
            OD: {(fittingDB[dn].flangeOD).toFixed(0)}mm | Ø: {(fittingDB[dn].pipeOD).toFixed(1)}mm | 1.5D: {(fittingDB[dn].bendRadius1_5D).toFixed(0)}mm
          </p>
        </div>

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
              onClick={spoolsLocked ? handleUnlock : handleLock}
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
            {spoolsLocked ? (
              <>
                <p className="text-slate-300 font-semibold">Skid Misalignment</p>
                <p className="text-slate-400 text-xs mb-2">
                  Rotates the skid around its base ({(LEVER_ARM * 1000).toFixed(0)} mm lever arm).
                  1° ≈ {(Math.sin(Math.PI / 180) * LEVER_ARM * 1000).toFixed(1)} mm shift.
                </p>
                <div className="space-y-2">
                  {[
                    ['Pitch', bPitch, (v) => { setBPitch(v); applyBDeviation(v, bYaw); }],
                    ['Yaw',   bYaw,   (v) => { setBYaw(v);   applyBDeviation(bPitch, v); }],
                  ].map(([lbl, val, onChange]) => (
                    <div key={lbl} className="flex items-center justify-between gap-2">
                      <label className="text-slate-300 w-8 shrink-0">{lbl}</label>
                      <input
                        type="range"
                        min="-3"
                        max="3"
                        step="0.1"
                        value={val}
                        onChange={(e) => onChange(parseFloat(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-yellow-300 font-mono w-16 text-right shrink-0">
                        {val.toFixed(1)}° / {(Math.sin(val * Math.PI / 180) * LEVER_ARM * 1000).toFixed(1)} mm
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
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
                      onClick={() => handleBDirButton(dir)}
                      className={`py-1 rounded text-xs ${
                        JSON.stringify(nominalBDir) === JSON.stringify(dir)
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-700">
          <p className="text-xs text-slate-400">Shift flanges to test rerouting via swivel angles.</p>
        </div>
      </div>
    </div>
  );
}
