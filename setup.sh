#!/bin/bash

set -e

echo "🔧 Connector Setup"
echo "================="
echo ""

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
else
    OS="unknown"
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Installing..."
    echo ""

    if [ "$OS" = "macos" ]; then
        # Check for Homebrew
        if ! command -v brew &> /dev/null; then
            echo "⚠️  Homebrew not found. Installing Homebrew first..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        echo "Installing Node.js via Homebrew..."
        brew install node
    elif [ "$OS" = "linux" ]; then
        echo "Installing Node.js via apt..."
        sudo apt-get update
        sudo apt-get install -y nodejs npm
    else
        echo "Could not auto-detect OS. Please install Node.js manually:"
        echo "  https://nodejs.org (download LTS version)"
        exit 1
    fi
    echo ""
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js found: $NODE_VERSION"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please reinstall Node.js."
    exit 1
fi

NPM_VERSION=$(npm --version)
echo "✅ npm found: $NPM_VERSION"
echo ""

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 Start the dev server:"
echo "   npm run dev"
echo ""
echo "The app will open at http://localhost:5173"
