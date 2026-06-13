export function generateOrthogonalPath(start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dz = end[2] - start[2];

  const path = [start];
  const current = [...start];

  // Spool 1: Move 40% along Z (vertical - longer spool)
  current[2] += dz * 0.4;
  path.push([...current]);

  // Spool 2: Move along X
  current[0] += dx;
  path.push([...current]);

  // Spool 3: Move along Y
  current[1] += dy;
  path.push([...current]);

  // Spool 4: Move remaining 60% along Z
  current[2] += dz * 0.6;
  path.push([...current]);

  return path;
}

export function calculateSpoolLengths(path) {
  const lengths = [];
  for (let i = 0; i < path.length - 1; i++) {
    const dx = path[i + 1][0] - path[i][0];
    const dy = path[i + 1][1] - path[i][1];
    const dz = path[i + 1][2] - path[i][2];
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    lengths.push(length);
  }
  return lengths;
}

export function getPathSegments(path) {
  const segments = [];

  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i];
    const end = path[i + 1];
    segments.push({ start, end, type: 'straight' });

    if (i < path.length - 2) {
      const corner = end;
      const nextStart = path[i + 1];
      const nextEnd = path[i + 2];
      segments.push({ position: corner, type: 'elbow' });
    }
  }

  return segments;
}

export function getTotalLength(segments) {
  return segments
    .filter(s => s.type === 'straight')
    .reduce((sum, s) => sum + distance(s.start, s.end), 0);
}

function distance(a, b) {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
  );
}
