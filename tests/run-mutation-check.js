
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
require("dotenv").config();

if (process.env.NODE_ENV !== "test") {
  throw new Error('Set NODE_ENV to "test" before running this script.');
}

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL must be configured.");
}

const routePath = path.join(__dirname, "../src/routes/documents.js");
const original = fs.readFileSync(routePath, "utf8");

const authorizationClause =
  "AND (d.owner_id = $2 OR p.can_read = TRUE)";

if (!original.includes(authorizationClause)) {
  throw new Error(
    "Expected authorization clause was not found. No files were changed."
  );
}

let testOutput = "";

try {
  // Temporarily remove only the download authorization condition.
  const mutated = original.replace(authorizationClause, "");

  fs.writeFileSync(routePath, mutated, "utf8");

  console.log("Temporary authorization mutation applied.");
  console.log("Running the integration tests...");

  const result = spawnSync(
    process.execPath,
    ["--test", "tests/document-access.test.js"],
    {
      cwd: path.join(__dirname, ".."),
      env: process.env,
      encoding: "utf8",
      timeout: 120000,
    }
  );

  testOutput = `${result.stdout || ""}\n${result.stderr || ""}`;
  console.log(testOutput);

  const detected =
    result.status !== 0 &&
    testOutput.includes("another user cannot download without permission");

  if (!detected) {
    throw new Error(
      "Mutation was not confirmed. Inspect the test output before proceeding."
    );
  }

  console.log(
    "PASS: The integration test detected the missing authorization check."
  );
} finally {
  // Restore the exact original route file, even if the test fails.
  fs.writeFileSync(routePath, original, "utf8");
  console.log("Original documents.js restored.");
}
