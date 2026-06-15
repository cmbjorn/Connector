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
  lockedRotations: null,   // angles saved at lock time — misalignment warm-restart base
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
    // Freeze the design and snapshot the current angles as the warm-restart
    // reference for all subsequent misalignment solves.
    set((state) => ({
      spoolsLocked: true,
      lockedRotations: [...state.slipOnRotations],
    }));
  },

  unlockSpools: () => {
    set((state) => ({
      spoolsLocked: false,
      lockedRotations: null,
      flangeARotation: 0,
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
    // Match setFlangeB: in the locked misalignment phase, re-solve the swivels
    // immediately so moving either nozzle updates the chain without pressing Solve.
    if (get().spoolsLocked) {
      get().solveForNewPosition();
    }
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
      // refRotations = locked design angles (warm-restart base, always valid).
      // startRotations = current angles (primary LM start, good for incremental steps).
      const result = solveMisalignment(
        state.spoolLengths,
        state.flangeA,
        state.flangeB,
        state.lockedRotations ?? state.slipOnRotations,
        state.flangeADirection,
        state.flangeBDirection,
        state.slipOnRotations,
      );
      return {
        // Only update the displayed angles when the solve converged. A failed
        // solve returns a bad local minimum — writing it back would corrupt the
        // starting point for the next attempt and cause cascading red-pipe failures.
        slipOnRotations: result.converged ? result.rotations : state.slipOnRotations,
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
