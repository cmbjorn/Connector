/**
 * DN (Diameter Nominal) / PN25 Pipe Fitting Specifications
 * Source: ISO 1092-1 (Slip-on Steel Flanges) and DIN 2501
 *
 * All dimensions in millimeters.
 * 1.5D bend radius = 1.5 × pipe nominal diameter (smooth elbow).
 */

export const fittingDB = {
  DN6: {
    label: 'DN6',
    pipeOD: 10.0,
    pipeID: 7.8,
    flangeOD: 70,
    flangeThickness: 12,
    boltCircle: 50,
    boltCount: 4,
    bendRadius1_5D: 11.7,
    boltSize: 'M12',
  },
  DN8: {
    label: 'DN8',
    pipeOD: 12.7,
    pipeID: 10.4,
    flangeOD: 80,
    flangeThickness: 12,
    boltCircle: 60,
    boltCount: 4,
    bendRadius1_5D: 15.9,
    boltSize: 'M12',
  },
  DN10: {
    label: 'DN10',
    pipeOD: 16.0,
    pipeID: 13.5,
    flangeOD: 90,
    flangeThickness: 12,
    boltCircle: 70,
    boltCount: 4,
    bendRadius1_5D: 24.0,
    boltSize: 'M12',
  },
  DN15: {
    label: 'DN15',
    pipeOD: 21.3,
    pipeID: 18.8,
    flangeOD: 105,
    flangeThickness: 14,
    boltCircle: 82.5,
    boltCount: 4,
    bendRadius1_5D: 32.0,
    boltSize: 'M12',
  },
  DN20: {
    label: 'DN20',
    pipeOD: 26.7,
    pipeID: 23.8,
    flangeOD: 120,
    flangeThickness: 16,
    boltCircle: 95,
    boltCount: 4,
    bendRadius1_5D: 40.0,
    boltSize: 'M12',
  },
  DN25: {
    label: 'DN25',
    pipeOD: 33.4,
    pipeID: 30.2,
    flangeOD: 140,
    flangeThickness: 18,
    boltCircle: 110,
    boltCount: 8,
    bendRadius1_5D: 50.0,
    boltSize: 'M12',
  },
  DN32: {
    label: 'DN32',
    pipeOD: 42.2,
    pipeID: 38.1,
    flangeOD: 160,
    flangeThickness: 20,
    boltCircle: 125,
    boltCount: 8,
    bendRadius1_5D: 63.0,
    boltSize: 'M16',
  },
  DN40: {
    label: 'DN40',
    pipeOD: 48.3,
    pipeID: 43.7,
    flangeOD: 180,
    flangeThickness: 22,
    boltCircle: 145,
    boltCount: 8,
    bendRadius1_5D: 72.5,
    boltSize: 'M16',
  },
  DN50: {
    label: 'DN50 (2")',
    pipeOD: 60.3,
    pipeID: 54.6,
    flangeOD: 210,
    flangeThickness: 24,
    boltCircle: 170,
    boltCount: 8,
    bendRadius1_5D: 90.0,
    boltSize: 'M16',
  },
  DN65: {
    label: 'DN65 (2.5")',
    pipeOD: 76.1,
    pipeID: 69.8,
    flangeOD: 250,
    flangeThickness: 26,
    boltCircle: 210,
    boltCount: 12,
    bendRadius1_5D: 114.0,
    boltSize: 'M20',
  },
  DN80: {
    label: 'DN80 (3")',
    pipeOD: 88.9,
    pipeID: 82.0,
    flangeOD: 280,
    flangeThickness: 28,
    boltCircle: 240,
    boltCount: 12,
    bendRadius1_5D: 133.0,
    boltSize: 'M20',
  },
};

export const dnSizes = Object.keys(fittingDB);
export const defaultDN = 'DN50';

/**
 * Convert millimeters to the Three.js scene unit (meters, scaled down for display).
 * Scene units are 0.001 mm (so 1mm in real life = 1 unit on screen).
 */
export function mmToUnit(mm) {
  return mm * 0.001;
}

export function unitToMm(unit) {
  return unit / 0.001;
}
