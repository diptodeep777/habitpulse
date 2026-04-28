function notFound(req, res) {
  res.status(404).json({ message: "Route not found." });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error.name === "ZodError") {
    return res.status(400).json({
      message: error.errors?.[0]?.message || "Invalid request data."
    });
  }

  const status = error.statusCode || error.status || 500;
  const message =
    status >= 500 ? "Something went wrong. Please try again." : error.message;

  if (process.env.NODE_ENV !== "test") {
    console.error(error);
  }

  return res.status(status).json({ message });
}

module.exports = {
  errorHandler,
  notFound
};
