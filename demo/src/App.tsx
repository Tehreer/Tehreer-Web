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

import { Component, useEffect, useState, type ReactNode } from "react";
import { Shell } from "./components/Shell";
import { SCREENS } from "./screens";

function currentPath(): string {
  return window.location.hash.replace(/^#\/?/, "").split("?")[0]!;
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | undefined }> {
  override state = { error: undefined as Error | undefined };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override render() {
    const { error } = this.state;
    return error === undefined ? (
      this.props.children
    ) : (
      <p className="notice error" role="alert">
        Something went wrong: {error.message}
      </p>
    );
  }
}

export function App() {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const screen = SCREENS.find((candidate) => candidate.path === path) ?? SCREENS[0]!;
  const Page = screen.component;

  return (
    <Shell current={screen.path}>
      <ErrorBoundary key={screen.path}>
        <Page />
      </ErrorBoundary>
    </Shell>
  );
}
