import { create } from 'zustand';
import { createPipeChain, positionError, directionErrorDeg } from './engine/slipOnRouter.js';
import { solveMisalignment } from './engine/slipOnSolver.js';
import { initialOrthogonalRoute } from './engine/initialRouter.js';
import { defaultDN } from './engine/fittings.js';

export const useStore = create((set, get) => ({
  flangeA: [0, 0, 0],
  flangeADirection: [0, 0, 1], // Normal vector - pipe comes OUT in this direction
  flangeARotation: 0, // Rotation around the normal axis (1 DOF)
  flangeB: [2, 2, 2],
  flangeBDirection: [0, 0, 1], // Normal vector - pipe goes IN this direction
  flangeBRotation: 0, // Rotation around the normal axis (1 DOF)
  // numBends 90° elbows → numBends swivel angles and numBends+1 spools.
  // 5 bends = 5 DOF for 5 constraints (3 position + 2 direction): exactly
  // determined. 4 or 3 bends are under-determined in the misalignment phase but
  // route fine for the design and absorb small position-only shifts.
  numBends: 5,
  spoolLengths: [0.5, 0.8, 1.0, 0.8, 0.8, 0.5],
  spoolsLocked: false,
  slipOnRotations: [0, 0, 0, 0, 0],
  solved: false,
  error: Infinity, // position gap, mm
  dirError: Infinity, // direction gap, degrees
  solving: false,
  solverIterations: 0,
  solverHistory: [],
  dn: defaultDN, // Pipe fitting size: DN6, DN8, ..., DN50, ..., DN80

  initializeSpool: () => {
    const n = get().numBends;
    set({
      slipOnRotations: new Array(n).fill(0),
      error: Infinity,
      solved: false,
      spoolsLocked: false,
    });
    // Auto-route on load so the initial view shows a connected chain.
    get().calculateSpools();
  },

  setNumBends: (numBends) => {
    if (get().spoolsLocked) return; // locked design — change bends only when unlocked
    if (numBends < 3 || numBends > 5) return;
    set({
      numBends,
      slipOnRotations: new Array(numBends).fill(0),
      spoolLengths: new Array(numBends + 1).fill(0.5),
      error: Infinity,
      solved: false,
    });
    // Re-route with the new bend count.
    get().calculateSpools();
  },

  setSpoolLength: (index, length) => {
    const state = get();
    if (state.spoolsLocked) return;
    const newLengths = [...state.spoolLengths];
    newLengths[index] = Number.isFinite(length) ? length : state.spoolLengths[index];

    // Design phase: keep the clean 90° bends fixed and just report the new gap as
    // the engineer tunes a length (the swivels are only re-solved during the
    // misalignment phase). Click "Calculate Spools from Flanges" to re-route.
    const posErr = positionError(state.flangeA, state.flangeB, newLengths, state.slipOnRotations, state.flangeADirection);
    const dirErr = directionErrorDeg(state.flangeA, newLengths, state.slipOnRotations, state.flangeADirection, state.flangeBDirection);

    set({
      spoolLengths: newLengths,
      error: posErr * 1000,
      dirError: dirErr,
      solved: posErr < 0.005 && dirErr < 0.5,
    });
  },

  lockSpools: () => {
    // Freeze the design exactly as routed — keep the solved swivel angles so the
    // chain stays put. They become the reference the misalignment solver adjusts
    // from. (Resetting them to zero here collapsed the layout on lock.)
    set({ spoolsLocked: true });
  },

  unlockSpools: () => {
    set((state) => ({
      spoolsLocked: false,
      flangeARotation: 0, // Reset to aligned when unlocking
      flangeBRotation: 0,
    }));
  },

  setFlangeADirection: (direction) => {
    set({ flangeADirection: direction });
  },

  setFlangeARotation: (rotation) => {
    set({ flangeARotation: rotation });
  },

  setFlangeBDirection: (direction) => {
    set({ flangeBDirection: direction });
  },

  setFlangeBRotation: (rotation) => {
    set({ flangeBRotation: rotation });
  },

  setFlangeA: (pos) => {
    set({ flangeA: pos });
  },

  setFlangeB: (pos) => {
    set((state) => ({ flangeB: pos }));
    if (get().spoolsLocked) {
      get().solveForNewPosition();
    }
  },

  calculateSpools: () => {
    set((state) => {
      // Two-step design route: clean orthogonal path (90° bends) then lengths
      // adjusted to land on Flange B. See engine/initialRouter.js.
      const result = initialOrthogonalRoute(
        state.flangeA,
        state.flangeB,
        state.flangeADirection,
        state.flangeBDirection,
        state.numBends
      );

      return {
        spoolLengths: result.spoolLengths,
        slipOnRotations: result.rotations,
        error: result.error,
        dirError: result.dirErrorDeg,
        solved: result.converged,
      };
    });
  },

  solveForNewPosition: () => {
    set((state) => {
      // Local solve from the current angles — slip-on flanges adjust minimally to
      // absorb the shift rather than re-routing. Non-convergence = out of range.
      const result = solveMisalignment(
        state.spoolLengths,
        state.flangeA,
        state.flangeB,
        state.slipOnRotations,
        state.flangeADirection,
        state.flangeBDirection
      );
      return {
        slipOnRotations: result.rotations,
        error: result.error,
        dirError: result.dirErrorDeg,
        solved: result.converged,
      };
    });
  },

  setDN: (dn) => {
    set({ dn });
  },

  getPath: () => {
    const state = get();
    return createPipeChain(state.flangeA, state.spoolLengths, state.slipOnRotations);
  },
}));
