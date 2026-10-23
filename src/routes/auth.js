const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db/database");
const requireAuth = require("../middleware/require-auth");
const csrfProtection = require("../middleware/csrf-protection");

const router = express.Router();

// Register a new user with the default viewer role.
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body || {};

  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    !name.trim() ||
    !email.trim() ||
    password.length < 12 ||
    password.length > 72
  ) {
    return res.status(400).json({
      error: "Provide a name, valid email, and password of 12–72 characters.",
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (
    normalizedEmail.length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
    name.trim().length > 100
  ) {
    return res.status(400).json({
      error: "Invalid name or email.",
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'viewer')
       RETURNING id, name, email, role, created_at`,
      [name.trim(), normalizedEmail, passwordHash]
    );

    return res.status(201).json({
      message: "Account created successfully.",
      user: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        error: "An account with that email already exists.",
      });
    }

    console.error("Registration failed:", error.message);

    return res.status(500).json({
      error: "Unable to create account.",
    });
  }
});

// Authenticate a user and create a fresh server-side session.
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    email.length > 255 ||
    password.length === 0 ||
    password.length > 72
  ) {
    return res.status(400).json({
      error: "Invalid email or password.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, password_hash, role
       FROM users
       WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    const user = result.rows[0];

    // Verify the supplied password against the stored bcrypt hash.
    if (
      !user ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    // Regenerate the session ID after successful authentication
    // to help prevent session fixation.
    req.session.regenerate((sessionError) => {
      if (sessionError) {
        console.error("Session regeneration failed.");

        return res.status(500).json({
          error: "Unable to log in.",
        });
      }

      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      };

      req.session.save((saveError) => {
        if (saveError) {
          console.error("Session save failed.");

          return res.status(500).json({
            error: "Unable to log in.",
          });
        }

        return res.status(200).json({
          message: "Login successful.",
          user: req.session.user,
        });
      });
    });
  } catch (error) {
    console.error("Login failed:", error.message);

    return res.status(500).json({
      error: "Unable to log in.",
    });
  }
});

// Return the currently authenticated user.
router.get("/me", requireAuth, (req, res) => {
  return res.status(200).json({
    user: req.session.user,
  });
});

 // Log out the current user and destroy their server-side session.
router.post("/logout", csrfProtection, requireAuth, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Session destruction failed.");

      return res.status(500).json({
        error: "Unable to log out.",
      });
    }

    res.clearCookie("trustvault.sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return res.status(200).json({
      message: "Logout successful.",
    });
  });
});

module.exports = router;