import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";

/**
 * Publishes the height of an element as a CSS variable of the page, so that what sticks below it can
 * use `top: var(--name)`. The variable is removed when the element goes.
 */
export function useStickyHeight(ref: RefObject<HTMLElement | null>, name: string): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) {
      return undefined;
    }
    const root = document.documentElement;
    const publish = () => root.style.setProperty(name, `${element.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty(name);
    };
  }, [ref, name]);
}

/** The bar at the top of a page: it stays in view, and publishes its height as `--header-height`. */
export function StickyHeader({ className = "", children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useStickyHeight(ref, "--header-height");
  return (
    <header ref={ref} className={`sticky-header ${className}`.trim()}>
      {children}
    </header>
  );
}

/** The height of everything that sticks at the top of the page right now, in pixels. */
export function stickyStackHeight(...names: string[]): number {
  const style = getComputedStyle(document.documentElement);
  return names.reduce((sum, name) => sum + (Number.parseFloat(style.getPropertyValue(name)) || 0), 0);
}
