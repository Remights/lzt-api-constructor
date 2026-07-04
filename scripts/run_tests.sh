#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "=== pytest ==="
python -m pytest tests/ -q
for t in tests/js_generators.test.js tests/features_share.test.js tests/scenario_normalize.test.js tests/scenario_engine.test.js tests/scenario_validate.test.js; do
  echo "=== node $t ==="
  node "$t"
done
echo ""
echo "All 53 tests passed."
