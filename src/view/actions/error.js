/* Replace the file with a standardized error handling utility and store */

// eslint-disable-next-line import/no-unresolved
import { createSlice } from './rootStore';
import { logger } from 'global';
import { showModal } from './modals';

/**
 * error store - keeps the last error/message for UI
 */
const initialState = {
  error: null,
  message: null,
};

const errorStore = createSlice('error');

export function clearError() {
  errorStore.setState({ ...initialState });
}

/**
 * AppError - standardized error wrapper to preserve original error
 * Usage: throw new AppError('Failed to X', { code: 'E_X', original: err });
 */
export class AppError extends Error {
  constructor(message, { code = null, original = null } = {}) {
    super(message);
    this.name = 'AppError';
    if (code) this.code = code;
    if (original) this.original = original;
    // preserve stack from original when available
    if (original && original.stack) {
      this.stack = `${this.stack}\nCaused by: ${original.stack}`;
    }
  }
}

/**
 * raiseError - central place to log and surface errors to the UI.
 * - Logs with the global logger (includes stack when available)
 * - Updates error store so UI can react
 * - Attempts to open the global ErrorDialog modal (silently fails if modal system errors)
 */
export function raiseError(message, error = null) {
  const msg = message || (error && error.message) || 'An unknown error occurred';

  try {
    if (error) {
      // Prefer stack for richer logs
      const stackOrString = error.stack || error.toString();
      logger.error('%s\n%s', msg, stackOrString);
    } else {
      logger.error(msg);
    }
  } catch (e) {
    // best-effort logging; swallow to avoid cascading failures
    // eslint-disable-next-line no-console
    console.error('Failure while logging error', e);
    // eslint-disable-next-line no-console
    console.error(message, error);
  }

  // Update visible error state for UI components
  errorStore.setState({ message: msg, error });

  // Try to show an error modal; if it fails, log but don't throw
  try {
    showModal('ErrorDialog', { title: 'Error', message: msg });
  } catch (e) {
    logger.error('Failed to open error modal', e && (e.stack || e.toString()));
  }
}

/**
 * withErrorHandler - higher-order wrapper for async functions to ensure consistent
 * try/catch behavior, logging and UI surfacing. The wrapped function will rethrow
 * after reporting so callers can decide to handle propagation.
 *
 * Example:
 *   const safeFn = withErrorHandler(async (a,b) => { ... }, 'Failed to do X');
 *   await safeFn(1,2); // if error occurs, raiseError() is called and error rethrown
 */
export function withErrorHandler(fn, message) {
  if (typeof fn !== 'function') {
    throw new Error('withErrorHandler expects a function');
  }

  return async function wrapped(...args) {
    try {
      return await fn(...args);
    } catch (err) {
      // Normalize non-error throws
      const error = err instanceof Error ? err : new Error(String(err));
      raiseError(message || 'An unexpected error occurred', error);
      // Rethrow so callers can perform additional handling if desired
      throw error;
    }
  };
}

/**
 * wrapAsync - helper to attach error handling to an existing promise.
 * Usage: await wrapAsync(promise, 'Failed to load resource');
 */
export function wrapAsync(promise, message) {
  if (!promise || typeof promise.then !== 'function') {
    return Promise.reject(new Error('wrapAsync expects a Promise'));
  }

  return promise.catch(err => {
    const error = err instanceof Error ? err : new Error(String(err));
    raiseError(message || 'An unexpected error occurred', error);
    throw error;
  });
}

export default errorStore;
