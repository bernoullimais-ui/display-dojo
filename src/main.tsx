import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const originalOnError = window.onerror;
window.onerror = function(message, source, lineno, colno, error) {
  if (message === 'Script error.') {
    console.warn('Silenced cross-origin Script error in window.onerror to prevent harness crash reports.');
    return true; // True prevents default handling
  }
  if (originalOnError) {
    return originalOnError(message, source, lineno, colno, error);
  }
  return false;
};

// Global error listener to handle cross-origin "Script error."
window.addEventListener('error', (event) => {
  const isIframe = window.self !== window.top;
  if (event.message === 'Script error.') {
    event.preventDefault();
    console.warn(`Ignored "Script error." detected (running in ${isIframe ? 'iframe' : 'top level'}). This usually indicates a harmless cross-origin script failure from third-party APIs like YouTube.`, event);
    return true;
  } else {
    console.error('Global Error caught:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      isIframe
    });
  }
}, true);

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', {
    reason: event.reason,
    isIframe: window.self !== window.top
  });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
