function notFound(req, res, next) {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  res.status(404).json({ error: `Route introuvable: ${req.method} ${req.originalUrl}` });
}

module.exports = { notFound };