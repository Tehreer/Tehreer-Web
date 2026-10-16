import type { NativeObject } from "../internal/NativeObject.js";

/**
 * The base of the objects that read a struct of Core when their properties are read. The struct
 * belongs to an owner, which keeps it alive in Core, so they check that it is not disposed.
 *
 * @internal
 */
export abstract class CoreView<V> {
  readonly #owner: NativeObject;
  readonly #view: V;

  protected constructor(owner: NativeObject, view: V) {
    this.#owner = owner;
    this.#view = view;
  }

  /** The struct, if the owner is not disposed. */
  protected get core(): V {
    void this.#owner.nativeHandle;
    return this.#view;
  }

  protected get owner(): NativeObject {
    return this.#owner;
  }
}
