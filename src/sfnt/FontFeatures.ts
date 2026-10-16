import { CoreList } from "../collections/CoreList.js";
import type { List } from "../collections/List.js";
import { adopt } from "../internal/Adopt.js";
import { free, malloc } from "../internal/Memory.js";
import { Module } from "../internal/Module.js";
import { NativeObject } from "../internal/NativeObject.js";
import { TROpenTypeFeature } from "../internal/Structs.js";
import { checkCreated } from "../internal/Validation.js";
import type { OpenTypeFeature } from "./OpenTypeFeature.js";

/** Runs a body with the features copied to the memory of the module, which is freed after. @internal */
export function withOpenTypeFeatures<T>(
  features: readonly OpenTypeFeature[],
  body: (pointer: number, count: number) => T,
): T {
  const pointer = malloc(features.length * TROpenTypeFeature.size);
  try {
    features.forEach((feature, index) => {
      TROpenTypeFeature.assign(pointer + index * TROpenTypeFeature.size, feature);
    });
    return body(pointer, features.length);
  } finally {
    free(pointer);
  }
}

/** A set of OpenType features, which text can carry as an attribute. */
export class FontFeatures extends NativeObject {
  constructor(features: readonly OpenTypeFeature[]);
  /** @internal */
  constructor(token: typeof adopt, handle: number);
  constructor(features: readonly OpenTypeFeature[] | typeof adopt, handle?: number) {
    super(
      features === adopt
        ? (handle as number)
        : checkCreated(
            withOpenTypeFeatures(features, (pointer, count) => Module._TRFontFeaturesCreate(pointer, count)),
            "font features",
          ),
      (h) => Module._TRFontFeaturesRelease(h),
    );
  }

  /** Makes a wrapper for font features that Core does not retain for the caller. @internal */
  static retaining(handle: number): FontFeatures {
    return new FontFeatures(adopt, Module._TRFontFeaturesRetain(handle));
  }

  get count(): number {
    return Module._TRFontFeaturesGetCount(this.nativeHandle);
  }

  /** The features, in the order that they were given. */
  get items(): List<OpenTypeFeature> {
    const handle = this.nativeHandle;
    return new CoreList(this, Module._TRFontFeaturesGetItemsPtr(handle), Module._TRFontFeaturesGetCount(handle), {
      size: TROpenTypeFeature.size,
      read: (address) => TROpenTypeFeature.snapshot(address),
    });
  }
}
