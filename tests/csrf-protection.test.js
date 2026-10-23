
const test = require("node:test");
const assert = require("node:assert/strict");
const csrfProtection = require("../src/middleware/csrf-protection");

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

function createRequest(method, session, token) {
  return {
    method,
    session,
    get(header) {
      return header.toLowerCase() === "x-csrf-token"
        ? token
        : undefined;
    },
  };
}

test("GET requests bypass CSRF validation", () => {
  const req = createRequest("GET", { user: { id: "user-1" } });
  const res = createMockResponse();
  let nextCalled = false;

  csrfProtection(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test("unauthenticated requests bypass this middleware's token check", () => {
  const req = createRequest("POST", {}, undefined);
  const res = createMockResponse();
  let nextCalled = false;

  csrfProtection(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test("authenticated state-changing request rejects a missing token", () => {
  const req = createRequest(
    "PATCH",
    { user: { id: "user-1" }, csrfToken: "expected-token" },
    undefined
  );
  const res = createMockResponse();
  let nextCalled = false;

  csrfProtection(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    error: "CSRF token missing or invalid.",
  });
  assert.equal(nextCalled, false);
});

test("authenticated state-changing request rejects an invalid token", () => {
  const req = createRequest(
    "DELETE",
    { user: { id: "user-1" }, csrfToken: "expected-token" },
    "wrong-token"
  );
  const res = createMockResponse();
  let nextCalled = false;

  csrfProtection(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
});

test("authenticated state-changing request accepts a matching token", () => {
  const token = "matching-token";
  const req = createRequest(
    "PUT",
    { user: { id: "user-1" }, csrfToken: token },
    token
  );
  const res = createMockResponse();
  let nextCalled = false;

  csrfProtection(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});
