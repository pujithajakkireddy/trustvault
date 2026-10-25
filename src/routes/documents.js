"use strict";

const express = require("express");
const crypto = require("node:crypto");
const pool = require("../db/database");
const requireAuth = require("../middleware/require-auth");
const { writeAuditLog } = require("../services/audit");
const {
  upload,
  validateUploadedFile,
} = require("../middleware/upload");

const router = express.Router();

const DOCUMENT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Find a registered TrustVault user by exact email.
 * Requires authentication and returns minimal account details.
 */
router.get("/users/search", requireAuth, async (req, res) => {
  const email = req.query.email;

  if (
    typeof email !== "string" ||
    email.trim().length < 3 ||
    email.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    return res.status(400).json({
      error: "Enter a valid email address.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email
       FROM users
       WHERE LOWER(email) = LOWER($1)
         AND id <> $2
       LIMIT 1`,
      [email.trim(), req.session.user.id]
    );

    return res.status(200).json({
      users: result.rows,
    });
  } catch (error) {
    console.error("User email search failed:", error.message);

    return res.status(500).json({
      error: "Unable to search for users.",
    });
  }
});

// List documents the logged-in user is allowed to read.
// Optional filters: name, category, ownerId, from, to.
router.get("/", requireAuth, async (req, res) => {
  const { name, category, ownerId, from, to } = req.query;

  if (ownerId && !DOCUMENT_UUID_PATTERN.test(ownerId)) {
    return res.status(400).json({ error: "Invalid owner ID." });
  }

  const isValidDate = (value) =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

  if (from && !isValidDate(from)) {
    return res.status(400).json({
      error: "The from date must be a valid YYYY-MM-DD date.",
    });
  }

  if (to && !isValidDate(to)) {
    return res.status(400).json({
      error: "The to date must be a valid YYYY-MM-DD date.",
    });
  }

  if (from && to && from > to) {
    return res.status(400).json({
      error: "The from date must not be later than the to date.",
    });
  }

  if (
    (name !== undefined &&
      (typeof name !== "string" || name.length > 255)) ||
    (category !== undefined &&
      (typeof category !== "string" || category.length > 100))
  ) {
    return res.status(400).json({ error: "Invalid search filter." });
  }

  try {
    const values = [req.session.user.id];

    const addFilter = (sql, value) => {
      values.push(value);
      return sql.replace("?", `$${values.length}`);
    };

    const filters = [
      "(d.owner_id = $1 OR p.can_read = TRUE)",
    ];

    if (name) {
      filters.push(addFilter("d.name ILIKE ?", `%${name}%`));
    }

    if (category) {
      filters.push(addFilter("d.category ILIKE ?", `%${category}%`));
    }

    if (ownerId) {
      filters.push(addFilter("d.owner_id = ?", ownerId));
    }

    if (from) {
      filters.push(addFilter("d.created_at >= ?::date", from));
    }

    if (to) {
      values.push(to);
      filters.push(
        `d.created_at < ($${values.length}::date + INTERVAL '1 day')`
      );
    }

    const result = await pool.query(
      `SELECT DISTINCT
         d.id,
         d.name,
         d.category,
         d.mime_type,
         d.size_bytes,
         d.owner_id,
         d.created_at,
         d.updated_at
       FROM documents AS d
       LEFT JOIN document_permissions AS p
         ON p.document_id = d.id
        AND p.user_id = $1
       WHERE ${filters.join(" AND ")}
       ORDER BY d.created_at DESC`,
      values
    );

    return res.status(200).json({ documents: result.rows });
  } catch (error) {
    console.error("Failed to search documents:", error.message);
    return res.status(500).json({
      error: "Unable to retrieve documents.",
    });
  }
});

// Download a document only if the authenticated user owns it
// or has explicit read permission. Verify SHA-256 before returning content.
router.get("/:id/download", requireAuth, async (req, res) => {
  const documentId = req.params.id;

  if (!DOCUMENT_UUID_PATTERN.test(documentId)) {
    return res.status(400).json({ error: "Invalid document ID." });
  }

  try {
    const result = await pool.query(
      `SELECT d.name, d.mime_type, d.content, d.sha256_hash
       FROM documents AS d
       LEFT JOIN document_permissions AS p
         ON p.document_id = d.id
        AND p.user_id = $2
       WHERE d.id = $1
         AND (d.owner_id = $2 OR p.can_read = TRUE)
       LIMIT 1`,
      [documentId, req.session.user.id]
    );

    if (result.rows.length === 0) {
      await writeAuditLog({
        actorId: req.session.user.id,
        action: "document.download",
        documentId: null,
        details: {
          requestedDocumentId: documentId,
          reason: "not_found_or_access_denied",
        },
        outcome: "denied",
      });

      return res.status(404).json({
        error: "Document not found.",
      });
    }

    const document = result.rows[0];

    const actualHash = crypto
      .createHash("sha256")
      .update(document.content)
      .digest("hex");

    if (!document.sha256_hash) {
      await pool.query(
        `UPDATE documents
         SET sha256_hash = $2
         WHERE id = $1 AND sha256_hash IS NULL`,
        [documentId, actualHash]
      );
    } else if (document.sha256_hash !== actualHash) {
      await writeAuditLog({
        actorId: req.session.user.id,
        action: "document.integrity_check",
        documentId,
        details: { reason: "sha256_mismatch" },
        outcome: "failure",
      });

      return res.status(500).json({
        error:
          "Document integrity verification failed. The file was not downloaded.",
      });
    }

    await writeAuditLog({
      actorId: req.session.user.id,
      action: "document.download",
      documentId,
      details: {
        outcome: "authorized",
        integrityVerified: true,
        sha256Hash: actualHash,
      },
      outcome: "success",
    });

    res.set("X-Content-Type-Options", "nosniff");
    res.set("Content-Type", "application/octet-stream");
    res.set(
      "Content-Disposition",
      `attachment; filename="document-${documentId}"`
    );
    res.set("X-Document-SHA256", actualHash);

    return res.status(200).send(document.content);
  } catch (error) {
    console.error("Document download failed:", error.message);
    return res.status(500).json({
      error: "Unable to download the document.",
    });
  }
});

// Upload a validated document and store its SHA-256 hash in PostgreSQL.
router.post(
  "/upload",
  requireAuth,
  upload.single("file"),
  validateUploadedFile,
  async (req, res) => {
    const category = req.body?.category;

    if (
      typeof category !== "string" ||
      category.trim().length === 0 ||
      category.trim().length > 100
    ) {
      return res.status(400).json({
        error: "Category is required and must be at most 100 characters.",
      });
    }

    let client;
    let transactionStarted = false;

    try {
      const file = req.validatedFile;

      const sha256Hash = crypto
        .createHash("sha256")
        .update(file.buffer)
        .digest("hex");

      client = await pool.connect();

      await client.query("BEGIN");
      transactionStarted = true;

      const result = await client.query(
        `INSERT INTO documents
           (owner_id, name, category, mime_type, size_bytes, content, sha256_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING
           id, owner_id, name, category, mime_type,
           size_bytes, sha256_hash, created_at, updated_at`,
        [
          req.session.user.id,
          file.originalName,
          category.trim(),
          file.mimeType,
          file.size,
          file.buffer,
          sha256Hash,
        ]
      );

      await writeAuditLog({
        actorId: req.session.user.id,
        action: "document.upload",
        documentId: result.rows[0].id,
        details: {
          category: category.trim(),
          sizeBytes: file.size,
          mimeType: file.mimeType,
        },
        outcome: "success",
        dbClient: client,
      });

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(201).json({
        message: "Document uploaded successfully.",
        document: result.rows[0],
      });
    } catch (error) {
      if (client && transactionStarted) {
        await client.query("ROLLBACK").catch(() => {});
      }

      console.error("Document upload failed:", error.message);

      return res.status(500).json({
        error: "Unable to save the document.",
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

/**
 * Grant read or edit access to another existing user.
 * Only the document owner may grant permissions.
 */
router.put("/:id/permissions", requireAuth, async (req, res) => {
  const documentId = req.params.id;
  const { userId, canRead, canEdit } = req.body || {};

  if (
    !DOCUMENT_UUID_PATTERN.test(documentId) ||
    !DOCUMENT_UUID_PATTERN.test(userId || "")
  ) {
    return res.status(400).json({
      error: "Valid document ID and user ID are required.",
    });
  }

  if (typeof canRead !== "boolean" || typeof canEdit !== "boolean") {
    return res.status(400).json({
      error: "canRead and canEdit must be boolean values.",
    });
  }

  if (canEdit && !canRead) {
    return res.status(400).json({
      error: "Edit access must include read access.",
    });
  }

  if (
    userId.toLowerCase() ===
    String(req.session.user.id).toLowerCase()
  ) {
    return res.status(400).json({
      error: "You cannot grant document permissions to yourself.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const documentResult = await client.query(
      `SELECT id
       FROM documents
       WHERE id = $1 AND owner_id = $2
       FOR UPDATE`,
      [documentId, req.session.user.id]
    );

    if (documentResult.rows.length === 0) {
    await client.query("ROLLBACK");

    await writeAuditLog({
      actorId: req.session.user.id,
      action: "permission.grant",
      documentId: null,
      targetUserId: userId,
      details: {
        requestedDocumentId: documentId,
        reason: "not_found_or_not_owner",
      },
      outcome: "denied",
    });

    return res.status(404).json({
      error: "Document not found.",
    });
  }

    const userResult = await client.query(
      "SELECT id FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
  await client.query("ROLLBACK");

  await writeAuditLog({
    actorId: req.session.user.id,
    action: "permission.grant",
    documentId,
    targetUserId: null,
    details: {
      reason: "target_user_not_found",
    },
    outcome: "denied",
  });

  return res.status(404).json({
    error: "Target user not found.",
  });
}

    const permissionResult = await client.query(
      `INSERT INTO document_permissions
         (document_id, user_id, can_read, can_edit, granted_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (document_id, user_id)
       DO UPDATE SET
         can_read = EXCLUDED.can_read,
         can_edit = EXCLUDED.can_edit,
         granted_by = EXCLUDED.granted_by,
         granted_at = NOW()
       RETURNING document_id, user_id, can_read, can_edit, granted_at`,
      [
        documentId,
        userId,
        canRead || canEdit,
        canEdit,
        req.session.user.id,
      ]
    );

    await writeAuditLog({
      actorId: req.session.user.id,
      action: "permission.grant",
      documentId,
      targetUserId: userId,
      details: {
        canRead: canRead || canEdit,
        canEdit,
      },
      outcome: "success",
      dbClient: client,
    });

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Document permissions updated successfully.",
      permission: permissionResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Permission grant failed:", error.message);

    return res.status(500).json({
      error: "Unable to update document permissions.",
    });
  } finally {
    client.release();
  }
});

/**
 * List users who currently have permission to a document.
 * Only the document owner may view this list.
 */
router.get("/:id/permissions", requireAuth, async (req, res) => {
  const documentId = req.params.id;

  if (!DOCUMENT_UUID_PATTERN.test(documentId)) {
    return res.status(400).json({
      error: "Invalid document ID.",
    });
  }

  try {
    const ownerResult = await pool.query(
      `SELECT id
       FROM documents
       WHERE id = $1 AND owner_id = $2`,
      [documentId, req.session.user.id]
    );

    if (ownerResult.rows.length === 0) {
      return res.status(404).json({
        error: "Document not found.",
      });
    }

    const result = await pool.query(
      `SELECT
         u.id AS user_id,
         u.name,
         u.email,
         p.can_read,
         p.can_edit,
         p.granted_at
       FROM document_permissions AS p
       JOIN users AS u ON u.id = p.user_id
       WHERE p.document_id = $1
       ORDER BY u.email ASC`,
      [documentId]
    );

    return res.status(200).json({
      permissions: result.rows,
    });
  } catch (error) {
    console.error("Failed to list document permissions:", error.message);

    return res.status(500).json({
      error: "Unable to retrieve document permissions.",
    });
  }
});

/**
 * Revoke a user's access to a document.
 * Only the document owner may revoke permissions.
 */
router.delete(
  "/:id/permissions/:userId",
  requireAuth,
  async (req, res) => {
    const { id: documentId, userId } = req.params;

    if (
      !DOCUMENT_UUID_PATTERN.test(documentId) ||
      !DOCUMENT_UUID_PATTERN.test(userId)
    ) {
      return res.status(400).json({
        error: "Valid document ID and user ID are required.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const documentResult = await client.query(
        `SELECT id
         FROM documents
         WHERE id = $1 AND owner_id = $2
         FOR UPDATE`,
        [documentId, req.session.user.id]
      );

      if (documentResult.rows.length === 0) {
  await client.query("ROLLBACK");

  await writeAuditLog({
    actorId: req.session.user.id,
    action: "permission.revoke",
    documentId: null,
    targetUserId: userId,
    details: {
      requestedDocumentId: documentId,
      reason: "not_found_or_not_owner",
    },
    outcome: "denied",
  });

  return res.status(404).json({
    error: "Document not found.",
  });
}

      const result = await client.query(
        `DELETE FROM document_permissions
         WHERE document_id = $1 AND user_id = $2
         RETURNING document_id, user_id`,
        [documentId, userId]
      );

      if (result.rows.length === 0) {
  await client.query("ROLLBACK");

  await writeAuditLog({
    actorId: req.session.user.id,
    action: "permission.revoke",
    documentId,
    targetUserId: userId,
    details: {
      reason: "permission_not_found",
    },
    outcome: "denied",
  });

  return res.status(404).json({
    error: "Permission not found.",
  });
}

      await writeAuditLog({
        actorId: req.session.user.id,
        action: "permission.revoke",
        documentId,
        targetUserId: userId,
        details: { revoked: true },
        outcome: "success",
        dbClient: client,
      });

      await client.query("COMMIT");

      return res.status(200).json({
        message: "Document access revoked successfully.",
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Permission revocation failed:", error.message);

      return res.status(500).json({
        error: "Unable to revoke document access.",
      });
    } finally {
      client.release();
    }
  }
);

/**
 * Permanently delete a document.
 * Only the document owner may delete it.
 */
router.delete("/:id", requireAuth, async (req, res) => {
  const { id: documentId } = req.params;

  if (!DOCUMENT_UUID_PATTERN.test(documentId)) {
    return res.status(400).json({
      error: "A valid document ID is required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const ownerCheck = await client.query(
      `SELECT id, name
       FROM documents
       WHERE id = $1 AND owner_id = $2
       FOR UPDATE`,
      [documentId, req.session.user.id]
    );

    if (ownerCheck.rows.length === 0) {
      await client.query("ROLLBACK");

      await writeAuditLog({
        actorId: req.session.user.id,
        action: "document.delete",
        documentId: null,
        details: {
          requestedDocumentId: documentId,
          reason: "not_found_or_not_owner",
        },
        outcome: "denied",
      });

      return res.status(404).json({
        error: "Document not found.",
      });
    }

    const document = ownerCheck.rows[0];

    await writeAuditLog({
      actorId: req.session.user.id,
      action: "document.delete",
      documentId,
      details: {
        deletedDocumentId: documentId,
        name: document.name,
      },
      outcome: "success",
      dbClient: client,
    });

    await client.query(
      `DELETE FROM documents
       WHERE id = $1 AND owner_id = $2`,
      [documentId, req.session.user.id]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Document deleted successfully.",
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Document deletion failed:", error.message);

    return res.status(500).json({
      error: "Unable to delete document.",
    });
  } finally {
    client.release();
  }
});

// Update document metadata if the user owns the document or has edit access.
router.patch("/:id", requireAuth, async (req, res) => {
  const documentId = req.params.id;
  const { name, category } = req.body || {};
  const userId = req.session.user.id;

  if (!DOCUMENT_UUID_PATTERN.test(documentId)) {
    return res.status(400).json({ error: "Invalid document ID." });
  }

  const changes = {};

  if (name !== undefined) {
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 255
    ) {
      return res.status(400).json({
        error: "Name must be 1–255 characters.",
      });
    }

    changes.name = name.trim();
  }

  if (category !== undefined) {
    if (
      typeof category !== "string" ||
      !category.trim() ||
      category.trim().length > 100
    ) {
      return res.status(400).json({
        error: "Category must be 1–100 characters.",
      });
    }

    changes.category = category.trim();
  }

  if (Object.keys(changes).length === 0) {
    return res.status(400).json({
      error: "Provide a name or category to update.",
    });
  }

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const result = await client.query(
      `SELECT d.id, d.name, d.category
       FROM documents d
       LEFT JOIN document_permissions p
         ON p.document_id = d.id AND p.user_id = $2
       WHERE d.id = $1
         AND (d.owner_id = $2 OR p.can_edit = TRUE)
       FOR UPDATE OF d`,
      [documentId, userId]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      await writeAuditLog({
        actorId: userId,
        action: "document.update",
        details: {
          requestedDocumentId: documentId,
          reason: "not_found_or_edit_permission_missing",
        },
        outcome: "denied",
      });

      return res.status(404).json({
        error: "Document not found.",
      });
    }

    const document = result.rows[0];
    const fields = Object.keys(changes);
    const values = [documentId];

    const assignments = fields.map((field) => {
      values.push(changes[field]);
      return `${field} = $${values.length}`;
    });

    assignments.push("updated_at = NOW()");

    await client.query(
      `UPDATE documents
       SET ${assignments.join(", ")}
       WHERE id = $1`,
      values
    );

    await writeAuditLog({
      actorId: userId,
      action: "document.update",
      documentId,
      details: {
        changedFields: fields,
        previousName: document.name,
        previousCategory: document.category,
        newName: changes.name ?? document.name,
        newCategory: changes.category ?? document.category,
      },
      outcome: "success",
      dbClient: client,
    });

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(200).json({
      message: "Document updated successfully.",
      document: {
        id: documentId,
        name: changes.name ?? document.name,
        category: changes.category ?? document.category,
      },
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("Document update failed:", error.message);

    return res.status(500).json({
      error: "Unable to update document.",
    });
  } finally {
    client.release();
  }
});

module.exports = router;