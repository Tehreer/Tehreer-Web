/** Checks that `index` is a whole number from 0 up to and including `limit`. */
export function checkIndex(name: string, index: number, limit: number): void {
  if (!Number.isInteger(index) || index < 0 || index > limit) {
    throw new RangeError(`${name} (${index}) is out of the range 0..${limit}.`);
  }
}

/** Checks that `fromIndex <= toIndex` and both are within 0..`limit`. */
export function checkRange(fromIndex: number, toIndex: number, limit: number): void {
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    fromIndex > toIndex ||
    toIndex > limit
  ) {
    throw new RangeError(`The range ${fromIndex}..${toIndex} is not within 0..${limit}.`);
  }
}

/**
 * Checks that the range is made of whole numbers, which are not negative and do not decrease. How
 * far it goes is up to Core, which knows the length of the text.
 */
export function checkOrderedRange(fromIndex: number, toIndex: number): void {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex < 0 || fromIndex > toIndex) {
    throw new RangeError(`The range ${fromIndex}..${toIndex} is not valid.`);
  }
}

/** Checks that `index` is a whole number from 0 up to, but not including, `count`. */
export function checkElement(name: string, index: number, count: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new RangeError(`${name} (${index}) is out of the range 0..${count - 1}.`);
  }
}

/** Throws if the result of a function of Core is `NULL`, which means that it failed. */
export function checkCreated(handle: number, what: string): number {
  if (handle === 0) {
    throw new Error(`Could not create ${what}.`);
  }
  return handle;
}
