
const test = require("node:test");
const assert = require("node:assert/strict");
const requireAuth = require("../src/middleware/require-auth");

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

test("unauthenticated request is rejected with HTTP 401", () => {
  const req = { session: {} };
  const res = createMockResponse();
  let nextCalled = false;

  requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {
    error: "Authentication required.",
  });
  assert.equal(nextCalled, false);
});

test("authenticated request continues to the next handler", () => {
  const req = {
    session: {
      user: {
        id: "test-user-id",
        role: "viewer",
      },
    },
  };

  const res = createMockResponse();
  let nextCalled = false;

  requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});
