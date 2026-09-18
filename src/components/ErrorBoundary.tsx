import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid h-full w-full place-items-center p-8">
          <div className="max-w-[560px]">
            <h1 className="text-[16px] font-semibold text-[var(--text)]">
              Something went wrong
            </h1>
            <pre className="mt-3 whitespace-pre-wrap rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-sidebar)] p-3 text-[12px] text-[var(--text-muted)]">
              {this.state.error.message}
            </pre>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="mt-3 rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-[13px] text-[var(--text)] hover:bg-[var(--bg-hover)]"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
