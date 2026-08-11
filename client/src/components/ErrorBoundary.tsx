import { Component, type ReactNode } from 'react';

// SPA error boundary. Ports Next's error.tsx/global-error.tsx (route + root variants)
// into a single boundary — there's only one React tree here, so one card suffices.
interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error(error, info);
  }

  reset = () => {
    // A full reload is the simplest way to guarantee providers/state re-init cleanly.
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 dark:from-purple-950 dark:via-blue-950 dark:to-indigo-950 px-4">
        <div className="w-full max-w-md px-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20 text-center">
            <h1 className="text-4xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-white/70 mb-8">
              An unexpected error occurred. You can try again, or head back to the battle.
            </p>

            <button
              onClick={this.reset}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg mb-4 cursor-pointer"
            >
              Try again
            </button>

            <a
              href="/battle"
              className="block w-full text-white/70 hover:text-white text-sm underline transition-colors"
            >
              Return to battle
            </a>
          </div>
        </div>
      </div>
    );
  }
}
