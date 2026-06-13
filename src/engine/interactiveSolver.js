import { computeResiduals, positionError, directionErrorDeg } from './slipOnRouter.js';
import { solveLM } from './lm.js';

const POS_TOL_M = 0.001; // 1 mm
const DIR_TOL_DEG = 0.5;
const ITERS_PER_STEP = 2; // LM iterations advanced per animation frame

/**
 * Stepwise Levenberg-Marquardt solver for live UI animation of the MISALIGNMENT
 * phase. Each `step()` advances a couple of LM iterations from the current
 * angles so the 3D view shows the slip-on flanges rotating to absorb the shift.
 *
 * Purely LOCAL — no random restarts. The flanges adjust minimally from the
 * locked configuration; if it can't reach the shifted target from here, that
 * means the misalignment is out of the compensation range (infeasible).
 */
class InteractiveSolver {
  constructor(spoolLengths, flangeA, flangeB, initialRotations, flangeADirection = [0, 0, 1], flangeBDirection = [0, 0, 1]) {
    this.spoolLengths = spoolLengths;
    this.flangeA = flangeA;
    this.flangeB = flangeB;
    this.flangeADirection = flangeADirection;
    this.flangeBDirection = flangeBDirection;

    const n = spoolLengths.length - 1;
    this.rotations = initialRotations && initialRotations.length === n ? [...initialRotations] : new Array(n).fill(0);
    this.residualFn = (x) => computeResiduals(flangeA, flangeB, spoolLengths, x, flangeADirection, flangeBDirection);

    this.iteration = 0;
    this.maxIterations = 400;
    this.stallCount = 0;

    const e = this.evaluate(this.rotations);
    this.bestRotations = [...this.rotations];
    this.bestPosErr = e.posErr;
    this.bestDirErr = e.dirErr;
    this.history = [{ iter: 0, error: e.posErr * 1000, rotations: [...this.rotations] }];
  }

  evaluate(rotations) {
    return {
      posErr: positionError(this.flangeA, this.flangeB, this.spoolLengths, rotations, this.flangeADirection),
      dirErr: directionErrorDeg(this.flangeA, this.spoolLengths, rotations, this.flangeADirection, this.flangeBDirection),
    };
  }

  converged() {
    return this.bestPosErr < POS_TOL_M && this.bestDirErr < DIR_TOL_DEG;
  }

  step() {
    if (this.converged()) {
      return { done: true, converged: true };
    }
    if (this.iteration >= this.maxIterations) {
      return { done: true, converged: false };
    }

    const result = solveLM(this.rotations, this.residualFn, { maxIter: ITERS_PER_STEP });
    this.rotations = result.x;
    this.iteration += ITERS_PER_STEP;

    const e = this.evaluate(this.rotations);
    if (e.posErr + e.dirErr / 1000 < this.bestPosErr + this.bestDirErr / 1000) {
      this.bestRotations = [...this.rotations];
      this.bestPosErr = e.posErr;
      this.bestDirErr = e.dirErr;
      this.stallCount = 0;
    } else {
      this.stallCount++;
    }

    // No random restarts: if LM stalls, the shift is simply out of range. Stop
    // rather than jump to a different routing branch.
    if (this.stallCount > 12) {
      return { done: true, converged: this.converged() };
    }

    this.history.push({ iter: this.iteration, error: e.posErr * 1000, rotations: [...this.rotations] });

    return {
      done: false,
      iteration: this.iteration,
      error: e.posErr * 1000, // mm
      dirErrorDeg: e.dirErr,
      rotations: [...this.rotations],
      bestRotations: [...this.bestRotations],
    };
  }

  solve() {
    let result;
    while (!(result = this.step()).done) {}
    return {
      rotations: this.bestRotations,
      error: this.bestPosErr * 1000,
      dirErrorDeg: this.bestDirErr,
      converged: this.converged(),
      iterations: this.iteration,
      history: this.history,
    };
  }

  get bestError() {
    return this.bestPosErr * 1000;
  }
}

export default InteractiveSolver;
