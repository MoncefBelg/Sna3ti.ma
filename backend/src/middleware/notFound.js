function notFound(req, res, next) {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: `Route introuvable: ${req.method} ${req.originalUrl}` }
  });
}

module.exports = { notFound };
