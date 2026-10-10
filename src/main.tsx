import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  error: Error | null;
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = { error: null };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  public render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="min-h-screen w-full bg-[#070605] text-[#f3ede2] flex flex-col items-center justify-center p-6 text-center font-mono">
          <h1 className="text-lg font-semibold text-[#e5c158] mb-3">
            NEUROMICON ARTMAZE · RECOVERY MODE
          </h1>
          <p className="text-xs text-[#a89f91] max-w-md mb-6">
            {this.state.error.message}
          </p>
          <button
            onClick={() => {
              try {
                window.localStorage.clear();
              } catch {
                // ignore
              }
              window.location.reload();
            }}
            className="px-6 py-2.5 rounded bg-[#c8a464] text-[#0b0a09] text-xs font-semibold uppercase tracking-widest cursor-pointer"
          >
            Reset State & Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

(window as unknown as Record<string, boolean>).__ARTMAZE_BOOTED__ = true;

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  );
}

