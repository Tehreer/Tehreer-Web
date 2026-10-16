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
