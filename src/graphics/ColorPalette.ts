import type { UInt32 } from "../collections/NumberKind.js";
import { CoreView } from "../collections/CoreView.js";
import { coreNumbers } from "../collections/CoreList.js";
import type { NumberList } from "../collections/List.js";
import type { NativeObject } from "../internal/NativeObject.js";
import { u32 } from "../internal/Struct.js";
import { TRPredefinedPalette } from "../internal/Structs.js";

/** A palette of a color font, which a typeface can be switched to. */
export interface ColorPalette {
  readonly name: string | undefined;
  /** The flags of the palette, which tell if it suits a light or a dark background. */
  readonly flags: number;
  /** The color of each palette entry of the typeface, in order. */
  readonly colors: NumberList<UInt32>;
}

/** A palette that is read from the memory of Core when its properties are read. @internal */
export class CoreColorPalette extends CoreView<ReturnType<typeof TRPredefinedPalette.view>> implements ColorPalette {
  constructor(owner: NativeObject, address: number) {
    super(owner, TRPredefinedPalette.view(address));
  }

  get name(): string | undefined {
    return this.core.name;
  }

  get flags(): number {
    return this.core.flags;
  }

  get colors(): NumberList<UInt32> {
    const palette = this.core;
    return coreNumbers(this.owner, palette.colorsPtr, palette.colorCount, u32);
  }
}
