import type { ReactNode } from "react";
import { useEngine } from "../lib/fonts";
import { StickyHeader } from "./Sticky";

export function PageHeader({ title, summary, children }: { title: string; summary: string; children?: ReactNode }) {
  return (
    <StickyHeader className="page-header">
      <div className="page-title">
        <h1>{title}</h1>
        <p>{summary}</p>
      </div>
      {children}
    </StickyHeader>
  );
}

/** Shows a loading or error notice until the engine is ready, then the children. */
export function WhenReady({ ready, error, what, children }: {
  ready: boolean;
  error?: Error | undefined;
  what: string;
  children: ReactNode;
}) {
  if (error !== undefined) {
    return <p className="notice error" role="alert">Could not load {what}: {error.message}</p>;
  }
  if (!ready) {
    return <p className="notice" role="status">Loading {what}…</p>;
  }
  return <>{children}</>;
}

export function useEngineReady() {
  const engine = useEngine();
  return { ready: engine.value === true, error: engine.error };
}
