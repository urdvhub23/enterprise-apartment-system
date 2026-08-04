// Central error handler so every service returns a consistent error shape.
function errorHandler(err, req, res, next) {
  console.error(`[error] ${req.method} ${req.originalUrl} ->`, err.message);

  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors?.map(e => e.message)
    });
  }

  if (err.name === 'ValidationError') { // mongoose
    return res.status(400).json({ error: 'Validation failed', details: err.message });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message
  });
}

module.exports = errorHandler;
