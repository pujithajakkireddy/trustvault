
const test = require("node:test");
const assert = require("node:assert/strict");
const requireRole = require("../src/middleware/require-role");

function createMockResponse() {
  return {
    statusCode: null,
    body: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test("viewer is denied access to an admin-only route", () => {
  const req = {
    session: {
      user: {
        id: "viewer-test-id",
        role: "viewer",
      },
    },
  };

  const res = createMockResponse();
  let nextCalled = false;

  requireRole("admin")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    error: "You do not have permission to perform this action.",
  });
  assert.equal(nextCalled, false);
});

test("admin is allowed to continue to an admin-only route", () => {
  const req = {
    session: {
      user: {
        id: "admin-test-id",
        role: "admin",
      },
    },
  };

  const res = createMockResponse();
  let nextCalled = false;

  requireRole("admin")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});
