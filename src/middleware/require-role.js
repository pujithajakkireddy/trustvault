
function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        error: "Authentication required.",
      });
    }

    if (!allowedRoles.includes(req.session.user.role)) {
      return res.status(403).json({
        error: "You do not have permission to perform this action.",
      });
    }

    next();
  };
}

module.exports = requireRole;
