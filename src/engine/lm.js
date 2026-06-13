/**
 * Levenberg-Marquardt least-squares solver for the slip-on routing IK.
 *
 * The unknowns are the N-1 swivel angles. The residual function returns a
 * vector (3 position + 3 direction components); we minimize its sum of squares.
 * LM blends Gauss-Newton (fast near the solution) with gradient descent (robust
 * far from it) via the damping parameter λ — far more reliable than the plain
 * steepest-descent solver it replaces, which stalled in local minima.
 */

const FD_STEP = 1e-6; // finite-difference step for the Jacobian

function sumSquares(r) {
  let s = 0;
  for (let i = 0; i < r.length; i++) s += r[i] * r[i];
  return s;
}

/** Solve the dense linear system (A) x = b in place via Gaussian elimination. */
function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col] || 1e-12;
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / d;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / (M[i][i] || 1e-12);
  }
  return x;
}

/**
 * Run Levenberg-Marquardt.
 * @param {number[]} initial   starting angle guess
 * @param {(x:number[]) => number[]} residualFn  residual vector at x
 * @param {object} [opts]      { maxIter, tol }
 * @returns {{ x:number[], cost:number, iterations:number }}
 */
export function solveLM(initial, residualFn, opts = {}) {
  const { maxIter = 200, tol = 1e-12 } = opts;
  let x = [...initial];
  let r = residualFn(x);
  let cost = sumSquares(r);
  const n = x.length;
  const m = r.length;
  let lambda = 1e-3;

  for (let iter = 0; iter < maxIter; iter++) {
    if (cost < tol) return { x, cost, iterations: iter };

    // Finite-difference Jacobian J (m x n).
    const J = Array.from({ length: m }, () => new Array(n).fill(0));
    for (let j = 0; j < n; j++) {
      const xj = x[j];
      x[j] = xj + FD_STEP;
      const rp = residualFn(x);
      x[j] = xj;
      for (let i = 0; i < m; i++) J[i][j] = (rp[i] - r[i]) / FD_STEP;
    }

    // Normal equations: JtJ (n x n) and Jtr (n).
    const JtJ = Array.from({ length: n }, () => new Array(n).fill(0));
    const Jtr = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < m; k++) {
        Jtr[i] += J[k][i] * r[k];
        for (let j = i; j < n; j++) JtJ[i][j] += J[k][i] * J[k][j];
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) JtJ[i][j] = JtJ[j][i];

    // Try a damped step; grow λ until it reduces cost (or give up this iter).
    let stepped = false;
    for (let tries = 0; tries < 12; tries++) {
      const damped = JtJ.map((row, i) =>
        row.map((v, j) => (i === j ? v + lambda * (v + 1e-9) : v))
      );
      const dx = solveLinear(damped, Jtr.map((v) => -v));
      const xn = x.map((v, i) => v + dx[i]);
      const rn = residualFn(xn);
      const cn = sumSquares(rn);
      if (cn < cost) {
        const improved = cost - cn;
        x = xn;
        r = rn;
        cost = cn;
        lambda = Math.max(lambda * 0.5, 1e-9);
        stepped = true;
        if (improved < tol) return { x, cost, iterations: iter + 1 };
        break;
      }
      lambda *= 3;
      if (lambda > 1e9) break;
    }
    if (!stepped) return { x, cost, iterations: iter + 1 };
  }
  return { x, cost, iterations: maxIter };
}
