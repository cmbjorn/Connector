# Connector

A 3D piping alignment solver and engineering challenge tool for connecting two DN50 flanges on misaligned industrial skids using pre-fabricated spools, 90° elbows, and swivel flanges — zero field welds.

## Problem

Two flanges must be connected:
- **Flange A**: Fixed on the side of a box (4m below)
- **Flange B**: Fixed on a header, ~4m above and ~1m laterally offset
- **Constraint**: No field welds — only pre-fab spools, bends, and rotating flanges
- **Challenge**: The skids may be misaligned in all 6 DOF (translation + rotation)

Can swivel flanges absorb the misalignment?

## Solution

This tool lets you:
1. **Setup** — Define the two flange positions and orientations
2. **Design** — Build a spool arrangement from straight pipes, elbows, and swivels
3. **Test** — Apply random 6DOF misalignment and solve for swivel angles using numerical IK

## Quick Start

```bash
cd Connector
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Architecture

- **3D Engine**: Three.js + React Three Fiber with metallic materials and realistic lighting
- **Math**: Transform chains, numerical inverse kinematics (gradient descent)
- **State**: Zustand for reactive component state
- **UI**: Tailwind CSS, interactive sliders for misalignment and swivel angles

## Key Features

- Interactive 3D viewport with orbit controls
- Real-time gap visualization (green when connected, red when separated)
- Numerical solver to find optimal swivel angles
- Support for custom spool lengths and elbow radii
- Test mode with randomized misalignment scenarios

## Files

```
src/
├── engine/
│   ├── components.js     — Geometry models (Spool, Elbow, Swivel)
│   ├── chain.js          — Transform evaluation & gap computation
│   └── solver.js         — Numerical IK solver
├── scene/
│   ├── PipeScene.jsx     — 3D viewport (r3f Canvas)
│   ├── StraightPipe.jsx  — Cylinder mesh
│   ├── ElbowPipe.jsx     — Torus mesh (quarter-turn)
│   ├── FlangeMesh.jsx    — Flange disc with bolt pattern
│   └── GapIndicator.jsx  — Gap visualization (arrow/sphere)
├── ui/
│   ├── SetupPanel.jsx    — Flange position inputs
│   ├── DesignPanel.jsx   — Chain builder
│   └── TestPanel.jsx     — Misalignment & solver controls
├── store/
│   └── useStore.js       — Zustand state
└── App.jsx
```

---

**Author**: Christian  
**Status**: Early prototype for engineering validation
