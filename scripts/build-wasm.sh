#!/usr/bin/env bash
# Copyright (C) 2026 Muhammad Tayyab Akram
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Builds Tehreer Core and the glue into src/wasm/tehreer.{js,wasm} with Emscripten.
#
# Core and its dependencies are fetched by CMake into build/wasm/_deps (the commit of Core is set in
# native/CMakeLists.txt).
#
#   TEHREER_CORE   optional local checkout of Core to use instead of fetching it
#   TR_DEPS_SRC    optional directory with the *-src folders of the dependencies, as left by a
#                  configured build of Core
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
deps="$root/build/deps"
build="$root/build/wasm"

if ! command -v emcmake >/dev/null; then
    echo "emcmake not found: install Emscripten (brew install emscripten) or activate emsdk." >&2
    exit 1
fi

mkdir -p "$root/src/wasm"
cmake_args=(-DCMAKE_BUILD_TYPE=Release)

if [ -n "${TEHREER_CORE:-}" ]; then
    cmake_args+=(-DFETCHCONTENT_SOURCE_DIR_TEHREERCORE="$(cd "$TEHREER_CORE" && pwd)")
fi

if [ -n "${TR_DEPS_SRC:-}" ]; then
    # Core expects the dependencies in folders named after them.
    mkdir -p "$deps"
    for pair in freetype:freetype harfbuzz:harfbuzz libunibreak:libunibreak SheenBidi:sheenbidi; do
        name="${pair%%:*}"
        dir="${pair##*:}"
        if [ ! -d "$TR_DEPS_SRC/$dir-src" ]; then
            echo "Missing $TR_DEPS_SRC/$dir-src; configure a build of Core first or unset TR_DEPS_SRC." >&2
            exit 1
        fi
        ln -sfn "$TR_DEPS_SRC/$dir-src" "$deps/$name"
    done
    cmake_args+=(-DTR_DEPS_DIR="$deps")
fi

# Configuring fetches Core and the dependencies, whose headers the bindings are generated from.
emcmake cmake -S "$root/native" -B "$build" "${cmake_args[@]}"

core="${TEHREER_CORE:-$build/_deps/tehreercore-src}"
sheenbidi="${TR_DEPS_SRC:+$deps/SheenBidi}"
sheenbidi="${sheenbidi:-$build/_deps/sheenbidi-src}"
SHEENBIDI_DIR="$sheenbidi" TEHREER_CORE="$core" node "$root/scripts/generate-bindings.mjs"

cmake --build "$build" --target tehreer -j

ls -la "$root/src/wasm"
