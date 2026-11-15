import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { failed: boolean };

/** Keeps an unexpected UI rendering failure from leaving visitors on a blank page. */
export class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState { return { failed: true }; }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Intentionally do not expose error details, request contents, or scientific data to visitors.
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="app-fallback"><div className="eyebrow">Lunar Compass</div><h1>We could not display this view.</h1><p>The selected plan has not been changed. Return to Explore and try the request again.</p><a className="primary-action" href="/explore">Return to Explore</a></main>;
  }
}
