/**
 * Error Handler Middleware
 * Provides consistent error handling throughout the application
 */

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error status and message
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let errorDetails = undefined;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    // Mongoose validation error
    statusCode = 400;
    message = 'Validation error';
    errorDetails = Object.values(err.errors).map(val => val.message);
  } else if (err.name === 'CastError') {
    // Mongoose cast error (e.g., invalid ID)
    statusCode = 400;
    message = `Invalid ${err.path}`;
  } else if (err.code === 11000) {
    // Mongoose duplicate key error
    statusCode = 400;
    message = 'Duplicate field value entered';
    errorDetails = err.keyValue;
  } else if (err.name === 'JsonWebTokenError') {
    // JWT validation error
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    // JWT expiration error
    statusCode = 401;
    message = 'Token expired';
  }

  // Send response
  res.status(statusCode).json({
    success: false,
    error: message,
    details: errorDetails,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = errorHandler;
