/*
 * Copyright (C) 2026 Muhammad Tayyab Akram
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useRef, type PointerEvent } from "react";

/** The events of a widget that report the code unit under a pointer. */
export interface CodeUnitEvents {
  /** The code unit under the mouse changed, or `undefined` if the mouse is over no character or has left. */
  readonly onHoverChange?: (index: number | undefined) => void;
  /**
   * A press started on a code unit, or ended. It is the index of the code unit while a pointer is
   * down on a character, and `undefined` again when the pointer is released, is cancelled, moves
   * further than a tap allows or (in a scrolling widget) the content scrolls.
   */
  readonly onPressChange?: (index: number | undefined) => void;
  /**
   * The pointer was pressed and released without moving far. It is the code unit under the pointer, or
   * `undefined` if there is no character there, which is how a tap on empty space is told.
   */
  readonly onTap?: (index: number | undefined) => void;
}

/** What the widget gives for a pointer. */
export interface PointerSource {
  /** Finds the code unit under a point of the screen. */
  hitTest(clientX: number, clientY: number): number | undefined;
  /** The scroll position, which a tap must not change. Not needed by a widget that does not scroll. */
  getScroll?(): number;
}

/** How far a pointer may move and still tap, in CSS pixels. */
export const TAP_SLOP = 10;

interface Press {
  readonly x: number;
  readonly y: number;
  readonly scroll: number;
  readonly isActive: boolean;
}

/**
 * The rules that turn pointer positions into hover, press and tap events. It is plain, so it is
 * tested without a page; `usePointerEvents()` puts it behind the events of an element.
 */
export class PointerGestures {
  #press: Press | undefined;
  #hover: number | undefined;

  constructor(private readonly context: () => { source: PointerSource; events: CodeUnitEvents }) {}

  down(x: number, y: number, button = 0): void {
    if (button !== 0) {
      return;
    }
    const { source, events } = this.context();
    const index = source.hitTest(x, y);
    this.#press = { x, y, scroll: source.getScroll?.() ?? 0, isActive: index !== undefined };
    if (index !== undefined) {
      events.onPressChange?.(index);
    }
  }

  move(x: number, y: number, isMouse = true): void {
    if (isMouse) {
      this.#setHover(this.context().source.hitTest(x, y));
    }
    const press = this.#press;
    if (press !== undefined && Math.hypot(x - press.x, y - press.y) > TAP_SLOP) {
      this.#endPress();
    }
  }

  up(x: number, y: number): void {
    const { source, events } = this.context();
    const press = this.#press;
    const isTap = press !== undefined
      && Math.hypot(x - press.x, y - press.y) <= TAP_SLOP
      && (source.getScroll?.() ?? 0) === press.scroll;
    const index = isTap ? source.hitTest(x, y) : undefined;
    this.#endPress();
    if (isTap) {
      events.onTap?.(index);
    }
  }

  leave(): void {
    this.#setHover(undefined);
  }

  cancel(): void {
    this.#endPress();
    this.#setHover(undefined);
  }

  /** Ends a press, for a widget whose content scrolled. */
  cancelPress(): void {
    this.#endPress();
  }

  #endPress(): void {
    const press = this.#press;
    this.#press = undefined;
    if (press?.isActive) {
      this.context().events.onPressChange?.(undefined);
    }
  }

  #setHover(index: number | undefined): void {
    if (this.#hover !== index) {
      this.#hover = index;
      this.context().events.onHoverChange?.(index);
    }
  }
}

/**
 * Turns the pointer events of a widget into hover, press and tap events of code units, so that a
 * widget and the components built on it work with state and props alone.
 */
export function usePointerEvents(source: PointerSource, events: CodeUnitEvents) {
  const latest = useRef({ source, events });
  latest.current = { source, events };
  const gestures = useRef<PointerGestures | undefined>(undefined);
  gestures.current ??= new PointerGestures(() => latest.current);
  const g = gestures.current;

  return {
    /** The handlers to put on the element of the widget. */
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLElement>) => g.down(event.clientX, event.clientY, event.button),
      onPointerMove: (event: PointerEvent<HTMLElement>) => g.move(event.clientX, event.clientY, event.pointerType === "mouse"),
      onPointerUp: (event: PointerEvent<HTMLElement>) => g.up(event.clientX, event.clientY),
      onPointerLeave: () => g.leave(),
      onPointerCancel: () => g.cancel(),
    },
    cancelPress: () => g.cancelPress(),
  };
}
