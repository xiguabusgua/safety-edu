import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main
          id="main"
          className="min-h-screen flex items-center justify-center px-6"
        >
          <div className="max-w-md text-center">
            <p className="smallcaps mb-3">出错了</p>
            <h1 className="font-serif text-4xl tracking-tight mb-3">
              页面遇到了一个问题
            </h1>
            <p className="text-sm text-ink-secondary mb-8 leading-relaxed">
              {this.state.error.message || '未知错误'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              重新加载
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
