import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Oops, something went wrong.</h1>
          <pre className="bg-zinc-900 p-4 rounded-xl text-sm overflow-auto max-w-full">
            {this.state.error?.message || 'Unknown error'}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 bg-blue-600 px-6 py-2 rounded-xl font-bold hover:bg-blue-700"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
