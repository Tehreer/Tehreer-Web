// Declares the module that `scripts/build-wasm.sh` generates next to this file.
declare const createModule: (options?: { locateFile?: (fileName: string) => string }) => Promise<unknown>;
export default createModule;
