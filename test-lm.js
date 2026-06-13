import { solveSlipOn } from './src/engine/slipOnSolver.js';
import { positionError, directionErrorDeg } from './src/engine/slipOnRouter.js';

// Test: Flange A at origin pointing +Y, Flange B at (2,2,2) pointing +Y
const flangeA = [0, 0, 0];
const flangeB = [2, 2, 2];
const flangeADirection = [0, 1, 0];
const flangeBDirection = [0, 1, 0];
const spoolLengths = [0.8, 2.0, 1.0, 1.0, 1.2];

console.log('Testing LM solver:');
console.log('  Flange A:', flangeA, 'dir:', flangeADirection);
console.log('  Flange B:', flangeB, 'dir:', flangeBDirection);

const result = solveSlipOn(spoolLengths, flangeA, flangeB, null, flangeADirection, flangeBDirection);

console.log('\nResult:');
console.log('  Converged:', result.converged);
console.log('  Position error (mm):', result.error.toFixed(2));
console.log('  Direction error (°):', result.dirErrorDeg.toFixed(2));
console.log('  Slip-on rotations:', result.rotations.map(r => r.toFixed(3)));
