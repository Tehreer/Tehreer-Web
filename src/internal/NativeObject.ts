// `Symbol.dispose` is part of the language only in recent engines.
(Symbol as { dispose?: symbol }).dispose ??= Symbol.for("Symbol.dispose");

interface Reference {
  readonly release: (handle: number) => void;
  readonly handle: number;
}

// A safety net for objects that were not disposed: the reference goes back to Core when the
// wrapper is collected. Nothing should depend on it, as the time of collection is not known.
const registry = new FinalizationRegistry<Reference>(({ release, handle }) => release(handle));

/**
 * An object that owns one reference to an object of Core, which it releases when it is disposed.
 *
 * Objects of Core are immutable and thread safe once they are created, so a wrapper never shares a
 * reference: whenever Core gives out a reference that it does not retain for the caller, the
 * wrapper retains its own, and the lifetime of a child never depends on that of its parent.
 */
export abstract class NativeObject implements Disposable {
  #handle: number;
  readonly #release: (handle: number) => void;

  /**
   * @param handle The address of the object of Core, which the wrapper owns a reference to.
   * @param release The function of Core that releases the reference. It must not hold the wrapper.
   */
  protected constructor(handle: number, release: (handle: number) => void) {
    this.#handle = handle;
    this.#release = release;
    registry.register(this, { release, handle }, this);
  }

  /** Tells whether `dispose()` has been called. */
  get isDisposed(): boolean {
    return this.#handle === 0;
  }

  /**
   * The address of the object of Core.
   *
   * @internal
   */
  get nativeHandle(): number {
    if (this.#handle === 0) {
      throw new Error(`${this.constructor.name} is already disposed.`);
    }
    return this.#handle;
  }

  /** Tells if both wrap the same object of Core. */
  equals(other: NativeObject): boolean {
    return this.nativeHandle === other.nativeHandle;
  }

  /** Releases the reference to the object of Core. Disposing an object again has no effect. */
  dispose(): void {
    if (this.#handle !== 0) {
      const handle = this.#handle;
      this.#handle = 0;
      registry.unregister(this);
      this.#release(handle);
    }
  }

  [Symbol.dispose](): void {
    this.dispose();
  }
}

/** Reads the handle of an optional wrapper, which is 0 (`NULL`) for none. */
export function handleOf(object: NativeObject | undefined | null): number {
  return object ? object.nativeHandle : 0;
}

