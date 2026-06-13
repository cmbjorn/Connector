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
 * Unlike solveSlipOn this is purely LOCAL: it runs Levenberg-Marquardt from the
 * locked-in reference angles with NO random restarts, so the slip-on flanges
 * rotate as little as possible to absorb the shift instead of jumping to a
 * different routing branch. If it can't reach the shifted target from here, that
 * correctly means the misalignment exceeds the compensation range (infeasible).
 */
export function solveMisalignment(spoolLengths, flangeA, flangeB, refRotations, flangeADirection = [0, 0, 1], flangeBDirection = [0, 0, 1]) {
  const n = spoolLengths.length - 1;
  const start = refRotations && refRotations.length === n ? [...refRotations] : new Array(n).fill(0);
  const residualFn = (x) => computeResiduals(flangeA, flangeB, spoolLengths, x, flangeADirection, flangeBDirection);

  const r = solveLM(start, residualFn, { maxIter: 300 });
  const posErr = positionError(flangeA, flangeB, spoolLengths, r.x, flangeADirection);
  const dirErr = directionErrorDeg(flangeA, spoolLengths, r.x, flangeADirection, flangeBDirection);

  return {
    rotations: r.x,
    error: posErr * 1000, // mm
    dirErrorDeg: dirErr,
    converged: posErr < POS_TOL_M && dirErr < DIR_TOL_DEG,
  };
}
