import { useState, useEffect } from 'react';
import * as THREE from 'three';
import { useStore } from './store.js';
import Scene from './Scene.jsx';
import { dnSizes, fittingDB } from './engine/fittings.js';
import MTO from './MTO.jsx';

const LEVER_ARM = 0.5; // metres — distance from skid base to nozzle face

function skidDeviation(nominalPos, nominalDir, pitchDeg, yawDeg) {
  const n = new THREE.Vector3(...nominalDir).normalize();
  const ref = Math.abs(n.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(n, ref).normalize();
  const up    = new THREE.Vector3().crossVectors(right, n).normalize();
  const qPitch = new THREE.Quaternion().setFromAxisAngle(right, pitchDeg * Math.PI / 180);
  const qYaw   = new THREE.Quaternion().setFromAxisAngle(up,    yawDeg   * Math.PI / 180);
  const q = qYaw.multiply(qPitch);
  const pivot  = new THREE.Vector3(...nominalPos).addScaledVector(n, -LEVER_ARM);
  const offset = new THREE.Vector3(...nominalPos).sub(pivot).applyQuaternion(q);
  return {
    pos: pivot.clone().add(offset).toArray(),
    dir: n.clone().applyQuaternion(q).toArray(),
  };
}

const DIR_OPTS = [
  [[1,0,0],'+X'],[[0,1,0],'+Y'],[[0,0,1],'+Z'],
  [[-1,0,0],'-X'],[[0,-1,0],'-Y'],[[0,0,-1],'-Z'],
];

const fmtMm  = (v) => Number.isFinite(v) ? `${v.toFixed(2)} mm` : '—';
const fmtDeg = (v) => Number.isFinite(v) ? `${v.toFixed(2)}°`  : '—';

// ── Position editor: step-size buttons + per-axis [−] value [+] ──────────────
const POS_STEPS = [0.01, 0.05, 0.10]; // metres (1 cm, 5 cm, 10 cm)

function PosEditor({ pos, onChange }) {
  const [step, setStep] = useState(0.05);

  const nudge = (i, delta) => {
    const p = [...pos];
    // Round to 1 mm to avoid floating-point drift
    p[i] = Math.round((p[i] + delta) * 1000) / 1000;
    onChange(p);
  };

  return (
    <div className="space-y-1.5">
      {/* Step size selector */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-400 shrink-0">Step</span>
        {POS_STEPS.map((s) => (
          <button key={s} onClick={() => setStep(s)}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              step === s ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}>
            {(s * 100).toFixed(0)} cm
          </button>
        ))}
      </div>

      {/* Per-axis nudge rows */}
      {['X','Y','Z'].map((axis, i) => (
        <div key={axis} className="flex items-center gap-1">
          <span className="text-xs text-slate-400 w-4 text-center font-mono shrink-0">{axis}</span>
          <button onClick={() => nudge(i, -step)}
            className="bg-slate-700 hover:bg-slate-500 active:bg-slate-400 w-7 h-7 rounded text-base font-semibold text-slate-200 shrink-0 leading-none">
            −
          </button>
          <input
            type="number"
            step={step}
            value={pos[i].toFixed(2)}
            onChange={(e) => {
              const p = [...pos];
              p[i] = parseFloat(e.target.value) || 0;
              onChange(p);
            }}
            className="flex-1 min-w-0 bg-slate-700 border border-slate-600 rounded px-1 py-1 text-xs text-white text-center font-mono"
          />
          <button onClick={() => nudge(i, step)}
            className="bg-slate-700 hover:bg-slate-500 active:bg-slate-400 w-7 h-7 rounded text-base font-semibold text-slate-200 shrink-0 leading-none">
            +
          </button>
          <span className="text-xs text-slate-500 w-4 text-center shrink-0">m</span>
        </div>
      ))}
    </div>
  );
}

// ── Direction button grid ─────────────────────────────────────────────────────
function DirGrid({ value, onChange, disabled }) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {DIR_OPTS.map(([dir, label]) => (
        <button key={label}
          disabled={disabled}
          onClick={() => onChange(dir)}
          className={`py-1 rounded text-xs font-mono disabled:opacity-40 disabled:cursor-not-allowed ${
            JSON.stringify(value) === JSON.stringify(dir)
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >{label}</button>
      ))}
    </div>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────
export default function App() {
  const flangeA          = useStore((s) => s.flangeA);
  const flangeB          = useStore((s) => s.flangeB);
  const flangeADirection = useStore((s) => s.flangeADirection);
  const flangeBDirection = useStore((s) => s.flangeBDirection);
  const spoolLengths     = useStore((s) => s.spoolLengths);
  const spoolsLocked     = useStore((s) => s.spoolsLocked);
  const slipOnRotations  = useStore((s) => s.slipOnRotations);
  const error            = useStore((s) => s.error);
  const dirError         = useStore((s) => s.dirError);
  const solved           = useStore((s) => s.solved);
  const numBends         = useStore((s) => s.numBends);
  const dn               = useStore((s) => s.dn);

  const setFlangeA          = useStore((s) => s.setFlangeA);
  const setFlangeB          = useStore((s) => s.setFlangeB);
  const setFlangeADirection = useStore((s) => s.setFlangeADirection);
  const setFlangeBDirection = useStore((s) => s.setFlangeBDirection);
  const setSpoolLength      = useStore((s) => s.setSpoolLength);
  const calculateSpools     = useStore((s) => s.calculateSpools);
  const lockSpools          = useStore((s) => s.lockSpools);
  const unlockSpools        = useStore((s) => s.unlockSpools);
  const initializeSpool     = useStore((s) => s.initializeSpool);
  const setDN               = useStore((s) => s.setDN);
  const setNumBends         = useStore((s) => s.setNumBends);

  const [showMTO, setShowMTO] = useState(false);

  const [bPitch, setBPitch] = useState(0);
  const [bYaw,   setBYaw]   = useState(0);
  const [nominalBDir, setNominalBDir] = useState([0, 0, 1]);
  const [nominalBPos, setNominalBPos] = useState([2, 2, 2]);

  useEffect(() => { initializeSpool(); }, []);

  const handleBDirButton = (dir) => {
    setNominalBDir(dir);
    setBPitch(0);
    setBYaw(0);
    setFlangeBDirection(dir);
  };

  const handleLock = () => {
    setNominalBDir([...flangeBDirection]);
    setNominalBPos([...flangeB]);
    setBPitch(0);
    setBYaw(0);
    lockSpools();
  };

  const handleUnlock = () => {
    setBPitch(0);
    setBYaw(0);
    unlockSpools();
    setFlangeBDirection(nominalBDir);
    setFlangeB(nominalBPos);
  };

  const applyBDeviation = (pitch, yaw) => {
    const { pos, dir } = skidDeviation(nominalBPos, nominalBDir, pitch, yaw);
    setFlangeBDirection(dir);
    setFlangeB(pos);
  };

  const handleResetDeviation = () => {
    setBPitch(0);
    setBYaw(0);
    setFlangeBDirection(nominalBDir);
    setFlangeB(nominalBPos);
  };

  // When B is moved in locked phase, update nominalBPos so the skid sliders
  // have a correct reference if the user also applies rotation.
  const handleFlangeBChange = (p) => {
    if (spoolsLocked) setNominalBPos(p);
    setFlangeB(p);
  };

  const fit = fittingDB[dn];

  return (
    <div className="w-screen h-screen flex">
      <div className="flex-1"><Scene /></div>

      <div className="w-80 bg-slate-900 text-white p-4 shadow-lg overflow-y-auto flex flex-col gap-4">

        {/* ── Title ── */}
        <div>
          <h1 className="text-2xl font-bold">Teafortwo</h1>
          <p className="text-xs text-slate-400">3D Lap Joint Router</p>
        </div>

        {/* ── Phase banner ── */}
        <div className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
          spoolsLocked
            ? 'bg-amber-950 border-amber-700 text-amber-300'
            : 'bg-blue-950 border-blue-700 text-blue-300'
        }`}>
          {spoolsLocked ? '🔒 Phase 2 — Test misalignment' : '📐 Phase 1 — Design routing'}
          <p className="font-normal mt-0.5 opacity-80">
            {spoolsLocked
              ? 'Move a flange or use the skid sliders — solver re-runs live.'
              : 'Set flanges and directions, then Calculate Spools.'}
          </p>
        </div>

        {/* ── Flange A ── */}
        <section className="bg-slate-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-400 shrink-0" />
            <h2 className="text-sm font-semibold">Flange A</h2>
          </div>

          <PosEditor pos={flangeA} onChange={setFlangeA} />

          <div>
            <p className="text-xs text-slate-400 mb-1">Exit direction</p>
            <DirGrid value={flangeADirection} onChange={setFlangeADirection} disabled={spoolsLocked} />
            {spoolsLocked && (
              <p className="text-xs text-slate-500 mt-1">Unlock design to change direction.</p>
            )}
          </div>
        </section>

        {/* ── Flange B ── */}
        <section className="bg-slate-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-400 shrink-0" />
            <h2 className="text-sm font-semibold">Flange B</h2>
          </div>

          <PosEditor pos={flangeB} onChange={handleFlangeBChange} />

          {spoolsLocked ? (
            /* ── Skid rotation (Phase 2) ── */
            <div className="space-y-2 pt-2 border-t border-slate-700">
              <div className="flex justify-between items-center">
                <p className="text-xs font-semibold text-slate-300">Skid rotation</p>
                {(bPitch !== 0 || bYaw !== 0) && (
                  <button onClick={handleResetDeviation}
                    className="text-xs text-amber-400 hover:text-white underline">
                    Reset to nominal
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {(LEVER_ARM * 1000).toFixed(0)} mm lever arm — 1° ≈ {(Math.sin(Math.PI / 180) * LEVER_ARM * 1000).toFixed(1)} mm shift
              </p>
              {[
                ['Pitch', bPitch, (v) => { setBPitch(v); applyBDeviation(v, bYaw); }],
                ['Yaw',   bYaw,   (v) => { setBYaw(v);   applyBDeviation(bPitch, v); }],
              ].map(([lbl, val, onChange]) => (
                <div key={lbl} className="flex items-center gap-2">
                  <label className="text-xs text-slate-300 w-8 shrink-0">{lbl}</label>
                  <input type="range" min="-3" max="3" step="0.1" value={val}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    className="flex-1 min-w-0"
                  />
                  <span className="text-xs text-yellow-300 font-mono w-24 text-right shrink-0">
                    {val.toFixed(1)}° / {(Math.sin(val * Math.PI / 180) * LEVER_ARM * 1000).toFixed(1)} mm
                  </span>
                </div>
              ))}
            </div>
          ) : (
            /* ── Direction buttons (Phase 1) ── */
            <div>
              <p className="text-xs text-slate-400 mb-1">Entrance direction</p>
              <DirGrid value={nominalBDir} onChange={handleBDirButton} disabled={false} />
            </div>
          )}
        </section>

        {/* ── Pipe specification ── */}
        <section className={`bg-slate-800 rounded-lg p-3 space-y-3 transition-opacity ${spoolsLocked ? 'opacity-50' : ''}`}>
          <h2 className="text-sm font-semibold text-slate-300">Pipe specification</h2>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Size (DN / PN25)</label>
            <select value={dn} onChange={(e) => setDN(e.target.value)} disabled={spoolsLocked}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white disabled:cursor-not-allowed">
              {dnSizes.map((s) => <option key={s} value={s}>{fittingDB[s].label}</option>)}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              OD {fit.pipeOD} mm · Flange Ø{fit.flangeOD} mm · 1.5D = {fit.bendRadius1_5D} mm
            </p>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">90° Bends</label>
            <div className="grid grid-cols-3 gap-1">
              {[3, 4, 5].map((n) => (
                <button key={n} onClick={() => setNumBends(n)} disabled={spoolsLocked}
                  className={`py-1.5 rounded text-sm font-semibold disabled:cursor-not-allowed ${
                    numBends === n
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}>
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {numBends} bends → {numBends + 1} spools · {numBends === 5 ? 'fully constrained' : `${5 - numBends} DOF short`}
            </p>
          </div>
        </section>

        {/* ── Spool lengths + Lock ── */}
        <section className="bg-slate-800 rounded-lg p-3 space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold">Spools {spoolsLocked ? '🔒' : '🔓'}</h2>
            <button onClick={spoolsLocked ? handleUnlock : handleLock}
              className={`text-xs px-3 py-1 rounded font-semibold transition-colors ${
                spoolsLocked
                  ? 'bg-red-800 hover:bg-red-700 text-red-200'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}>
              {spoolsLocked ? 'Unlock design' : 'Lock design'}
            </button>
          </div>

          {!spoolsLocked && (
            <button onClick={calculateSpools}
              className="w-full bg-green-600 hover:bg-green-500 py-2 rounded text-sm font-semibold transition-colors">
              Calculate Spools from Flanges
            </button>
          )}

          <div className="space-y-1 pt-1">
            {spoolLengths.map((len, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-14 shrink-0">Spool {i + 1}</span>
                {spoolsLocked ? (
                  <span className="text-xs text-yellow-400 font-mono ml-auto">
                    {(len * 1000).toFixed(0)} mm
                  </span>
                ) : (
                  <>
                    <input type="number" step="0.01" min="0.1"
                      value={len.toFixed(2)}
                      onChange={(e) => setSpoolLength(i, parseFloat(e.target.value))}
                      className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-xs text-white text-right font-mono"
                    />
                    <span className="text-xs text-slate-500 w-4 shrink-0">m</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Status ── */}
        <section className={`rounded-lg p-3 space-y-2 border ${
          solved ? 'bg-green-950 border-green-800' : 'bg-slate-800 border-slate-700'
        }`}>
          <p className="text-sm font-semibold">
            {solved ? '✅ Within tolerance' : '❌ Gap remaining'}
          </p>

          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Position gap</span>
              <span className={`font-mono ${Number.isFinite(error) && error < 5 ? 'text-green-400' : 'text-slate-300'}`}>
                {fmtMm(error)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Direction gap</span>
              <span className={`font-mono ${Number.isFinite(dirError) && dirError < 0.5 ? 'text-green-400' : 'text-slate-300'}`}>
                {fmtDeg(dirError)}
              </span>
            </div>
          </div>

          {!solved && numBends < 5 && (
            <p className="text-xs text-amber-400">
              {numBends} bends = {numBends} swivel DOF. Try 5 bends for full 5-constraint compensation.
            </p>
          )}

          {spoolsLocked && slipOnRotations.length > 0 && (
            <div className="pt-2 border-t border-slate-700">
              <p className="text-xs font-semibold text-slate-300 mb-1">Swivel angles</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {slipOnRotations.map((r, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-slate-400">LJ{i + 1}</span>
                    <span className="font-mono text-slate-300">{(r * 180 / Math.PI).toFixed(1)}°</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── How to use ── */}
        <details className="bg-slate-800 rounded-lg overflow-hidden">
          <summary className="px-3 py-2.5 text-xs font-semibold text-slate-300 cursor-pointer hover:text-white select-none list-none">
            ▶ How to use
          </summary>
          <ol className="px-3 pb-3 pt-1 list-decimal list-inside space-y-1.5 text-xs text-slate-400 leading-relaxed">
            <li>Set <span className="text-slate-200">Flange A & B</span> positions using ± buttons, and pick directions.</li>
            <li>Pick <span className="text-slate-200">pipe size</span> and number of <span className="text-slate-200">bends</span> (5 = most flexibility).</li>
            <li>Click <span className="text-slate-200">Calculate Spools</span> to auto-route, then fine-tune lengths.</li>
            <li>Click <span className="text-slate-200">Lock design</span> — spools are now "fabricated".</li>
            <li>Nudge a flange position or use <span className="text-slate-200">Pitch / Yaw</span> sliders to apply site misalignment. Swivels re-solve live.</li>
            <li><span className="text-green-400">✅ Within tolerance</span> = lap joints compensate. A gap = out of reach.</li>
            <li>Use <span className="text-slate-200">Material Take-Off</span> for the cut list and procurement CSV.</li>
          </ol>
        </details>

        {/* ── MTO ── */}
        <button onClick={() => setShowMTO(true)}
          className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded-lg text-sm font-semibold transition-colors">
          Material Take-Off
        </button>

        {showMTO && <MTO onClose={() => setShowMTO(false)} />}
      </div>
    </div>
  );
}
