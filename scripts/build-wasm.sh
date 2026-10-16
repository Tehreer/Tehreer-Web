#!/usr/bin/env bash
# Builds Tehreer Core and the glue into src/wasm/tehreer.{js,wasm} with Emscripten.
#
#   TEHREER_CORE   Tehreer Core checkout (default: ../Tehreer-Core)
#   TR_DEPS_SRC    directory with the *-src folders of the dependencies, as left by a configured
#                  build of Core (default: $TEHREER_CORE/build/_deps)
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
core="${TEHREER_CORE:-$root/../Tehreer-Core}"
deps_src="${TR_DEPS_SRC:-$core/build/_deps}"
deps="$root/build/deps"
build="$root/build/wasm"

if ! command -v emcmake >/dev/null; then
    echo "emcmake not found: install Emscripten (brew install emscripten) or activate emsdk." >&2
    exit 1
fi

# Core expects the dependencies in folders named after them.
node "$root/scripts/generate-bindings.mjs"
mkdir -p "$deps" "$root/src/wasm"
for pair in freetype:freetype harfbuzz:harfbuzz libunibreak:libunibreak SheenBidi:sheenbidi; do
    name="${pair%%:*}"
    dir="${pair##*:}"
    if [ ! -d "$deps_src/$dir-src" ]; then
        echo "Missing $deps_src/$dir-src; configure a build of Core first or set TR_DEPS_SRC." >&2
        exit 1
    fi
    ln -sfn "$deps_src/$dir-src" "$deps/$name"
done

emcmake cmake -S "$root/native" -B "$build" -DCMAKE_BUILD_TYPE=Release \
    -DTEHREER_CORE_DIR="$core" -DTR_DEPS_DIR="$deps"
cmake --build "$build" --target tehreer -j

ls -la "$root/src/wasm"
