import { computeResiduals, positionError, directionErrorDeg } from './slipOnRouter.js';
import { solveLM } from './lm.js';

// Convergence thresholds (physical units).
const POS_TOL_M = 0.001; // 1 mm position gap
const DIR_TOL_DEG = 0.5; // 0.5° direction gap

/**
 * Solve for the slip-on swivel angles that bring the spool chain from Flange A
 * to Flange B (matching both position and direction).
 *
 * Uses Levenberg-Marquardt from the supplied starting angles, then — if that
 * stalls short of tolerance — retries from random restarts to escape local
 * minima. Returns the gap in millimetres so the UI can display it directly.
 *
 * @returns {{ rotations:number[], error:number, dirErrorDeg:number, converged:boolean }}
 *          `error` is the position gap in mm.
 */
export function solveSlipOn(spoolLengths, flangeA, flangeB, initialRotations = null, flangeADirection = [0, 0, 1], flangeBDirection = [0, 0, 1]) {
  const n = spoolLengths.length - 1; // one swivel per elbow
  const residualFn = (x) => computeResiduals(flangeA, flangeB, spoolLengths, x, flangeADirection, flangeBDirection);

  const evaluate = (rotations) => {
    const posErr = positionError(flangeA, flangeB, spoolLengths, rotations, flangeADirection);
    const dirErr = directionErrorDeg(flangeA, spoolLengths, rotations, flangeADirection, flangeBDirection);
    return { posErr, dirErr };
  };

  const start = initialRotations && initialRotations.length === n ? [...initialRotations] : new Array(n).fill(0);

  let best = solveLM(start, residualFn);
  let bestEval = evaluate(best.x);

  const converged = (e) => e.posErr < POS_TOL_M && e.dirErr < DIR_TOL_DEG;

  // Random restarts until converged (or we run out of attempts).
  const MAX_RESTARTS = 60;
  for (let attempt = 0; attempt < MAX_RESTARTS && !converged(bestEval); attempt++) {
    const guess = new Array(n).fill(0).map(() => (Math.random() * 2 - 1) * Math.PI);
    const cand = solveLM(guess, residualFn);
    const candEval = evaluate(cand.x);
    if (cand.cost < best.cost) {
      best = cand;
      bestEval = candEval;
    }
  }

  return {
    rotations: best.x,
    error: bestEval.posErr * 1000, // mm
    dirErrorDeg: bestEval.dirErr,
    converged: converged(bestEval),
  };
}

/**
 * MISALIGNMENT phase solve (spool lengths locked).
 *
 * Primary: local LM from the reference (locked) angles — minimal rotation, no
 * branch jumps.  If the primary solve stalls, up to WARM_RESTARTS attempts are
 * made from angles perturbed by ±PERTURB radians (≤45°).  That is tight enough
 * to stay on the same routing branch while being wide enough to escape local
 * minima near the feasibility boundary.  Full random restarts are intentionally
 * avoided so the displayed chain never jumps to a different topology.
 */
export function solveMisalignment(spoolLengths, flangeA, flangeB, refRotations, flangeADirection = [0, 0, 1], flangeBDirection = [0, 0, 1]) {
  const n = spoolLengths.length - 1;
  const start = refRotations && refRotations.length === n ? [...refRotations] : new Array(n).fill(0);
  const residualFn = (x) => computeResiduals(flangeA, flangeB, spoolLengths, x, flangeADirection, flangeBDirection);

  const evaluate = (x) => ({
    posErr: positionError(flangeA, flangeB, spoolLengths, x, flangeADirection),
    dirErr: directionErrorDeg(flangeA, spoolLengths, x, flangeADirection, flangeBDirection),
  });

  const converged = (e) => e.posErr < POS_TOL_M && e.dirErr < DIR_TOL_DEG;

  let best = solveLM(start, residualFn, { maxIter: 300 });
  let bestEval = evaluate(best.x);

  // Warm restarts — only pay the cost when primary solve did not converge.
  if (!converged(bestEval)) {
    const WARM_RESTARTS = 20;
    const PERTURB = Math.PI / 3; // ±60° — wide enough to escape local minima,
    // tight enough to stay on the same routing branch (full ±180° restarts
    // cause layout jumps to mirror-image configurations).
    for (let i = 0; i < WARM_RESTARTS && !converged(bestEval); i++) {
      const guess = start.map((a) => a + (Math.random() * 2 - 1) * PERTURB);
      const cand = solveLM(guess, residualFn, { maxIter: 400 });
      if (cand.cost < best.cost) {
        best = cand;
        bestEval = evaluate(cand.x);
      }
    }
  }

  return {
    rotations: best.x,
    error: bestEval.posErr * 1000, // mm
    dirErrorDeg: bestEval.dirErr,
    converged: converged(bestEval),
  };
}
