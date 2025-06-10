#!/bin/bash

# Non-interactive version of setup.sh
# Defaults to installing all language support

set -e

echo "🚀 Running non-interactive setup..."

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "⚠️ Only macOS is currently supported."
  exit 1
fi

# Check for Homebrew
if ! command -v brew &>/dev/null; then
  echo "❌ Homebrew is required. Please install it from https://brew.sh"
  exit 1
fi

BREW_VERSION=$(brew --version)
echo "✅ Homebrew is installed ($BREW_VERSION)"

# Check for asdf
ASDF_PATH="$(brew --prefix asdf)/libexec/asdf.sh"
if ! command -v asdf &>/dev/null; then
  if [[ -f "$ASDF_PATH" ]]; then
    . "$ASDF_PATH"
  else
    echo "❌ asdf is required. Please install it with: brew install asdf"
    exit 1
  fi
else
  . "$ASDF_PATH"
fi

ASDF_VERSION=$(asdf --version)
echo "✅ asdf is installed ($ASDF_VERSION)"

# Install GitHub CLI if not present
if ! command -v gh &>/dev/null; then
  echo "📦 Installing GitHub CLI..."
  brew install gh || exit 1
fi
GH_VERSION=$(gh --version | head -n 1)
echo "✅ gh is installed ($GH_VERSION)"

# Install Node.js
if ! asdf plugin list | grep -q "^nodejs$"; then
  echo "📦 Installing nodejs asdf plugin..."
  asdf plugin add nodejs || exit 1
fi

if ! command -v node &>/dev/null || [[ $(node --version) != "v20.19.2" ]]; then
  echo "📦 Installing Node.js 20.19.2..."
  asdf install nodejs 20.19.2 || exit 1
  asdf set nodejs 20.19.2 || exit 1
fi
NODE_VERSION=$(node --version)
echo "✅ Node.js is installed ($NODE_VERSION)"

# Install Python
if ! asdf plugin list | grep -q "^python$"; then
  echo "📦 Installing python asdf plugin..."
  asdf plugin add python || exit 1
fi

if ! command -v python &>/dev/null; then
  echo "📦 Installing Python 3.13.2..."
  asdf install python 3.13.2 || exit 1
  asdf set python 3.13.2 || exit 1
fi
PYTHON_VERSION=$(python --version)
echo "✅ Python is installed ($PYTHON_VERSION)"

if ! command -v uv &>/dev/null; then
  brew install uv || exit 1
fi
UV_VERSION=$(uv --version)
echo "✅ uv is installed ($UV_VERSION)"

# Install Go
if ! asdf plugin list | grep -q "^golang$"; then
  echo "📦 Installing golang asdf plugin..."
  asdf plugin add golang || exit 1
fi

if ! command -v go &>/dev/null; then
  echo "📦 Installing Go 1.24.2..."
  asdf install golang 1.24.2 || exit 1
  asdf set golang 1.24.2 || exit 1
fi
GO_VERSION=$(go version)
echo "✅ Go is installed ($GO_VERSION)"

# Install Rust
if ! asdf plugin list | grep -q "^rust$"; then
  echo "📦 Installing rust asdf plugin..."
  asdf plugin add rust || exit 1
fi

if ! command -v rustc &>/dev/null; then
  echo "📦 Installing Rust 1.85.1..."
  asdf install rust 1.85.1 || exit 1
  asdf set rust 1.85.1 || exit 1
fi
RUST_VERSION=$(rustc --version)
echo "✅ Rust is installed ($RUST_VERSION)"

# Install Java
if ! command -v javac &>/dev/null || ! javac --version &>/dev/null; then
  echo "☕ Installing Java..."
  brew install openjdk@17 || exit 1
  export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
fi
JAVA_VERSION=$(javac --version | head -n 1)
echo "✅ Java is installed ($JAVA_VERSION)"

# Install pnpm
if ! command -v pnpm &>/dev/null; then
  brew install pnpm || exit 1
fi
PNPM_VERSION=$(pnpm --version)
echo "✅ pnpm is installed ($PNPM_VERSION)"

# Install dependencies
echo "📦 Installing npm dependencies..."
pnpm install --silent || exit 1

# Check VS Code
if ! command -v code &>/dev/null; then
  echo "⚠️ Visual Studio Code cli is not installed"
  echo "💡 Please ensure VS Code is installed and the 'code' command is available in PATH"
  echo "   You can install it from the Command Palette: Shell Command: Install 'code' command in PATH"
  exit 1
fi
VSCODE_VERSION=$(code --version | head -n 1)
echo "✅ Visual Studio Code is installed ($VSCODE_VERSION)"

# Install VS Code extensions
echo "🔌 Installing Visual Studio Code extensions..."
code --install-extension golang.go &>/dev/null || true
code --install-extension dbaeumer.vscode-eslint &>/dev/null || true
code --install-extension redhat.java &>/dev/null || true
code --install-extension ms-python.python &>/dev/null || true
code --install-extension rust-lang.rust-analyzer &>/dev/null || true

if ! code --list-extensions 2>/dev/null | grep -q "RooVeterinaryInc.roo-cline"; then
  code --install-extension RooVeterinaryInc.roo-cline &>/dev/null || true
fi

# Clone or update evals repository
if [[ ! -d "../../evals" ]]; then
  echo "🔗 Cloning evals repository..."
  if gh auth status &>/dev/null; then
    gh repo clone cte/evals ../../evals || exit 1
  else
    git clone https://github.com/cte/evals.git ../../evals || exit 1
  fi
else
  echo "🔄 Updating evals repository..."
  (cd ../../evals && \
    git checkout -f &>/dev/null && \
    git clean -f -d &>/dev/null && \
    git checkout main &>/dev/null && \
    git pull &>/dev/null) || { echo "❌ Failed to update evals repository."; exit 1; }
fi

# Create .env.local if needed
if [[ ! -s .env.local ]]; then
  touch .env.local || exit 1
fi

# Sync database
echo "🗄️ Syncing Roo Code evals database..."
pnpm --filter @roo-code/evals db:push --force || exit 1

# Check for API key
if ! grep -q "OPENROUTER_API_KEY" .env.local; then
  echo ""
  echo "⚠️  Missing OPENROUTER_API_KEY in .env.local"
  echo "💡 Please add your OpenRouter API key manually:"
  echo "   echo 'OPENROUTER_API_KEY=sk-or-v1-...' >> .env.local"
  echo ""
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Ensure your OPENROUTER_API_KEY is set in .env.local"
echo "2. Run evaluations with: pnpm cli"
echo "3. Start the web interface with: pnpm --filter @roo-code/web-evals dev"