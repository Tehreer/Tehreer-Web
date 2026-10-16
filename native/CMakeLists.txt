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

cmake_minimum_required(VERSION 3.16)
project(TehreerWasm C CXX)

# Directory with freetype, harfbuzz, libunibreak and SheenBidi, as TR_DEPS_DIR of Core expects.
set(TR_DEPS_DIR "" CACHE PATH "Pre-fetched sources of the dependencies of Core")
# Where the generated module is written.
set(TW_OUTPUT_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../src/wasm" CACHE PATH "Output directory")

set(TR_CONFIG_UNITY ON CACHE BOOL "" FORCE)
set(BUILD_TESTING OFF CACHE BOOL "" FORCE)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)

include(FetchContent)

# Tehreer Core, fetched at a fixed commit. Set FETCHCONTENT_SOURCE_DIR_TEHREERCORE to use a local
# checkout instead.
FetchContent_Declare(
  TehreerCore
  GIT_REPOSITORY https://github.com/Tehreer/Tehreer-Core.git
  GIT_TAG 1d21938eff8931388974d744bc094800501c2a0a
  EXCLUDE_FROM_ALL
)
FetchContent_MakeAvailable(TehreerCore)

add_executable(tehreer Module.c)
set_target_properties(tehreer PROPERTIES
  C_STANDARD 11
  C_STANDARD_REQUIRED ON
  RUNTIME_OUTPUT_DIRECTORY ${TW_OUTPUT_DIR}
)
target_link_libraries(tehreer PRIVATE Tehreer::Tehreer)

# The module is single threaded, so no SharedArrayBuffer or cross-origin isolation is needed. The
# functions that it exports are generated from the headers of Core by scripts/generate-bindings.mjs.
set(TW_RUNTIME_METHODS
  addFunction removeFunction stackSave stackRestore stackAlloc
  HEAP8 HEAPU8 HEAP16 HEAPU16 HEAP32 HEAPU32 HEAPF32
)
list(JOIN TW_RUNTIME_METHODS "," TW_RUNTIME_METHODS_ARG)

target_link_options(tehreer PRIVATE
  -sMODULARIZE=1
  -sEXPORT_ES6=1
  -sEXPORT_NAME=createTehreer
  -sENVIRONMENT=web,worker,node
  -sALLOW_MEMORY_GROWTH=1
  -sALLOW_TABLE_GROWTH=1
  -sINITIAL_MEMORY=33554432
  -sSTACK_SIZE=1048576
  -sFILESYSTEM=0
  -sEXPORTED_FUNCTIONS=@${CMAKE_CURRENT_SOURCE_DIR}/exports.json
  -sEXPORTED_RUNTIME_METHODS=${TW_RUNTIME_METHODS_ARG}
  -O2
)
set_property(TARGET tehreer APPEND PROPERTY LINK_DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/exports.json)
