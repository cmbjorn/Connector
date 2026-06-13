# Setup Guide for Connector

## Prerequisites

You need **Node.js 16+** and **npm 7+** installed on your system.

### Check if you have them:

```bash
node --version
npm --version
```

If either command is not found, follow the installation steps below.

## Installation Steps

### Option 1: Using Homebrew (macOS)

```bash
brew install node
```

Verify:
```bash
node --version
npm --version
```

### Option 2: Download Installer (All platforms)

1. Go to https://nodejs.org
2. Download the **LTS (Long Term Support)** version
3. Run the installer and follow prompts
4. Verify installation:
   ```bash
   node --version
   npm --version
   ```

### Option 3: Using nvm (Node Version Manager) — Recommended

macOS/Linux:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
node --version  # Should show v18.x.x
```

## Running Connector

Once Node.js and npm are installed:

```bash
cd /Users/christian/PythonProject/Connector
npm install
npm run dev
```

This will:
1. Install all dependencies (React, Three.js, Vite, etc.)
2. Start a dev server at http://localhost:5173
3. Automatically open the app in your browser

## Troubleshooting

**"command not found: npm"**
- Node.js/npm not installed properly. Try Option 2 (installer) or reinstall via Homebrew.

**"Port 5173 already in use"**
- Another app is using that port. Either close it or run:
  ```bash
  npm run dev -- --port 5174
  ```

**Build errors**
- Delete `node_modules` and `package-lock.json`, then retry:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  npm run dev
  ```

---

Once running, you'll see the 3D piping alignment tool. Go to **Setup** tab, define your two flanges, and test!
