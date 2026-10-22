
const crypto = require("node:crypto");

function csrfProtection(req, res, next) {
  // Safe HTTP methods do not change server state.
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Protect state-changing requests made by authenticated sessions.
  if (!req.session || !req.session.user) {
    return next();
  }

  const sessionToken = req.session.csrfToken;
  const requestToken = req.get("X-CSRF-Token");

  if (
    typeof sessionToken !== "string" ||
    typeof requestToken !== "string"
  ) {
    return res.status(403).json({
      error: "CSRF token missing or invalid.",
    });
  }

  const expected = Buffer.from(sessionToken, "utf8");
  const received = Buffer.from(requestToken, "utf8");

  if (
    expected.length !== received.length ||
    !crypto.timingSafeEqual(expected, received)
  ) {
    return res.status(403).json({
      error: "CSRF token missing or invalid.",
    });
  }

  return next();
}

module.exports = csrfProtection;
