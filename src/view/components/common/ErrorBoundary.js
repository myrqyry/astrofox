import React from 'react';
import Logger from 'core/Logger';
import ErrorFallback from './ErrorFallback';
import { raiseError } from 'view/actions/error';

/**
 * ErrorBoundary - class component to catch rendering errors in children,
 * log them via the existing Logger system and display a friendly fallback UI.
 *
 * Props:
 * - name (string): optional name used for logger instance (defaults to 'ErrorBoundary')
 * - fallback (ReactComponent): optional custom fallback UI component
 * - onError (function): optional callback invoked with (error, info)
 * - onRetry (function): optional callback invoked when user retries
 *
 * Behavior:
 * - Uses getDerivedStateFromError to set error state
 * - componentDidCatch logs error + component stack via Logger.error
 * - Provides a Retry button that remounts children by bumping an internal resetKey
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      info: null,
      // resetKey is used to force remount children on retry
      resetKey: 0,
    };

    // Create a Logger instance scoped by provided name for better traceability
    const loggerName = (props && props.name) || 'ErrorBoundary';
    this.logger = new Logger(loggerName);
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Save info for displaying or copying
    this.setState({ error, info });

    // Log error and component stack for debugging
    try {
      const stack = info && info.componentStack ? info.componentStack : info;
      this.logger.error('Caught error in component tree:', error, stack);
    } catch (e) {
      // Fallback to console if logging fails
      // eslint-disable-next-line no-console
      console.error('Logger failed in ErrorBoundary', e);
      // eslint-disable-next-line no-console
      console.error(error, info);
    }

    // Also surface to the centralized error handling system so it can show modals
    try {
      // Provide a succinct message and attach original error for richer logs
      raiseError('A rendering error occurred in the UI', error);
    } catch (e) {
      // Swallow to avoid cascading failures in the error path
      try {
        this.logger.error('raiseError failed in ErrorBoundary', e && (e.stack || e.message || e));
      } catch (ex) {
        // eslint-disable-next-line no-console
        console.error('Failed to report ErrorBoundary error', ex);
      }
    }

    // Call optional external onError handler
    if (typeof this.props.onError === 'function') {
      try {
        this.props.onError(error, info);
      } catch (e) {
        // swallow to avoid infinite loops
      }
    }
  }

  handleRetry = () => {
    // Reset error state and bump resetKey to remount children
    this.setState(
      prev => ({
        hasError: false,
        error: null,
        info: null,
        resetKey: prev.resetKey + 1,
      }),
      () => {
        if (typeof this.props.onRetry === 'function') {
          try {
            this.props.onRetry();
          } catch (e) {
            // ignore
          }
        }
      },
    );
  };

  render() {
    const { hasError, error, info, resetKey } = this.state;
    const { fallback: FallbackComponent } = this.props;

    if (hasError) {
      const Fallback = FallbackComponent || ErrorFallback;
      return <Fallback error={error} info={info} onRetry={this.handleRetry} />;
    }

    // Use resetKey so children are remounted after retry
    return <React.Fragment key={resetKey}>{this.props.children}</React.Fragment>;
  }
}