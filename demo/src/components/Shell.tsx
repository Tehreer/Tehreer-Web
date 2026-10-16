import type { ReactNode } from "react";
import { SCREENS, hrefOf } from "../screens";

export function Shell({ current, children }: { current: string; children: ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href={hrefOf("")}>
          <span className="brand-name">Tehreer Web</span>
        </a>
        <nav aria-label="Demo screens">
          {SCREENS.map((screen) => (
            <a
              key={screen.path}
              className="nav-link"
              href={hrefOf(screen.path)}
              aria-current={screen.path === current ? "page" : undefined}
            >
              {screen.title}
            </a>
          ))}
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
