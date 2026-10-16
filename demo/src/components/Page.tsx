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
