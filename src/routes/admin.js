
const express = require("express");
const pool = require("../db/database");
const requireRole = require("../middleware/require-role");

const router = express.Router();

// Only administrators may view security audit history.
router.get("/audit-logs", requireRole("admin"), async (req, res) => {
  const rawLimit = req.query.limit ?? "50";
  const limit = Number(rawLimit);

  if (
    typeof rawLimit !== "string" ||
    !/^\d+$/.test(rawLimit) ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    return res.status(400).json({
      error: "Limit must be an integer between 1 and 100.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT
         a.id,
         a.actor_id AS "actorId",
         actor.name AS "actorName",
         a.action,
         a.document_id AS "documentId",
         a.target_user_id AS "targetUserId",
         target.name AS "targetUserName",
         a.details,
         a.outcome,
         a.created_at AS "createdAt"
       FROM audit_logs AS a
       LEFT JOIN users AS actor ON actor.id = a.actor_id
       LEFT JOIN users AS target ON target.id = a.target_user_id
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT $1`,
      [limit]
    );

    return res.status(200).json({
      auditLogs: result.rows,
      count: result.rows.length,
    });
  } catch {
    return res.status(500).json({
      error: "Unable to retrieve audit logs.",
    });
  }
});

module.exports = router;
