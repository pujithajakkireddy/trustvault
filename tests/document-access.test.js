
require("dotenv").config();

const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const request = require("supertest");

if (process.env.NODE_ENV !== "test") {
  throw new Error("Integration tests must run with NODE_ENV=test.");
}

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL must be configured.");
}

const { Pool } = require("pg");
const app = require("../src/server");

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

async function getCsrfToken(agent) {
  const response = await agent.get("/api/auth/csrf-token");

  assert.equal(
    response.status,
    200,
    "CSRF token endpoint should succeed"
  );
  assert.equal(typeof response.body.csrfToken, "string");
  assert.ok(response.body.csrfToken.length > 0);

  return response.body.csrfToken;
}

test("document access respects ownership, grants, and revocation", async (t) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ownerEmail = `tv-owner-${suffix}@example.test`;
  const viewerEmail = `tv-viewer-${suffix}@example.test`;
  const testPassword = `Test-${suffix}-Pass!`;

  let ownerId;
  let viewerId;
  let documentId;

  try {
    const passwordHash = await bcrypt.hash(testPassword, 4);

    const ownerResult = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'owner')
       RETURNING id`,
      ["Integration Test Owner", ownerEmail, passwordHash]
    );
    ownerId = ownerResult.rows[0].id;

    const viewerResult = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'viewer')
       RETURNING id`,
      ["Integration Test Viewer", viewerEmail, passwordHash]
    );
    viewerId = viewerResult.rows[0].id;

    const documentResult = await pool.query(
      `INSERT INTO documents
         (owner_id, name, category, mime_type, size_bytes, content)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        ownerId,
        "integration-test.pdf",
        "Automated Test",
        "application/pdf",
        8,
        Buffer.from("%PDF-1.4"),
      ]
    );
    documentId = documentResult.rows[0].id;

    const ownerAgent = request.agent(app);
    const viewerAgent = request.agent(app);

    const ownerLogin = await ownerAgent
      .post("/api/auth/login")
      .send({ email: ownerEmail, password: testPassword });
    assert.equal(ownerLogin.status, 200, "owner login should succeed");

    const viewerLogin = await viewerAgent
      .post("/api/auth/login")
      .send({ email: viewerEmail, password: testPassword });
    assert.equal(viewerLogin.status, 200, "viewer login should succeed");

    const ownerCsrfToken = await getCsrfToken(ownerAgent);

    await getCsrfToken(viewerAgent);

    await t.test("unauthenticated download is rejected", async () => {
      const response = await request(app).get(
        `/api/documents/${documentId}/download`
      );
      assert.equal(response.status, 401);
    });

    await t.test("another user cannot download without permission", async () => {
      const response = await viewerAgent.get(
        `/api/documents/${documentId}/download`
      );
      assert.equal(response.status, 404);
    });
    await t.test("granting permission rejects a missing CSRF token", async () => {
      const response = await ownerAgent
        .put(`/api/documents/${documentId}/permissions`)
        .send({
          userId: viewerId,
          canRead: true,
          canEdit: false,
         });

      assert.equal(response.status, 403);
    });

    await t.test("owner can grant read access", async () => {
      const response = await ownerAgent
        .put(`/api/documents/${documentId}/permissions`)
        .set("X-CSRF-Token", ownerCsrfToken)
        .send({
          userId: viewerId,
          canRead: true,
          canEdit: false,
        });

      assert.equal(response.status, 200);
    });

    await t.test("granted viewer can download", async () => {
      const response = await viewerAgent.get(
        `/api/documents/${documentId}/download`
      );

      assert.equal(response.status, 200);
      assert.equal(response.headers["x-content-type-options"], "nosniff");
      assert.equal(response.body.toString(), "%PDF-1.4");
    });

    await t.test("revoking permission rejects a missing CSRF token", async () => {
      const response = await ownerAgent
        .delete(`/api/documents/${documentId}/permissions/${viewerId}`);

      assert.equal(response.status, 403);
    });

    await t.test("owner can revoke read access", async () => {
      const response = await ownerAgent
        .delete(`/api/documents/${documentId}/permissions/${viewerId}`)
        .set("X-CSRF-Token", ownerCsrfToken);

      assert.equal(response.status, 200);
    });

    await t.test("revoked viewer cannot download", async () => {
      const response = await viewerAgent.get(
        `/api/documents/${documentId}/download`
      );
      assert.equal(response.status, 404);
    });
  } finally {
    if (documentId) {
      await pool.query("DELETE FROM documents WHERE id = $1", [documentId]);
    }

    if (ownerId) {
      await pool.query("DELETE FROM users WHERE id = $1", [ownerId]);
    }

    if (viewerId) {
      await pool.query("DELETE FROM users WHERE id = $1", [viewerId]);
    }
  }
});

test("unauthenticated users cannot download an arbitrary document", async () => {
  const response = await request(app).get(
    "/api/documents/a7fa251f-2905-4609-8b48-0635ed2c101e/download"
  );

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, {
    error: "Authentication required.",
  });
});

test("document deletion is restricted to its owner and audited", async (t) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ownerEmail = `tv-delete-owner-${suffix}@example.test`;
  const viewerEmail = `tv-delete-viewer-${suffix}@example.test`;
  const password = `Delete-${suffix}-Pass!`;
  const passwordHash = await bcrypt.hash(password, 4);

  let ownerId;
  let viewerId;
  let documentId;

  try {
    const ownerResult = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'owner') RETURNING id`,
      ["Deletion Test Owner", ownerEmail, passwordHash]
    );
    ownerId = ownerResult.rows[0].id;

    const viewerResult = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'viewer') RETURNING id`,
      ["Deletion Test Viewer", viewerEmail, passwordHash]
    );
    viewerId = viewerResult.rows[0].id;

    const documentResult = await pool.query(
      `INSERT INTO documents
         (owner_id, name, category, mime_type, size_bytes, content)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        ownerId,
        "deletion-test.pdf",
        "Automated Test",
        "application/pdf",
        8,
        Buffer.from("%PDF-1.4"),
      ]
    );
    documentId = documentResult.rows[0].id;

    const ownerAgent = request.agent(app);
    const viewerAgent = request.agent(app);

    const ownerLogin = await ownerAgent
      .post("/api/auth/login")
      .send({ email: ownerEmail, password });
    assert.equal(ownerLogin.status, 200);

    const viewerLogin = await viewerAgent
      .post("/api/auth/login")
      .send({ email: viewerEmail, password });
    assert.equal(viewerLogin.status, 200);

    const ownerCsrfToken = await getCsrfToken(ownerAgent);
    const viewerCsrfToken = await getCsrfToken(viewerAgent);

    await t.test("another user cannot delete the document", async () => {
      const response = await viewerAgent
        .delete(`/api/documents/${documentId}`)
        .set("X-CSRF-Token", viewerCsrfToken);

      assert.equal(response.status, 404);

      const stillExists = await pool.query(
        "SELECT id FROM documents WHERE id = $1",
        [documentId]
      );
      assert.equal(stillExists.rows.length, 1);
    });

    await t.test("owner can delete the document", async () => {
      const response = await ownerAgent
        .delete(`/api/documents/${documentId}`)
        .set("X-CSRF-Token", ownerCsrfToken);

      assert.equal(response.status, 200);
      assert.equal(response.body.message, "Document deleted successfully.");

      const deleted = await pool.query(
        "SELECT id FROM documents WHERE id = $1",
        [documentId]
      );
      assert.equal(deleted.rows.length, 0);

      const audit = await pool.query(
        `SELECT action, outcome, details
         FROM audit_logs
         WHERE actor_id = $1
           AND action = 'document.delete'
           AND outcome = 'success'
           AND details->>'deletedDocumentId' = $2::text
         ORDER BY created_at DESC
         LIMIT 1`,
        [ownerId, documentId]
      );

      assert.equal(audit.rows.length, 1);
      assert.equal(audit.rows[0].details.name, "deletion-test.pdf");
    });
  } finally {
    if (documentId) {
      await pool.query("DELETE FROM documents WHERE id = $1", [documentId]);

      await pool.query(
        `DELETE FROM audit_logs
         WHERE details->>'deletedDocumentId' = $1::text
            OR details->>'requestedDocumentId' = $1::text
            OR document_id = $1::uuid`,
        [documentId]
      );
    }

    if (ownerId) {
      await pool.query("DELETE FROM users WHERE id = $1", [ownerId]);
    }

    if (viewerId) {
      await pool.query("DELETE FROM users WHERE id = $1", [viewerId]);
    }
  }
});

test("document editing requires ownership or explicit edit permission", async (t) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const password = `Edit-${suffix}-Pass!`;
  const passwordHash = await bcrypt.hash(password, 4);

  let ownerId;
  let editorId;
  let viewerId;
  let documentId;

  try {
    const owner = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ('Edit Test Owner', $1, $2, 'owner') RETURNING id`,
      [`edit-owner-${suffix}@example.test`, passwordHash]
    );
    ownerId = owner.rows[0].id;

    const editor = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ('Edit Test Editor', $1, $2, 'viewer') RETURNING id`,
      [`edit-editor-${suffix}@example.test`, passwordHash]
    );
    editorId = editor.rows[0].id;

    const viewer = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ('Edit Test Readonly', $1, $2, 'viewer') RETURNING id`,
      [`edit-viewer-${suffix}@example.test`, passwordHash]
    );
    viewerId = viewer.rows[0].id;

    const doc = await pool.query(
      `INSERT INTO documents
         (owner_id, name, category, mime_type, size_bytes, content)
       VALUES ($1, 'original.pdf', 'Original', 'application/pdf', 8, $2)
       RETURNING id`,
      [ownerId, Buffer.from("%PDF-1.4")]
    );
    documentId = doc.rows[0].id;

    await pool.query(
      `INSERT INTO document_permissions
         (document_id, user_id, can_read, can_edit, granted_by)
       VALUES ($1, $2, TRUE, TRUE, $3)`,
      [documentId, editorId, ownerId]
    );

    await pool.query(
      `INSERT INTO document_permissions
         (document_id, user_id, can_read, can_edit, granted_by)
       VALUES ($1, $2, TRUE, FALSE, $3)`,
      [documentId, viewerId, ownerId]
    );

    const ownerAgent = request.agent(app);
    const editorAgent = request.agent(app);
    const viewerAgent = request.agent(app);

    for (const [agent, email] of [
      [ownerAgent, `edit-owner-${suffix}@example.test`],
      [editorAgent, `edit-editor-${suffix}@example.test`],
      [viewerAgent, `edit-viewer-${suffix}@example.test`],
    ]) {
      const login = await agent
        .post("/api/auth/login")
        .send({ email, password });

      assert.equal(login.status, 200, `login should succeed for ${email}`);
    }

    const ownerCsrfToken = await getCsrfToken(ownerAgent);
    const editorCsrfToken = await getCsrfToken(editorAgent);
    const viewerCsrfToken = await getCsrfToken(viewerAgent);

    // CSRF protection tests
    await t.test("missing CSRF token is rejected", async () => {
      const response = await viewerAgent
        .patch(`/api/documents/${documentId}`)
        .send({ name: "csrf-missing-token.pdf" });

      assert.equal(response.status, 403);
    });

    await t.test("invalid CSRF token is rejected", async () => {
      const response = await viewerAgent
        .patch(`/api/documents/${documentId}`)
        .set("X-CSRF-Token", "invalid-token")
        .send({ name: "csrf-invalid-token.pdf" });

      assert.equal(response.status, 403);
    });

    await t.test("owner can edit document metadata", async () => {
      const response = await ownerAgent
        .patch(`/api/documents/${documentId}`)
        .set("X-CSRF-Token", ownerCsrfToken)
        .send({ name: "owner-updated.pdf" });

      assert.equal(response.status, 200);

      const saved = await pool.query(
        "SELECT name FROM documents WHERE id = $1",
        [documentId]
      );
      assert.equal(saved.rows[0].name, "owner-updated.pdf");
    });

    await t.test("explicit editor can edit document metadata", async () => {
      const response = await editorAgent
        .patch(`/api/documents/${documentId}`)
        .set("X-CSRF-Token", editorCsrfToken)
        .send({ category: "Editor Updated" });

      assert.equal(response.status, 200);

      const saved = await pool.query(
        "SELECT category FROM documents WHERE id = $1",
        [documentId]
      );
      assert.equal(saved.rows[0].category, "Editor Updated");
    });

    await t.test("read-only viewer cannot edit document metadata", async () => {
      const before = await pool.query(
        "SELECT name, category FROM documents WHERE id = $1",
        [documentId]
      );

      const response = await viewerAgent
        .patch(`/api/documents/${documentId}`)
        .set("X-CSRF-Token", viewerCsrfToken)
        .send({ name: "unauthorized-change.pdf" });

      assert.equal(response.status, 404);

      const after = await pool.query(
        "SELECT name, category FROM documents WHERE id = $1",
        [documentId]
      );

      assert.deepEqual(after.rows[0], before.rows[0]);
    });

    await t.test("successful edits are audited", async () => {
      const audit = await pool.query(
        `SELECT action, outcome
         FROM audit_logs
         WHERE actor_id = $1
           AND document_id = $2
           AND action = 'document.update'
           AND outcome = 'success'`,
        [editorId, documentId]
      );

      assert.equal(audit.rows.length, 1);
    });
  } finally {
    if (documentId) {
      await pool.query("DELETE FROM documents WHERE id = $1", [documentId]);

      await pool.query(
        `DELETE FROM audit_logs
         WHERE details->>'requestedDocumentId' = $1::text
            OR details->>'deletedDocumentId' = $1::text
            OR document_id = $1::uuid`,
        [documentId]
      );
    }

    if (ownerId) {
      await pool.query("DELETE FROM users WHERE id = $1", [ownerId]);
    }

    if (editorId) {
      await pool.query("DELETE FROM users WHERE id = $1", [editorId]);
    }

    if (viewerId) {
      await pool.query("DELETE FROM users WHERE id = $1", [viewerId]);
    }
  }
});

test("document search respects permissions and validates filters", async (t) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ownerEmail = `tv-search-owner-${suffix}@example.test`;
  const viewerEmail = `tv-search-viewer-${suffix}@example.test`;
  const testPassword = `Search-${suffix}-Pass!`;

  let ownerId;
  let viewerId;
  const documentIds = [];

  try {
    const passwordHash = await bcrypt.hash(testPassword, 4);

    const ownerResult = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'owner')
       RETURNING id`,
      ["Search Test Owner", ownerEmail, passwordHash]
    );
    ownerId = ownerResult.rows[0].id;

    const viewerResult = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'viewer')
       RETURNING id`,
      ["Search Test Viewer", viewerEmail, passwordHash]
    );
    viewerId = viewerResult.rows[0].id;

    const privateResult = await pool.query(
      `INSERT INTO documents
         (owner_id, name, category, mime_type, size_bytes, content)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        ownerId,
        `private-search-${suffix}.pdf`,
        "Confidential Search",
        "application/pdf",
        8,
        Buffer.from("%PDF-1.4"),
      ]
    );
    documentIds.push(privateResult.rows[0].id);

    const sharedResult = await pool.query(
      `INSERT INTO documents
         (owner_id, name, category, mime_type, size_bytes, content)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        ownerId,
        `shared-search-${suffix}.pdf`,
        "Shared Search",
        "application/pdf",
        8,
        Buffer.from("%PDF-1.4"),
      ]
    );
    documentIds.push(sharedResult.rows[0].id);

    await pool.query(
      `INSERT INTO document_permissions
         (document_id, user_id, can_read, can_edit, granted_by)
       VALUES ($1, $2, TRUE, FALSE, $3)`,
      [documentIds[1], viewerId, ownerId]
    );

    const viewerAgent = request.agent(app);

    const login = await viewerAgent
      .post("/api/auth/login")
      .send({ email: viewerEmail, password: testPassword });

    assert.equal(login.status, 200, "viewer login should succeed");

    await t.test("viewer can find a document shared with them", async () => {
      const response = await viewerAgent
        .get("/api/documents")
        .query({ name: `shared-search-${suffix}` });

      assert.equal(response.status, 200);
      assert.ok(
        response.body.documents.some(
          (document) => document.id === documentIds[1]
        )
      );
    });

    await t.test("exact-name search does not reveal a private document", async () => {
      const response = await viewerAgent
        .get("/api/documents")
        .query({ name: `private-search-${suffix}.pdf` });

      assert.equal(response.status, 200);
      assert.equal(
        response.body.documents.some(
          (document) => document.id === documentIds[0]
        ),
        false,
        "private document must not appear in search results"
      );
    });

    await t.test("category filter returns only matching accessible documents", async () => {
      const response = await viewerAgent
        .get("/api/documents")
        .query({ category: "Shared Search" });

      assert.equal(response.status, 200);
      assert.ok(response.body.documents.length >= 1);
      assert.ok(
        response.body.documents.every(
          (document) => document.category === "Shared Search"
        )
      );
      assert.ok(
        response.body.documents.every(
          (document) => document.id !== documentIds[0]
        )
      );
    });

    await t.test("invalid owner ID is rejected", async () => {
      const response = await viewerAgent
        .get("/api/documents")
        .query({ ownerId: "not-a-uuid" });

      assert.equal(response.status, 400);
    });

    await t.test("invalid calendar date is rejected", async () => {
      const response = await viewerAgent
        .get("/api/documents")
        .query({ from: "2026-02-30" });

      assert.equal(response.status, 400);
    });
  } finally {
    for (const documentId of documentIds) {
      await pool.query("DELETE FROM documents WHERE id = $1", [documentId]);
    }

    if (ownerId) {
      await pool.query("DELETE FROM users WHERE id = $1", [ownerId]);
    }

    if (viewerId) {
      await pool.query("DELETE FROM users WHERE id = $1", [viewerId]);
    }
  }
});

test("logout destroys the authenticated session", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `tv-logout-${suffix}@example.test`;
  const password = `Logout-${suffix}-Pass!`;
  let userId;

  try {
    const passwordHash = await bcrypt.hash(password, 4);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'viewer')
       RETURNING id`,
      ["Logout Test User", email, passwordHash]
    );
    userId = result.rows[0].id;

    const agent = request.agent(app);

    const login = await agent
      .post("/api/auth/login")
      .send({ email, password });

    assert.equal(login.status, 200, "login should succeed");

    const beforeLogout = await agent.get("/api/auth/me");
    assert.equal(beforeLogout.status, 200);

    const csrfToken = await getCsrfToken(agent);

    const logout = await agent
      .post("/api/auth/logout")
      .set("X-CSRF-Token", csrfToken);

    assert.equal(logout.status, 200);
    assert.equal(logout.body.message, "Logout successful.");

    const afterLogout = await agent.get("/api/auth/me");
    assert.equal(
      afterLogout.status,
      401,
      "the destroyed session must not access protected routes"
    );
  } finally {
    if (userId) {
      await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    }
  }
});

test("document uploads reject oversized and invalid files", async (t) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `tv-upload-${suffix}@example.test`;
  const password = `Upload-${suffix}-Pass!`;
  let userId;

  try {
    const passwordHash = await bcrypt.hash(password, 4);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'owner')
       RETURNING id`,
      ["Upload Test Owner", email, passwordHash]
    );

    userId = result.rows[0].id;

    const agent = request.agent(app);

    const login = await agent
      .post("/api/auth/login")
      .send({ email, password });

    assert.equal(login.status, 200, "upload test user should log in");

    const csrfToken = await getCsrfToken(agent);

    await t.test("oversized file is rejected with HTTP 413", async () => {
      const response = await agent
        .post("/api/documents/upload")
        .set("X-CSRF-Token", csrfToken)
        .field("category", "Upload Tests")
        .attach("file", Buffer.alloc(5 * 1024 * 1024 + 1, 65), {
          filename: "oversized.pdf",
          contentType: "application/pdf",
        });

      assert.equal(response.status, 413);
      assert.equal(
        response.body.error,
        "File exceeds the maximum allowed size of 5 MB."
      );
    });

    await t.test("unsupported file content is rejected with HTTP 400", async () => {
      const response = await agent
        .post("/api/documents/upload")
        .set("X-CSRF-Token", csrfToken)
        .field("category", "Upload Tests")
        .attach("file", Buffer.from("This is not a supported document"), {
          filename: "invalid.txt",
          contentType: "text/plain",
        });

      assert.equal(response.status, 400);
      assert.match(response.body.error, /unsupported or invalid file content/i);
    });
  } finally {
    if (userId) {
      await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    }
  }
});

test.after(async () => {
  await pool.end();
});
