# Teafortwo — 3D Lap Joint Router

A browser-based 3D routing tool for connecting two fixed equipment nozzles with
pre-fabricated pipe spools, 90° elbows, and rotating **lap joint (slip-on)
flanges** — and checking whether those swivel joints can absorb real-world
installation misalignment without any field welds or re-fabrication.

Built for DN/PN25 piping (full DN6–DN80 fitting database, DN50 default).

## The problem

Two skids each present a fixed nozzle flange (position + direction). The spools
between them are cut and welded in the shop to tight tolerances. On site, the
skids are never perfectly aligned — there's typically a few mm up to ~1–2 cm of
deviation in any direction, and the nozzle may be slightly rotated too.

**Question:** can the rotating lap joint flanges take up that misalignment, or
does the spool design need to change? This tool answers it before fabrication.

## How it works — two phases

1. **Design phase.** Set Flange A and Flange B (position + axis-aligned
   direction). The router lays out a clean orthogonal path of 90° bends and
   solves the spool lengths to land exactly on Flange B. Choose **3, 4, or 5**
   bends depending on the geometry.
2. **Misalignment phase.** Lock the design (spool lengths frozen — the pipe is
   "fabricated"). Shift Flange B, or apply a **skid rotation** (pitch/yaw about
   the skid base, which moves *both* the nozzle position and direction). The
   solver finds the new swivel angles that compensate. Converged = feasible;
   a residual gap = the misalignment exceeds the joints' range.

## Degrees of freedom

Each 90° elbow carries one swivel flange (1 rotational DOF). Matching Flange B
is 5 constraints: 3 position + 2 direction.

| Bends | Swivel DOF | Result in misalignment phase |
|------:|-----------:|------------------------------|
| 5     | 5          | Exactly determined ✓         |
| 4     | 4          | Under-determined — absorbs small/position-only shifts |
| 3     | 3          | Under-determined — tight geometries only |

The UI reports position gap (mm) and direction gap (°) separately and flags when
a chosen bend count cannot reach the target.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static production build → dist/
```

It's a fully client-side app (the solver and 3D run in the browser), so the
build deploys as static files anywhere — e.g. Vercel auto-deploys on push.

## Architecture

- **3D**: Three.js + React Three Fiber, real fitting dimensions from the DN/PN25
  database (`src/engine/fittings.js`).
- **Solver**: Levenberg-Marquardt least-squares (`src/engine/lm.js`).
  - Design routing uses a global search over clean axis-aligned bend sequences.
  - Misalignment uses a *local* solve from the locked angles (no random
    restarts) so the joints adjust minimally instead of jumping to another
    routing branch.
- **State**: Zustand (`src/store.js`).
- **UI**: Tailwind CSS.

## Key files

```
src/
├── engine/
│   ├── fittings.js        — DN/PN25 fitting database (OD, flange, bolts, 1.5D)
│   ├── lm.js              — Levenberg-Marquardt least-squares solver
│   ├── slipOnRouter.js    — Forward kinematics, residuals, detailed geometry
│   ├── initialRouter.js   — Design-phase route search (3/4/5 bends)
│   ├── slipOnSolver.js    — solveSlipOn (global) + solveMisalignment (local)
│   └── interactiveSolver.js — stepwise solve for live UI animation
├── pipes/
│   ├── StraightSpool.jsx  — pipe cylinder
│   ├── ElbowSegment.jsx   — quarter-torus 90° elbow
│   └── SlipOnFlange.jsx   — loose flange disc
├── Scene.jsx              — r3f canvas, flanges, lighting, grid
├── PipeVisualization.jsx  — renders spools / elbows / flanges
├── Flange.jsx             — nozzle flange with bolt circle
├── DirectionArrow.jsx     — nozzle direction indicator
├── MTO.jsx                — Material Take-Off (cut list + fittings + CSV)
├── SolverPanel.jsx        — solve button + live iteration display
├── App.jsx                — control panel
└── store.js               — Zustand state
```

## Material Take-Off

The **Material Take-Off** button produces a spool cut list and a fittings/bulk
table (elbows, lap joint flanges, stub ends, gaskets, stud bolts + nuts) scaled
to the selected DN and bend count, with one-click CSV export for procurement.

---

**Author**: Christian
