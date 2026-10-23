
require("dotenv").config();

const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const request = require("supertest");
const { Pool } = require("pg");

if (process.env.NODE_ENV !== "test") {
  throw new Error("Integration tests must run with NODE_ENV=test.");
}

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL must be configured.");
}

const app = require("../src/server");

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

test("admin audit endpoint enforces access control", async (t) => {
  const suffix = `${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;

  const adminEmail = `tv-admin-${suffix}@example.test`;
  const viewerEmail = `tv-audit-viewer-${suffix}@example.test`;
  const password = `Audit-${suffix}-Pass!`;

  let adminId;
  let viewerId;
  let auditId;

  try {
    const passwordHash = await bcrypt.hash(password, 4);

    const adminResult = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING id`,
      ["Integration Test Admin", adminEmail, passwordHash]
    );
    adminId = adminResult.rows[0].id;

    const viewerResult = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'viewer')
       RETURNING id`,
      ["Integration Test Viewer", viewerEmail, passwordHash]
    );
    viewerId = viewerResult.rows[0].id;

    const auditResult = await pool.query(
      `INSERT INTO audit_logs
         (actor_id, action, details, outcome)
       VALUES ($1, $2, $3::jsonb, $4)
       RETURNING id`,
      [
        adminId,
        "test.audit.endpoint",
        JSON.stringify({ source: "automated-test" }),
        "success",
      ]
    );
    auditId = auditResult.rows[0].id;

    const adminAgent = request.agent(app);
    const viewerAgent = request.agent(app);

    const adminLogin = await adminAgent
      .post("/api/auth/login")
      .send({ email: adminEmail, password });

    assert.equal(adminLogin.status, 200);

    const viewerLogin = await viewerAgent
      .post("/api/auth/login")
      .send({ email: viewerEmail, password });

    assert.equal(viewerLogin.status, 200);

    await t.test("unauthenticated user receives 401", async () => {
      const response = await request(app).get(
        "/api/admin/audit-logs"
      );

      assert.equal(response.status, 401);
    });

    await t.test("viewer receives 403", async () => {
      const response = await viewerAgent.get(
        "/api/admin/audit-logs"
      );

      assert.equal(response.status, 403);
    });

    await t.test("admin can retrieve audit records", async () => {
      const response = await adminAgent.get(
        "/api/admin/audit-logs"
      );

      assert.equal(response.status, 200);
      assert.ok(Array.isArray(response.body.auditLogs));
      assert.equal(typeof response.body.count, "number");

      const record = response.body.auditLogs.find(
        (entry) => String(entry.id) === String(auditId)
      );

      assert.ok(record, "Expected audit record should be returned");
      assert.equal(record.actorId, adminId);
      assert.equal(record.action, "test.audit.endpoint");
      assert.equal(record.outcome, "success");
      assert.equal(record.details.source, "automated-test");

      // The API must not return stored document contents.
      assert.equal(
        Object.hasOwn(record, "content"),
        false
      );
    });

    await t.test("admin can request a smaller result limit", async () => {
      const response = await adminAgent.get(
        "/api/admin/audit-logs?limit=1"
      );

      assert.equal(response.status, 200);
      assert.ok(response.body.count <= 1);
    });

    await t.test("invalid limits are rejected", async () => {
      for (const value of ["0", "101", "-1", "abc", "1.5"]) {
        const response = await adminAgent.get(
          `/api/admin/audit-logs?limit=${encodeURIComponent(value)}`
        );

        assert.equal(
          response.status,
          400,
          `Expected limit=${value} to be rejected`
        );
      }
    });
  } finally {
    if (auditId !== undefined) {
      await pool.query(
        "DELETE FROM audit_logs WHERE id = $1",
        [auditId]
      );
    }

    if (adminId || viewerId) {
      await pool.query(
        `DELETE FROM audit_logs
         WHERE actor_id = ANY($1::uuid[])
            OR target_user_id = ANY($1::uuid[])`,
        [[adminId, viewerId].filter(Boolean)]
      );

      await pool.query(
        "DELETE FROM users WHERE id = ANY($1::uuid[])",
        [[adminId, viewerId].filter(Boolean)]
      );
    }
  }
});
