import { useLayoutEffect, useState, type RefObject } from "react";

/** The part of a content that is in view, in the coordinates of the content. */
export interface VisibleRange {
  readonly top: number;
  readonly bottom: number;
}

/**
 * Works out which part of a content is in view from where its top is in the viewport, whatever
 * scrolls: when the top is above the viewport, the first part is out of view.
 *
 * @param contentTop The distance from the top of the viewport to the top of the content, which is negative once the content scrolled up.
 * @param viewportHeight The height of the viewport.
 * @param contentHeight The height of the content, to keep the range inside of it.
 */
export function computeVisibleRange(contentTop: number, viewportHeight: number, contentHeight = Infinity): VisibleRange {
  const top = Math.min(Math.max(0, -contentTop), contentHeight);
  const bottom = Math.min(Math.max(viewportHeight - contentTop, top), contentHeight);
  return { top, bottom };
}

/**
 * Measures what is in view of an element that is scrolled by the window, or by `scroller`.
 * Nothing is read from `scrollTop`: the box of the element tells where it is.
 */
export function measureVisibleRange(content: HTMLElement, scroller?: HTMLElement | null): VisibleRange {
  const box = content.getBoundingClientRect();
  if (scroller === undefined || scroller === null) {
    return computeVisibleRange(box.top, window.innerHeight, box.height);
  }
  return computeVisibleRange(box.top - scroller.getBoundingClientRect().top, scroller.clientHeight, box.height);
}

/** Scrolls so that a y of the content is at the top of the viewport. */
export function scrollContentTo(content: HTMLElement, y: number, scroller?: HTMLElement | null, smooth = false): void {
  const behavior = smooth ? "smooth" : "auto";
  if (scroller === undefined || scroller === null) {
    window.scrollTo({ top: window.scrollY + content.getBoundingClientRect().top + y, behavior });
  } else {
    scroller.scrollTo({ top: scroller.scrollTop + content.getBoundingClientRect().top - scroller.getBoundingClientRect().top + y, behavior });
  }
}

/** Runs `onChange` when the window or the scroller scrolls or resizes, at most once per frame. */
export function observeScroll(scroller: HTMLElement | null | undefined, onChange: () => void): () => void {
  let frame = 0;
  const schedule = () => {
    if (frame === 0) {
      frame = requestAnimationFrame(() => {
        frame = 0;
        onChange();
      });
    }
  };
  const target: HTMLElement | Window = scroller ?? window;
  target.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  return () => {
    cancelAnimationFrame(frame);
    target.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
  };
}

/**
 * The part of a content that is in view while the window (or `scroller`) scrolls, for lists that
 * draw only what is in view. It changes with scrolling and resizing, and with `deps`, such as the
 * size of the content.
 */
export function useVisibleRange(
  content: RefObject<HTMLElement | null>,
  scroller?: RefObject<HTMLElement | null>,
  deps: readonly unknown[] = [],
): VisibleRange {
  const [range, setRange] = useState<VisibleRange>({ top: 0, bottom: 0 });

  useLayoutEffect(() => {
    const element = content.current;
    if (element === null) {
      return undefined;
    }
    const update = () => {
      const next = measureVisibleRange(element, scroller?.current);
      setRange((current) => (current.top === next.top && current.bottom === next.bottom ? current : next));
    };
    update();
    return observeScroll(scroller?.current, update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, scroller, ...deps]);

  return range;
}
