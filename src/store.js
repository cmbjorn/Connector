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
  // 6 spools: spool 1 exits FlangeA (direction locked), spool 6 enters FlangeB (direction = target).
  // 5 elbows between them → 5 swivel angles = 5 DOF for 5 constraints (3 position + 2 direction).
  spoolLengths: [0.5, 0.8, 1.0, 0.8, 0.8, 0.5],
  spoolsLocked: false,
  slipOnRotations: [0, 0, 0, 0, 0],
  solved: false,
  error: Infinity,
  solving: false,
  solverIterations: 0,
  solverHistory: [],
  dn: defaultDN, // Pipe fitting size: DN6, DN8, ..., DN50, ..., DN80

  initializeSpool: () => {
    set({
      slipOnRotations: [0, 0, 0, 0, 0],
      error: Infinity,
      solved: false,
      spoolsLocked: false,
    });
    // Auto-route on load so the initial view shows a connected chain.
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
        state.flangeBDirection
      );

      return {
        spoolLengths: result.spoolLengths,
        slipOnRotations: result.rotations,
        error: result.error,
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
