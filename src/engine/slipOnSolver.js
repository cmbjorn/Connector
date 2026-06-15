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
 * Primary: local LM from `startRotations` (the current slip-on angles) so each
 * incremental nudge converges quickly from the previous step.
 *
 * Warm restarts (when primary stalls): perturb the LOCKED design angles
 * (`refRotations`) rather than the current angles.  The locked angles are a
 * guaranteed-valid configuration, so warm-starting from them keeps the solver
 * on the same routing branch and avoids the drift that accumulates when
 * previous failed solves have corrupted the current angles.
 *
 * @param refRotations   Slip-on angles at lock time — warm-restart base.
 * @param startRotations Current slip-on angles — primary LM start (falls back
 *                       to refRotations when not supplied).
 */
export function solveMisalignment(
  spoolLengths, flangeA, flangeB, refRotations,
  flangeADirection = [0, 0, 1], flangeBDirection = [0, 0, 1],
  startRotations = null,
) {
  const n = spoolLengths.length - 1;
  const ref   = refRotations   && refRotations.length   === n ? [...refRotations]   : new Array(n).fill(0);
  const start = startRotations && startRotations.length === n ? [...startRotations] : [...ref];

  const residualFn = (x) => computeResiduals(flangeA, flangeB, spoolLengths, x, flangeADirection, flangeBDirection);

  const evaluate = (x) => ({
    posErr: positionError(flangeA, flangeB, spoolLengths, x, flangeADirection),
    dirErr: directionErrorDeg(flangeA, spoolLengths, x, flangeADirection, flangeBDirection),
  });

  const converged = (e) => e.posErr < POS_TOL_M && e.dirErr < DIR_TOL_DEG;

  // Primary: start from the current (most recent converged) angles.
  let best = solveLM(start, residualFn, { maxIter: 300 });
  let bestEval = evaluate(best.x);

  // Warm restarts — only when primary stalls.  Perturb the LOCKED reference
  // angles (not the current ones) so the search is always anchored to a known-
  // good configuration and doesn't compound errors from prior failed solves.
  if (!converged(bestEval)) {
    const WARM_RESTARTS = 40;
    const PERTURB = Math.PI * 2 / 3; // ±120°: covers more of solution space
    for (let i = 0; i < WARM_RESTARTS && !converged(bestEval); i++) {
      const guess = ref.map((a) => a + (Math.random() * 2 - 1) * PERTURB);
      const cand = solveLM(guess, residualFn, { maxIter: 300 });
      if (cand.cost < best.cost) {
        best = cand;
        bestEval = evaluate(best.x);
      }
    }
  }

  // Final fallback: full random restarts over [−π, π] — same strategy as the
  // design-phase solver.  Catches cases where the solution is far from the
  // design configuration (e.g. near kinematic singularities).
  if (!converged(bestEval)) {
    const RANDOM_RESTARTS = 30;
    for (let i = 0; i < RANDOM_RESTARTS && !converged(bestEval); i++) {
      const guess = new Array(n).fill(0).map(() => (Math.random() * 2 - 1) * Math.PI);
      const cand = solveLM(guess, residualFn, { maxIter: 300 });
      if (cand.cost < best.cost) {
        best = cand;
        bestEval = evaluate(best.x);
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
