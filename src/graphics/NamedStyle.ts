import type { Float } from "../collections/NumberKind.js";
import { CoreView } from "../collections/CoreView.js";
import { coreNumbers } from "../collections/CoreList.js";
import type { NumberList } from "../collections/List.js";
import type { NativeObject } from "../internal/NativeObject.js";
import { f32 } from "../internal/Struct.js";
import { TRNamedStyle } from "../internal/Structs.js";

/** A named instance of a variable font, such as "Bold". */
export interface NamedStyle {
  readonly styleName: string | undefined;
  /** The variation coordinates in the order of the variation axes of the typeface. */
  readonly coordinates: NumberList<Float>;
  readonly postScriptName: string | undefined;
}

/** A style that is read from the memory of Core when its properties are read. @internal */
export class CoreNamedStyle extends CoreView<ReturnType<typeof TRNamedStyle.view>> implements NamedStyle {
  constructor(owner: NativeObject, address: number) {
    super(owner, TRNamedStyle.view(address));
  }

  get styleName(): string | undefined {
    return this.core.subfamilyName;
  }

  get coordinates(): NumberList<Float> {
    const style = this.core;
    return coreNumbers(this.owner, style.coordinatesPtr, style.coordinateCount, f32);
  }

  get postScriptName(): string | undefined {
    return this.core.postScriptName;
  }
}
