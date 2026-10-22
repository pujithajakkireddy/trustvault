
require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const crypto = require("node:crypto");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const pool = require("./db/database");

pool.on("error", (error) => {
  console.error("Unexpected idle database connection error:", error.message);
});

const authRoutes = require("./routes/auth");
const documentRoutes = require("./routes/documents");
const csrfProtection = require("./middleware/csrf-protection");

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET must contain at least 32 characters.");
}

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "100kb" }));

// Enable only when deployed behind a trusted HTTPS reverse proxy.
// Configure the proxy explicitly before enabling this in production.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: false,
    }),
    name: "trustvault.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60,
    },
  })
);

// Issue a session-bound CSRF token.
app.get("/api/auth/csrf-token", (req, res, next) => {
  if (!req.session) {
    return res.status(500).json({
      error: "Session unavailable.",
    });
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }

  req.session.save((error) => {
    if (error) {
      return next(error);
    }

    return res.status(200).json({
      csrfToken: req.session.csrfToken,
    });
  });
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." },
});

app.get("/", (req, res) => {
  res.status(200).json({
    message: "TrustVault is running!",
    status: "ok",
  });
});

app.use(
  "/api/auth",
  (req, res, next) => {
    if (req.path === "/login") {
      return loginLimiter(req, res, next);
    }
    next();
  },
  authRoutes
);

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ok", database: "connected" });
  } catch {
    res.status(503).json({ status: "error", database: "unavailable" });
  }
});

app.use("/api/documents", csrfProtection, documentRoutes);

// Centralized error handling for upload and other request errors.
// Keep this after the routes so errors can reach this middleware.
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "File exceeds the maximum allowed size of 5 MB.",
      });
    }

    return res.status(400).json({
      error: "Invalid file upload request.",
    });
  }

  console.error("Unhandled request error:", err.message);

  return res.status(500).json({
    error: "An unexpected server error occurred.",
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`TrustVault is running on port ${PORT}`);
  });
}

module.exports = app;
