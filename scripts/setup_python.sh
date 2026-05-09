#!/bin/bash
# Tworzy venv i instaluje zależności dla score.py
set -e

VENV_DIR="$(dirname "$0")/../.venv"

echo "Tworzenie środowiska Python w: $VENV_DIR"
python3 -m venv "$VENV_DIR"

echo "Instalacja zależności..."
"$VENV_DIR/bin/pip" install --upgrade pip -q
"$VENV_DIR/bin/pip" install -r "$(dirname "$0")/requirements.txt"

echo ""
echo "✓ Gotowe! Uruchamiaj score.py przez:"
echo "  .venv/bin/python scripts/score.py <katalog> -p <fotograf>"
echo ""
echo "Lub dodaj alias do ~/.zshrc:"
echo "  alias scorephotos='.venv/bin/python $(pwd)/scripts/score.py'"
