import { installCallbacks } from "./internal/Callbacks.js";
import { readCodeUnits, StringEncodingUTF8 } from "./internal/Memory.js";
import { Module, setModule, type TehreerModule } from "./internal/Module.js";
import createModule from "./wasm/tehreer.js";

/** How to load the WebAssembly module. */
export interface InitializeOptions {
  /**
   * Where to find the file of the module, which is next to the script of the module by default.
   * It is called with the name of the file, and returns its location.
   */
  readonly locateFile?: (fileName: string) => string;
}

let loading: Promise<void> | undefined;

/**
 * Loads Tehreer. Everything else in the library needs it to be done, and fails until it is. It can
 * be called more than once: the module is loaded once, and every call waits for it.
 */
export function initialize(options: InitializeOptions = {}): Promise<void> {
  loading ??= (async () => {
    const module = (await createModule(
      options.locateFile === undefined ? {} : { locateFile: options.locateFile },
    )) as TehreerModule;
    setModule(module);
    installCallbacks();
  })();
  return loading;
}

/** The version of Tehreer Core that the module was built with, such as `1.0.0`. */
export function getVersion(): string {
  const pointer = Module._tw_version();
  let length = 0;
  while ((Module.HEAPU8[pointer + length] ?? 0) !== 0) {
    length++;
  }
  return readCodeUnits(pointer, length, StringEncodingUTF8);
}
