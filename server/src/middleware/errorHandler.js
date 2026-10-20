/**
 * Centralized API Error Handling Middleware
 * Suppresses internal stack traces and filesystem paths to prevent information disclosure.
 */
export function errorHandler(err, req, res, next) {
  // Sanitize error message to prevent leaking internal filesystem paths
  let safeMessage = err.message || 'Internal Server Error';

  // Strip Windows and Unix absolute/relative file paths
  safeMessage = safeMessage.replace(/[A-Za-z]:\\[^\s"']+/g, '[INTERNAL_PATH]');
  safeMessage = safeMessage.replace(/\/(?:[a-zA-Z0-9_.-]+\/)+[a-zA-Z0-9_.-]*/g, '[INTERNAL_PATH]');

  const statusCode = err.statusCode || (err.name === 'MulterError' ? 400 : 500);
  console.error(`[API Error] ${req.method} ${req.url} -> ${statusCode}:`, err);

  // NEVER expose stack traces or raw paths to API clients
  res.status(statusCode).json({
    success: false,
    error: safeMessage
  });
}

