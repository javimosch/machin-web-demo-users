#!/usr/bin/env bash
# Build the users back-office: a wasm client + a native server binary that serves
# it. Needs machin v0.57.0+ (ptr_str), zig (C->wasm), and libsqlite3 (the server
# links it for the SQLite builtins).
set -euo pipefail
cd "$(dirname "$0")"
MACHIN="${MACHIN:-machin}"
command -v "$MACHIN" >/dev/null 2>&1 || { echo "error: '$MACHIN' not found (set MACHIN=/path/to/machin)"; exit 1; }

# 1. wasm CLIENT: reactive runtime + the view.
"$MACHIN" encode src/reactive.src src/client.src > client.mfl
"$MACHIN" build client.mfl --target wasm -o app.wasm
echo "built ./app.wasm ($(wc -c < app.wasm) bytes)"

# 2. embed the JS host as host_js().
python3 - <<'PY' > src/host_gen.src
import json
print('func host_js() (s) { s = ' + json.dumps(open('web/host.js').read()) + ' }')
PY

# 3. native SERVER: machweb + flags + page + server + the host.
"$MACHIN" encode src/machweb.src src/flags.src src/page.src src/server.src src/host_gen.src > server.mfl
"$MACHIN" build server.mfl -o machin-users
echo "built ./machin-users"
echo "run:  ./machin-users   (then open http://localhost:48097/)"
