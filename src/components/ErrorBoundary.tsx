import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center text-red-500 max-w-4xl mx-auto mt-10">
          <h1 className="text-2xl font-bold mb-4">Sorry.. there was an error</h1>
          <p className="mb-4">We caught an error during rendering. Here are the details:</p>
          <div className="text-left bg-slate-100 p-4 rounded mt-4 overflow-auto text-sm border border-slate-300">
            <h2 className="font-bold mb-2">Error Message:</h2>
            <pre className="whitespace-pre-wrap">{this.state.error?.toString()}</pre>
            
            {this.state.errorInfo && (
              <>
                <h2 className="font-bold mt-4 mb-2">Component Stack:</h2>
                <pre className="whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
              </>
            )}
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-6 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
