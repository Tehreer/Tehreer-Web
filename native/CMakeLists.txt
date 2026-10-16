cmake_minimum_required(VERSION 3.16)
project(TehreerWasm C CXX)

# Tehreer Core checkout.
set(TEHREER_CORE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../Tehreer-Core" CACHE PATH "Tehreer Core")
# Directory with freetype, harfbuzz, libunibreak and SheenBidi, as TR_DEPS_DIR of Core expects.
set(TR_DEPS_DIR "" CACHE PATH "Pre-fetched sources of the dependencies of Core")
# Where the generated module is written.
set(TW_OUTPUT_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../src/wasm" CACHE PATH "Output directory")

set(TR_CONFIG_UNITY ON CACHE BOOL "" FORCE)
set(BUILD_TESTING OFF CACHE BOOL "" FORCE)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)

add_subdirectory(${TEHREER_CORE_DIR} tehreer-core EXCLUDE_FROM_ALL)

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
