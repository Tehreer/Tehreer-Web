import { CoreView } from "../collections/CoreView.js";
import type { NativeObject } from "../internal/NativeObject.js";
import { TRVariationAxis } from "../internal/Structs.js";
import type { SfntTag } from "../sfnt/SfntTag.js";

const FLAG_HIDDEN = 0x0001;

/** An axis along which a variable font changes. */
export interface VariationAxis {
  /** The tag of the axis, such as `wght`. */
  readonly tag: SfntTag;
  readonly name: string | undefined;
  /** Tells whether the font asks to hide the axis from the users. */
  readonly isHidden: boolean;
  readonly minValue: number;
  readonly maxValue: number;
  readonly defaultValue: number;
}

/** An axis that is read from the memory of Core when its properties are read. @internal */
export class CoreVariationAxis extends CoreView<ReturnType<typeof TRVariationAxis.view>> implements VariationAxis {
  constructor(owner: NativeObject, address: number) {
    super(owner, TRVariationAxis.view(address));
  }

  get tag(): SfntTag {
    return this.core.tag;
  }

  get name(): string | undefined {
    return this.core.name;
  }

  get isHidden(): boolean {
    return (this.core.flags & FLAG_HIDDEN) !== 0;
  }

  get minValue(): number {
    return this.core.minValue;
  }

  get maxValue(): number {
    return this.core.maxValue;
  }

  get defaultValue(): number {
    return this.core.defaultValue;
  }
}
