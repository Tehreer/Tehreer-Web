/** Which canvas draws which line, for canvases that are reused as lines scroll in and out of view. */
export interface SlotAssignment {
  /** The slot of every line that has one. */
  readonly slots: ReadonlyMap<number, number>;
  /** The number of canvases that exist. It only grows, as long as the assignment is carried over. */
  readonly slotCount: number;
}

export const NO_SLOTS: SlotAssignment = { slots: new Map(), slotCount: 0 };

/**
 * Gives a slot to every visible line. A line that was visible keeps its slot, so its canvas is not
 * drawn again; a line that is new takes the lowest slot that is free, and a slot is added only when
 * all of them are busy. Nothing is kept for a line that is not visible any more.
 *
 * @returns The previous assignment itself when the visible lines are the same.
 */
export function assignSlots(previous: SlotAssignment, visible: readonly number[]): SlotAssignment {
  const wanted = new Set(visible);
  if (wanted.size === previous.slots.size && visible.every((line) => previous.slots.has(line))) {
    return previous;
  }

  const slots = new Map<number, number>();
  const busy = new Set<number>();
  for (const line of visible) {
    const slot = previous.slots.get(line);
    if (slot !== undefined) {
      slots.set(line, slot);
      busy.add(slot);
    }
  }

  let slotCount = previous.slotCount;
  let next = 0;
  for (const line of visible) {
    if (!slots.has(line)) {
      while (busy.has(next)) {
        next++;
      }
      slots.set(line, next);
      busy.add(next);
      slotCount = Math.max(slotCount, next + 1);
    }
  }
  return { slots, slotCount };
}
