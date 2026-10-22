
const pool = require("../db/database");

/**
 * Record a security-relevant event.
 * Never include passwords, session cookies, or document contents in details.
 * Pass a transaction client when the audit entry must be atomic
 * with another database operation.
 */
async function writeAuditLog({
  actorId = null,
  action,
  documentId = null,
  targetUserId = null,
  details = {},
  outcome = "success",
  dbClient = pool,
}) {
  const allowedOutcomes = ["success", "denied", "failure"];

  if (!allowedOutcomes.includes(outcome)) {
    throw new Error("Invalid audit outcome.");
  }

  if (typeof action !== "string" || action.trim().length === 0) {
    throw new Error("Audit action is required.");
  }

  await dbClient.query(
    `INSERT INTO audit_logs
       (actor_id, action, document_id, target_user_id, details, outcome)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [
      actorId,
      action,
      documentId,
      targetUserId,
      JSON.stringify(details),
      outcome,
    ]
  );
}

module.exports = { writeAuditLog };
