import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { useThemeStore } from './stores/theme';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

/**
 * Toaster 跟主题走:订阅 useThemeStore,切换时颜色/边框跟着变。
 * 颜色直接用 CSS variable,避免硬编码。
 */
function ThemedToaster() {
  const theme = useThemeStore((s) => s.theme);
  return (
    <Toaster
      theme={theme}
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        style: {
          background:
            theme === 'dark' ? 'rgb(26 26 26 / 1)' : 'rgb(255 255 255 / 1)',
          border:
            theme === 'dark'
              ? '1px solid rgb(255 255 255 / 0.08)'
              : '1px solid rgb(0 0 0 / 0.08)',
          color: theme === 'dark' ? 'rgb(237 237 237 / 1)' : 'rgb(17 17 17 / 1)',
          fontSize: '14px',
        },
      }}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <>
      <div className="grain-overlay" aria-hidden="true" />
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
            <ThemedToaster />
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </>
  </React.StrictMode>,
);
